import { and, eq } from 'drizzle-orm'
import { type Db, getDb } from '../connection.js'
import { matterDashboardProjections } from '../schema/matterDashboard.js'

export type MatterDashboardProjectionRow = typeof matterDashboardProjections.$inferSelect
export type ProjectionStatus = 'pending' | 'generating' | 'ready' | 'failed'

/** Bump whenever the Zod schema shape in dashboard/projectionSchemas.ts changes in a way old cached rows wouldn't satisfy -- a bump means every matter re-generates once, on next View Dashboard. */
export const PROJECTION_SCHEMA_VERSION = 'v1'

export async function getProjection(
  matterId: string,
  markdownVersionId: string,
  schemaVersion: string = PROJECTION_SCHEMA_VERSION,
  db: Db = getDb(),
): Promise<MatterDashboardProjectionRow | undefined> {
  const [row] = await db
    .select()
    .from(matterDashboardProjections)
    .where(
      and(
        eq(matterDashboardProjections.matterId, matterId),
        eq(matterDashboardProjections.markdownVersionId, markdownVersionId),
        eq(matterDashboardProjections.projectionSchemaVersion, schemaVersion),
      ),
    )
    .limit(1)
  return row
}

export interface SaveProjectionInput {
  matterId: string
  markdownVersionId: string
  markdownHash: string
  schemaVersion?: string
  projectionJson: unknown
}

/**
 * Idempotent upsert keyed by (matterId, markdownVersionId, schemaVersion) --
 * a concurrent double "View Dashboard" click races harmlessly to the same
 * row instead of creating duplicates or double-calling the LLM.
 */
export async function saveProjectionReady(input: SaveProjectionInput, db: Db = getDb()): Promise<MatterDashboardProjectionRow> {
  const [row] = await db
    .insert(matterDashboardProjections)
    .values({
      matterId: input.matterId,
      markdownVersionId: input.markdownVersionId,
      markdownHash: input.markdownHash,
      projectionSchemaVersion: input.schemaVersion ?? PROJECTION_SCHEMA_VERSION,
      projectionJson: input.projectionJson,
      status: 'ready',
      generatedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [matterDashboardProjections.matterId, matterDashboardProjections.markdownVersionId, matterDashboardProjections.projectionSchemaVersion],
      set: {
        projectionJson: input.projectionJson,
        status: 'ready',
        errorMessage: null,
        generatedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning()
  return row!
}

export async function saveProjectionFailed(
  input: { matterId: string; markdownVersionId: string; markdownHash: string; schemaVersion?: string; errorMessage: string },
  db: Db = getDb(),
): Promise<MatterDashboardProjectionRow> {
  const [row] = await db
    .insert(matterDashboardProjections)
    .values({
      matterId: input.matterId,
      markdownVersionId: input.markdownVersionId,
      markdownHash: input.markdownHash,
      projectionSchemaVersion: input.schemaVersion ?? PROJECTION_SCHEMA_VERSION,
      status: 'failed',
      errorMessage: input.errorMessage,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [matterDashboardProjections.matterId, matterDashboardProjections.markdownVersionId, matterDashboardProjections.projectionSchemaVersion],
      set: { status: 'failed', errorMessage: input.errorMessage, updatedAt: new Date() },
    })
    .returning()
  return row!
}
