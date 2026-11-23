import { and, desc, eq, max, ne } from 'drizzle-orm'
import { type Db, getDb } from '../connection.js'
import { matterKnowledgeVersions } from '../schema/matterKnowledge.js'
import { matters } from '../schema/matters.js'

export type MatterKnowledgeVersion = typeof matterKnowledgeVersions.$inferSelect

export interface CreateVersionInput {
  matterId: string
  content: string
  contentHash: string
  source: 'ai_generated' | 'user_edited'
  researchRunId?: string
  createdBy: string
  parentVersionId?: string
  changeSummary?: string
}

/** Always call within the same transaction as the matters.currentMarkdownVersionId update that follows it (see matterKnowledgeService.ts) -- a version must never exist without the matter pointing at it, or vice versa. */
export async function createVersion(input: CreateVersionInput, db: Db = getDb()): Promise<MatterKnowledgeVersion> {
  const [{ value: maxVersion }] = await db
    .select({ value: max(matterKnowledgeVersions.versionNumber) })
    .from(matterKnowledgeVersions)
    .where(eq(matterKnowledgeVersions.matterId, input.matterId))

  const [row] = await db
    .insert(matterKnowledgeVersions)
    .values({
      matterId: input.matterId,
      versionNumber: (maxVersion ?? 0) + 1,
      content: input.content,
      contentHash: input.contentHash,
      source: input.source,
      researchRunId: input.researchRunId,
      status: 'published',
      createdBy: input.createdBy,
      parentVersionId: input.parentVersionId,
      changeSummary: input.changeSummary,
    })
    .returning()
  return row!
}

export async function getVersion(versionId: string, db: Db = getDb()): Promise<MatterKnowledgeVersion | undefined> {
  const [row] = await db.select().from(matterKnowledgeVersions).where(eq(matterKnowledgeVersions.id, versionId)).limit(1)
  return row
}

export async function getCurrentVersion(matterId: string, db: Db = getDb()): Promise<MatterKnowledgeVersion | undefined> {
  const [row] = await db
    .select({ version: matterKnowledgeVersions })
    .from(matters)
    .innerJoin(matterKnowledgeVersions, eq(matters.currentMarkdownVersionId, matterKnowledgeVersions.id))
    .where(eq(matters.id, matterId))
    .limit(1)
  return row?.version
}

export async function listVersions(matterId: string, db: Db = getDb()): Promise<MatterKnowledgeVersion[]> {
  return db
    .select()
    .from(matterKnowledgeVersions)
    .where(eq(matterKnowledgeVersions.matterId, matterId))
    .orderBy(desc(matterKnowledgeVersions.versionNumber))
}

/** Call right after createVersion(), in the same transaction, with the new version's id -- demotes every other version of this matter from 'published' to 'superseded'. */
export async function markOtherVersionsSuperseded(matterId: string, currentVersionId: string, db: Db = getDb()): Promise<void> {
  await db
    .update(matterKnowledgeVersions)
    .set({ status: 'superseded' })
    .where(
      and(
        eq(matterKnowledgeVersions.matterId, matterId),
        ne(matterKnowledgeVersions.id, currentVersionId),
        eq(matterKnowledgeVersions.status, 'published'),
      ),
    )
}
