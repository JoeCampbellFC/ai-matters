/**
 * One-off migration: imports the pre-Phase-4 JSON-file store
 * (server/data/classification-store.json, keyed by sessionId+workspaceId)
 * into PostgreSQL (matters keyed by tenantId+workspaceId -- shared across
 * sessions). Safe to re-run: every write is idempotent (resolveOrCreateMatter
 * upserts; versions/classifications are only created if not already present
 * for that exact old artifact/record id, tracked via researchRunId +
 * contentHash rather than a separate "already imported" table).
 *
 * Usage: npm run db:import-legacy
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { config } from '../src/config.js'
import { closeDatabasePool, getDb } from '../src/database/connection.js'
import { recordAuditEvent } from '../src/database/repositories/auditRepository.js'
import { insertClassification, listClassificationsForVersion } from '../src/database/repositories/classificationRepository.js'
import { getFieldDefinitionsByKeys, seedFieldDefinitions } from '../src/database/repositories/fieldDefinitionRepository.js'
import { createVersion, listVersions, markOtherVersionsSuperseded } from '../src/database/repositories/knowledgeRepository.js'
import { resolveOrCreateMatter, setCurrentMarkdownVersion } from '../src/database/repositories/matterRepository.js'
import { upsertFieldValue } from '../src/database/repositories/profileRepository.js'
import { TAXONOMY_VERSION } from '../src/classification/matterTypes.js'

const STORE_PATH = path.resolve(process.cwd(), 'data', 'classification-store.json')
const IMPORT_ACTOR = 'legacy-import'

interface LegacyClassificationRecord {
  id: string
  fieldId: string
  markdownArtifactId: string
  markdownHash: string
  status: string
  valueId: string | null
  label: string | null
  confidence: number | null
  probabilities: Array<{ id: string; label: string; probability: number }>
  model: string
  deploymentName: string
  taxonomyVersion: string
  inputMode: string
  classifiedAt: string
  error?: { code: string; message: string }
}

interface LegacyArtifact {
  id: string
  sessionId: string
  workspaceId: string
  workspaceName?: string
  researchRunId: string
  version: number
  markdown: string
  markdownHash: string
  documentsUsed: number
  createdAt: string
}

interface LegacyProfile {
  sessionId: string
  workspaceId: string
  workspaceName?: string
  fields: Partial<Record<string, LegacyClassificationRecord>>
  history: Partial<Record<string, LegacyClassificationRecord[]>>
  overrides: Partial<Record<string, { fieldId: string; valueId: string; label: string; correctedBy: string; correctedAt: string }>>
  lastErrors: Partial<Record<string, { code: string; message: string; at: string }>>
  updatedAt: string
}

interface LegacyStore {
  artifacts: LegacyArtifact[]
  profiles: LegacyProfile[]
}

async function main(): Promise<void> {
  if (!existsSync(STORE_PATH)) {
    console.log(`No legacy store found at ${STORE_PATH} -- nothing to import.`)
    return
  }
  const store = JSON.parse(readFileSync(STORE_PATH, 'utf-8')) as LegacyStore
  console.log(`Loaded legacy store: ${store.artifacts.length} artifacts, ${store.profiles.length} profiles.`)

  await seedFieldDefinitions()
  const workspaceIds = [...new Set(store.artifacts.map((a) => a.workspaceId))]
  const db = getDb()

  for (const workspaceId of workspaceIds) {
    const artifactsForWorkspace = store.artifacts
      .filter((a) => a.workspaceId === workspaceId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const latestWorkspaceName = artifactsForWorkspace.at(-1)?.workspaceName

    const matter = await resolveOrCreateMatter(
      { tenantId: config.tenantId, libraryId: null, workspaceId },
      { workspaceName: latestWorkspaceName, createdBy: IMPORT_ACTOR },
    )

    const alreadyImported = await listVersions(matter.id)
    const oldArtifactIdToNewVersionId = new Map<string, string>()
    let lastVersionId: string | undefined

    for (const artifact of artifactsForWorkspace) {
      const existing = alreadyImported.find((v) => v.contentHash === artifact.markdownHash && v.researchRunId === artifact.researchRunId)
      if (existing) {
        oldArtifactIdToNewVersionId.set(artifact.id, existing.id)
        lastVersionId = existing.id
        continue
      }
      const version = await createVersion(
        {
          matterId: matter.id,
          content: artifact.markdown,
          contentHash: artifact.markdownHash,
          source: 'ai_generated',
          researchRunId: artifact.researchRunId,
          createdBy: IMPORT_ACTOR,
          changeSummary: `Imported from legacy session ${artifact.sessionId}`,
        },
        db,
      )
      oldArtifactIdToNewVersionId.set(artifact.id, version.id)
      lastVersionId = version.id
      console.log(`  [${workspaceId}] imported Markdown version ${version.versionNumber} (${artifact.markdown.length} chars)`)
    }

    if (lastVersionId && matter.currentMarkdownVersionId !== lastVersionId) {
      await markOtherVersionsSuperseded(matter.id, lastVersionId, db)
      await setCurrentMarkdownVersion(matter.id, lastVersionId, db)
    }

    // Merge every legacy profile for this workspace (one per old session) into the one shared Matter.
    const profilesForWorkspace = store.profiles.filter((p) => p.workspaceId === workspaceId)
    for (const profile of profilesForWorkspace) {
      const allRecords = [
        ...Object.values(profile.fields).filter((r): r is LegacyClassificationRecord => Boolean(r)),
        ...Object.values(profile.history)
          .flat()
          .filter((r): r is LegacyClassificationRecord => Boolean(r)),
      ]
      for (const record of allRecords) {
        const versionId = oldArtifactIdToNewVersionId.get(record.markdownArtifactId)
        if (!versionId) continue
        const existingForVersion = await listClassificationsForVersion(matter.id, versionId)
        if (existingForVersion.some((c) => c.fieldId === record.fieldId && c.classifiedAt.toISOString() === new Date(record.classifiedAt).toISOString())) {
          continue
        }
        await insertClassification({
          matterId: matter.id,
          fieldId: record.fieldId,
          markdownVersionId: versionId,
          taxonomyVersion: record.taxonomyVersion || TAXONOMY_VERSION,
          selectedValueId: record.valueId,
          label: record.label,
          confidence: record.confidence,
          probabilities: record.probabilities,
          classificationStatus: record.status,
          modelDeployment: record.deploymentName,
          classifiedAt: new Date(record.classifiedAt),
          error: record.error,
        })
      }

      for (const override of Object.values(profile.overrides)) {
        if (!override) continue
        const [definition] = await getFieldDefinitionsByKeys([override.fieldId])
        if (!definition) continue
        await upsertFieldValue({
          matterId: matter.id,
          fieldDefinitionId: definition.id,
          value: { valueId: override.valueId, label: override.label },
          valueSource: 'user',
          updatedBy: override.correctedBy,
        })
      }
    }

    await recordAuditEvent({
      matterId: matter.id,
      entityType: 'matter',
      entityId: matter.id,
      action: 'imported_from_legacy_store',
      newValue: { versionsImported: artifactsForWorkspace.length, profilesMerged: profilesForWorkspace.length },
      changedBy: IMPORT_ACTOR,
    })

    console.log(`[${workspaceId}] done -- matter ${matter.id}`)
  }

  console.log('Legacy import complete.')
}

main()
  .catch((error) => {
    console.error('Legacy import failed:', error)
    process.exitCode = 1
  })
  .finally(() => closeDatabasePool())
