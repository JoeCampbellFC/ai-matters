import { recordAuditEvent } from '../database/repositories/auditRepository.js'
import {
  createVersion,
  getCurrentVersion,
  getVersion,
  listVersions,
  markOtherVersionsSuperseded,
  type KnowledgeCitationEntry,
  type MatterKnowledgeVersion,
} from '../database/repositories/knowledgeRepository.js'
import { setCurrentMarkdownVersion } from '../database/repositories/matterRepository.js'
import { getDb } from '../database/connection.js'
import { MarkdownNotPublishedError, StaleMarkdownVersionError } from '../database/errors.js'
import { hashMarkdown } from '../classification/classificationInputBuilder.js'

export { listVersions, getVersion }

export async function getCurrentVersionOrThrow(matterId: string): Promise<MatterKnowledgeVersion> {
  const version = await getCurrentVersion(matterId)
  if (!version) throw new MarkdownNotPublishedError()
  return version
}

export interface PublishGeneratedMarkdownInput {
  matterId: string
  markdown: string
  researchRunId: string
  createdBy: string
  citationRegistry?: KnowledgeCitationEntry[]
}

/**
 * Phase 2 research completion -> durable version. Runs as one transaction:
 * a version must never exist without the matter pointing at it as current,
 * or vice versa (spec: "The Markdown must be committed successfully before
 * classification is triggered" -- the caller only proceeds to classify once
 * this promise resolves).
 */
export async function publishGeneratedMarkdown(input: PublishGeneratedMarkdownInput): Promise<MatterKnowledgeVersion> {
  if (!input.markdown || input.markdown.trim().length === 0) {
    throw new Error('The completed research run produced empty Markdown -- nothing to publish.')
  }

  return getDb().transaction(async (tx) => {
    const version = await createVersion(
      {
        matterId: input.matterId,
        content: input.markdown,
        contentHash: hashMarkdown(input.markdown),
        source: 'ai_generated',
        researchRunId: input.researchRunId,
        createdBy: input.createdBy,
        citationRegistry: input.citationRegistry,
      },
      tx,
    )
    await markOtherVersionsSuperseded(input.matterId, version.id, tx)
    await setCurrentMarkdownVersion(input.matterId, version.id, tx)
    await recordAuditEvent(
      {
        matterId: input.matterId,
        entityType: 'matter_knowledge_version',
        entityId: version.id,
        action: 'published',
        newValue: { versionNumber: version.versionNumber, researchRunId: input.researchRunId },
        changedBy: input.createdBy,
      },
      tx,
    )
    return version
  })
}

export interface EditMarkdownInput {
  matterId: string
  content: string
  basedOnVersionId: string
  changeSummary?: string
  updatedBy: string
}

/** A user-edited Markdown save -- requires the version the editor was opened against; a stale basedOnVersionId (someone else saved first) throws rather than silently overwriting their edit. */
export async function editMarkdown(input: EditMarkdownInput): Promise<MatterKnowledgeVersion> {
  const current = await getCurrentVersionOrThrow(input.matterId)
  if (current.id !== input.basedOnVersionId) {
    throw new StaleMarkdownVersionError()
  }

  return getDb().transaction(async (tx) => {
    const version = await createVersion(
      {
        matterId: input.matterId,
        content: input.content,
        contentHash: hashMarkdown(input.content),
        source: 'user_edited',
        createdBy: input.updatedBy,
        parentVersionId: current.id,
        changeSummary: input.changeSummary,
      },
      tx,
    )
    await markOtherVersionsSuperseded(input.matterId, version.id, tx)
    await setCurrentMarkdownVersion(input.matterId, version.id, tx)
    await recordAuditEvent(
      {
        matterId: input.matterId,
        entityType: 'matter_knowledge_version',
        entityId: version.id,
        action: 'edited',
        previousValue: { versionNumber: current.versionNumber },
        newValue: { versionNumber: version.versionNumber },
        changedBy: input.updatedBy,
      },
      tx,
    )
    return version
  })
}

/** Restores an earlier version by creating a new current version with its content -- history is never overwritten or deleted. */
export async function restoreVersion(input: { matterId: string; versionId: string; updatedBy: string }): Promise<MatterKnowledgeVersion> {
  const current = await getCurrentVersionOrThrow(input.matterId)
  const toRestore = await getVersion(input.versionId)
  if (!toRestore || toRestore.matterId !== input.matterId) {
    throw new MarkdownNotPublishedError('The version to restore does not exist for this matter.')
  }

  return getDb().transaction(async (tx) => {
    const version = await createVersion(
      {
        matterId: input.matterId,
        content: toRestore.content,
        contentHash: toRestore.contentHash,
        source: toRestore.source as 'ai_generated' | 'user_edited',
        createdBy: input.updatedBy,
        parentVersionId: current.id,
        changeSummary: `Restored content from version ${toRestore.versionNumber}`,
      },
      tx,
    )
    await markOtherVersionsSuperseded(input.matterId, version.id, tx)
    await setCurrentMarkdownVersion(input.matterId, version.id, tx)
    await recordAuditEvent(
      {
        matterId: input.matterId,
        entityType: 'matter_knowledge_version',
        entityId: version.id,
        action: 'restored',
        previousValue: { versionNumber: current.versionNumber },
        newValue: { versionNumber: version.versionNumber, restoredFromVersionNumber: toRestore.versionNumber },
        changedBy: input.updatedBy,
      },
      tx,
    )
    return version
  })
}
