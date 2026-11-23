import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ClassificationFieldId } from './classificationFields.js'
import type { ClassificationRecord, ManualCorrection, MarkdownArtifact, MatterProfileRecord } from './types.js'

/**
 * Simple file-backed durable store -- the research runs it classifies are
 * only ever in-memory (TTL'd), so classification results and the Markdown
 * they were derived from must survive both that TTL and a server restart.
 * A full database platform would be overkill for this single-process app;
 * writes are synchronous (writeFileSync/renameSync don't interleave on
 * Node's single JS thread) and atomic (write-then-rename), which is enough
 * durability for this write volume (one write per field classified/
 * reclassified/corrected, not a hot path).
 */
const DATA_DIR = path.resolve(process.cwd(), 'data')
const STORE_PATH = path.join(DATA_DIR, 'classification-store.json')

interface StoreShape {
  artifacts: MarkdownArtifact[]
  profiles: MatterProfileRecord[]
}

function emptyStore(): StoreShape {
  return { artifacts: [], profiles: [] }
}

/** Shape used before classification expanded from a single "matter_type" result to 16 independent per-field results. */
interface LegacyClassificationRecord {
  id: string
  markdownArtifactId: string
  markdownHash: string
  status: string
  matterTypeId: string | null
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

interface LegacyProfileShape {
  sessionId: string
  workspaceId: string
  workspaceName?: string
  current?: LegacyClassificationRecord
  history?: LegacyClassificationRecord[]
  override?: { matterTypeId: string; label: string; correctedBy: string; correctedAt: string }
  lastError?: { code: string; message: string; at: string }
  updatedAt?: string
}

function migrateLegacyRecord(record: LegacyClassificationRecord): ClassificationRecord {
  const { matterTypeId, ...rest } = record
  return { ...rest, fieldId: 'matter_type', valueId: matterTypeId } as ClassificationRecord
}

/**
 * Backfills a profile saved under the earlier single-field schema (a
 * `current`/`history`/`override`/`lastError` shape entirely about
 * "matter_type", from before classification expanded to 16 independent
 * per-field results) into the current per-field shape, mapped onto the
 * matter_type field specifically -- the only field that existed back then.
 * Markdown artifacts are a separate, unchanged part of the store and are
 * unaffected either way.
 */
function normalizeProfile(profile: Partial<MatterProfileRecord> & Partial<LegacyProfileShape>): MatterProfileRecord {
  if (profile.fields) {
    return {
      sessionId: profile.sessionId!,
      workspaceId: profile.workspaceId!,
      workspaceName: profile.workspaceName,
      fields: profile.fields,
      history: profile.history ?? {},
      overrides: profile.overrides ?? {},
      lastErrors: profile.lastErrors ?? {},
      updatedAt: profile.updatedAt ?? new Date().toISOString(),
    }
  }

  const fields: MatterProfileRecord['fields'] = {}
  const history: MatterProfileRecord['history'] = {}
  const overrides: MatterProfileRecord['overrides'] = {}
  const lastErrors: MatterProfileRecord['lastErrors'] = {}

  if (profile.current) fields.matter_type = migrateLegacyRecord(profile.current)
  if (Array.isArray(profile.history) && profile.history.length > 0) {
    history.matter_type = profile.history.map(migrateLegacyRecord)
  }
  if (profile.override) {
    overrides.matter_type = {
      fieldId: 'matter_type',
      valueId: profile.override.matterTypeId,
      label: profile.override.label,
      correctedBy: profile.override.correctedBy,
      correctedAt: profile.override.correctedAt,
    }
  }
  if (profile.lastError) lastErrors.matter_type = profile.lastError

  return {
    sessionId: profile.sessionId!,
    workspaceId: profile.workspaceId!,
    workspaceName: profile.workspaceName,
    fields,
    history,
    overrides,
    lastErrors,
    updatedAt: profile.updatedAt ?? new Date().toISOString(),
  }
}

function loadStore(): StoreShape {
  if (!existsSync(STORE_PATH)) return emptyStore()
  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, 'utf-8')) as { artifacts?: MarkdownArtifact[]; profiles?: unknown[] }
    const profiles = (parsed.profiles ?? []).map((p) => normalizeProfile(p as Partial<MatterProfileRecord> & Partial<LegacyProfileShape>))
    return { artifacts: parsed.artifacts ?? [], profiles }
  } catch {
    // Corrupt or unreadable store -- start fresh rather than crash the server.
    return emptyStore()
  }
}

