import { eq } from 'drizzle-orm'
import { type Db, getDb } from '../connection.js'
import { matterResearchRuns } from '../schema/matterResearchRuns.js'

export type MatterResearchRun = typeof matterResearchRuns.$inferSelect

export interface RunStartedInput {
  id: string
  matterId: string | null
  startedAt: Date
  modelDeployment?: string
}

/** Idempotent: a retried "run started" event for the same runId is a no-op, never a duplicate row. */
export async function recordRunStarted(input: RunStartedInput, db: Db = getDb()): Promise<void> {
  await db
    .insert(matterResearchRuns)
    .values({
      id: input.id,
      matterId: input.matterId,
      researchStatus: 'running',
      startedAt: input.startedAt,
      modelDeployment: input.modelDeployment,
    })
    .onConflictDoNothing({ target: matterResearchRuns.id })
}

export interface RunCompletedInput {
  id: string
  researchStatus: 'succeeded' | 'failed' | 'cancelled'
  completedAt: Date
  generatedMarkdownVersionId?: string
  discoveredDocumentCount?: number
  reviewedDocumentCount?: number
  errorSummary?: string
}

export async function recordRunCompleted(input: RunCompletedInput, db: Db = getDb()): Promise<void> {
  await db
    .update(matterResearchRuns)
    .set({
      researchStatus: input.researchStatus,
      completedAt: input.completedAt,
      generatedMarkdownVersionId: input.generatedMarkdownVersionId,
      discoveredDocumentCount: input.discoveredDocumentCount ?? 0,
      reviewedDocumentCount: input.reviewedDocumentCount ?? 0,
      errorSummary: input.errorSummary,
    })
    .where(eq(matterResearchRuns.id, input.id))
}

export async function getRun(runId: string): Promise<MatterResearchRun | undefined> {
  const [row] = await getDb().select().from(matterResearchRuns).where(eq(matterResearchRuns.id, runId)).limit(1)
  return row
}
