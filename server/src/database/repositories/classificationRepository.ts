import { and, desc, eq } from 'drizzle-orm'
import { type Db, getDb } from '../connection.js'
import { matterClassifications } from '../schema/matterClassifications.js'

export type MatterClassification = typeof matterClassifications.$inferSelect

export interface InsertClassificationInput {
  matterId: string
  fieldId: string
  markdownVersionId: string
  taxonomyVersion: string
  selectedValueId: string | null
  label: string | null
  confidence: number | null
  probabilities: Array<{ id: string; label: string; probability: number }>
  classificationStatus: string
  modelDeployment: string
  classifiedAt: Date
  error?: { code: string; message: string } | null
}

/** Always an insert, never an update -- the classification log is immutable (see schema comment). */
export async function insertClassification(input: InsertClassificationInput, db: Db = getDb()): Promise<MatterClassification> {
  const [row] = await db
    .insert(matterClassifications)
    .values({
      matterId: input.matterId,
      fieldId: input.fieldId,
      markdownVersionId: input.markdownVersionId,
      taxonomyVersion: input.taxonomyVersion,
      selectedValueId: input.selectedValueId,
      label: input.label,
      confidence: input.confidence?.toString(),
      probabilities: input.probabilities,
      classificationStatus: input.classificationStatus,
      modelDeployment: input.modelDeployment,
      classifiedAt: input.classifiedAt,
      error: input.error ?? null,
    })
    .returning()
  return row!
}

/**
 * "Current" classification for a field = latest row whose markdownVersionId
 * matches the matter's CURRENT version -- a classification run against an
 * older/superseded version is simply never returned here, no matter when it
 * was inserted, which is what guarantees an older-version classification can
 * never override a newer one.
 */
export async function getCurrentClassification(
  matterId: string,
  fieldId: string,
  currentMarkdownVersionId: string,
): Promise<MatterClassification | undefined> {
  const [row] = await getDb()
    .select()
    .from(matterClassifications)
    .where(
      and(
        eq(matterClassifications.matterId, matterId),
        eq(matterClassifications.fieldId, fieldId),
        eq(matterClassifications.markdownVersionId, currentMarkdownVersionId),
      ),
    )
    .orderBy(desc(matterClassifications.classifiedAt))
    .limit(1)
  return row
}

export async function listClassificationHistory(matterId: string, fieldId: string): Promise<MatterClassification[]> {
  return getDb()
    .select()
    .from(matterClassifications)
    .where(and(eq(matterClassifications.matterId, matterId), eq(matterClassifications.fieldId, fieldId)))
    .orderBy(desc(matterClassifications.classifiedAt))
}

/** One row per field actually classified against this specific version (for "has this version even been classified yet"). */
export async function listClassificationsForVersion(matterId: string, markdownVersionId: string): Promise<MatterClassification[]> {
  return getDb()
    .select()
    .from(matterClassifications)
    .where(and(eq(matterClassifications.matterId, matterId), eq(matterClassifications.markdownVersionId, markdownVersionId)))
}