let store = loadStore()

function persist(): void {
  mkdirSync(DATA_DIR, { recursive: true })
  const tmpPath = `${STORE_PATH}.tmp-${process.pid}`
  writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8')
  renameSync(tmpPath, STORE_PATH)
}

/** Test-only: resets the in-memory store without touching disk. */
export function __resetStoreForTests(): void {
  store = emptyStore()
}

export function saveMarkdownArtifact(
  input: Omit<MarkdownArtifact, 'id' | 'version' | 'createdAt'>,
): MarkdownArtifact {
  const priorVersions = store.artifacts.filter(
    (a) => a.sessionId === input.sessionId && a.workspaceId === input.workspaceId,
  )
  const artifact: MarkdownArtifact = {
    ...input,
    id: randomUUID(),
    version: priorVersions.length + 1,
    createdAt: new Date().toISOString(),
  }
  store.artifacts.push(artifact)
  persist()
  return artifact
}

export function getMarkdownArtifact(id: string): MarkdownArtifact | undefined {
  return store.artifacts.find((a) => a.id === id)
}

export function getLatestMarkdownArtifact(sessionId: string, workspaceId: string): MarkdownArtifact | undefined {
  const matches = store.artifacts.filter((a) => a.sessionId === sessionId && a.workspaceId === workspaceId)
  return matches.at(-1)
}

export function getProfileRecord(sessionId: string, workspaceId: string): MatterProfileRecord | undefined {
  return store.profiles.find((p) => p.sessionId === sessionId && p.workspaceId === workspaceId)
}

function findOrCreateProfile(sessionId: string, workspaceId: string, workspaceName?: string): MatterProfileRecord {
  let profile = getProfileRecord(sessionId, workspaceId)
  if (!profile) {
    profile = {
      sessionId,
      workspaceId,
      workspaceName,
      fields: {},
      history: {},
      overrides: {},
      lastErrors: {},
      updatedAt: new Date().toISOString(),
    }
    store.profiles.push(profile)
  }
  return profile
}

/**
 * Records a successful classification for one field as that field's new
 * current result, pushing the prior one (if any) into that field's history,
 * and clears any manual override/last-attempt error for the SAME field only
 * -- other fields on the same profile are untouched.
 */
export function upsertFieldClassification(input: {
  sessionId: string
  workspaceId: string
  workspaceName?: string
  record: ClassificationRecord
}): MatterProfileRecord {
  const profile = findOrCreateProfile(input.sessionId, input.workspaceId, input.workspaceName)
  const fieldId = input.record.fieldId
  const existing = profile.fields[fieldId]
  if (existing) {
    const history = profile.history[fieldId] ?? []
    history.push(existing)
    profile.history[fieldId] = history
  }
  profile.fields[fieldId] = input.record
  profile.workspaceName = input.workspaceName ?? profile.workspaceName
  delete profile.overrides[fieldId]
  delete profile.lastErrors[fieldId]
  profile.updatedAt = new Date().toISOString()
  persist()
  return profile
}

/** Records a failed attempt for one field without disturbing that field's (or any other field's) existing successful result. */
export function recordFieldClassificationFailure(
  sessionId: string,
  workspaceId: string,
  workspaceName: string | undefined,
  fieldId: ClassificationFieldId,
  error: { code: string; message: string },
): MatterProfileRecord {
  const profile = findOrCreateProfile(sessionId, workspaceId, workspaceName)
  profile.lastErrors[fieldId] = { ...error, at: new Date().toISOString() }
  profile.updatedAt = new Date().toISOString()
  persist()
  return profile
}

export function recordManualCorrection(
  sessionId: string,
  workspaceId: string,
  correction: ManualCorrection,
): MatterProfileRecord | undefined {
  const profile = getProfileRecord(sessionId, workspaceId)
  if (!profile) return undefined
  profile.overrides[correction.fieldId] = correction
  profile.updatedAt = new Date().toISOString()
  persist()
  return profile
}
