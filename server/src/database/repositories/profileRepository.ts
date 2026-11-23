import { and, eq, sql } from 'drizzle-orm'
import { type Db, getDb } from '../connection.js'
import { ConcurrencyConflictError } from '../errors.js'
import { matterFieldValues } from '../schema/matterFields.js'

export type MatterFieldValue = typeof matterFieldValues.$inferSelect

export async function listFieldValues(matterId: string, db: Db = getDb()): Promise<MatterFieldValue[]> {
  return db.select().from(matterFieldValues).where(eq(matterFieldValues.matterId, matterId))
}

export async function getFieldValue(matterId: string, fieldDefinitionId: string, db: Db = getDb()): Promise<MatterFieldValue | undefined> {
  const [row] = await db
    .select()
    .from(matterFieldValues)
    .where(and(eq(matterFieldValues.matterId, matterId), eq(matterFieldValues.fieldDefinitionId, fieldDefinitionId)))
    .limit(1)
  return row
}

export interface WriteFieldValueInput {
  matterId: string
  fieldDefinitionId: string
  value: unknown
  valueSource: 'iManage' | 'ai' | 'user' | 'system'
  updatedBy: string
  confidence?: number | null
  sourceReference?: string | null
}

/** AI/system writes (classification overrides aside) never carry a client-known version, so they always win -- bumps version unconditionally. */
export async function upsertFieldValue(input: WriteFieldValueInput, db: Db = getDb()): Promise<MatterFieldValue> {
  const [row] = await db
    .insert(matterFieldValues)
    .values({
      matterId: input.matterId,
      fieldDefinitionId: input.fieldDefinitionId,
      value: input.value,
      valueSource: input.valueSource,
      confidence: input.confidence?.toString(),
      sourceReference: input.sourceReference,
      updatedBy: input.updatedBy,
      version: 1,
    })
    .onConflictDoUpdate({
      target: [matterFieldValues.matterId, matterFieldValues.fieldDefinitionId],
      set: {
        value: input.value,
        valueSource: input.valueSource,
        confidence: input.confidence?.toString(),
        sourceReference: input.sourceReference,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
        version: sql`${matterFieldValues.version} + 1`,
      },
    })
    .returning()
  return row!
}

/**
 * User edits via the Matter Profile form -- requires the version the client
 * last read (0 meaning "no value exists yet"). A mismatch (someone else
 * saved first) throws ConcurrencyConflictError rather than silently
 * overwriting their change.
 */
export async function updateFieldValueWithConcurrencyCheck(
  input: WriteFieldValueInput & { expectedVersion: number },
  db: Db = getDb(),
): Promise<MatterFieldValue> {
  const existing = await getFieldValue(input.matterId, input.fieldDefinitionId, db)

  if (!existing) {
    if (input.expectedVersion !== 0) throw new ConcurrencyConflictError()
    const [row] = await db
      .insert(matterFieldValues)
      .values({
        matterId: input.matterId,
        fieldDefinitionId: input.fieldDefinitionId,
        value: input.value,
        valueSource: input.valueSource,
        confidence: input.confidence?.toString(),
        sourceReference: input.sourceReference,
        updatedBy: input.updatedBy,
        version: 1,
      })
      .onConflictDoNothing({ target: [matterFieldValues.matterId, matterFieldValues.fieldDefinitionId] })
      .returning()
    if (!row) throw new ConcurrencyConflictError()
    return row
  }

  const [row] = await db
    .update(matterFieldValues)
    .set({
      value: input.value,
      valueSource: input.valueSource,
      confidence: input.confidence?.toString(),
      sourceReference: input.sourceReference,
      updatedBy: input.updatedBy,
      updatedAt: new Date(),
      version: existing.version + 1,
    })
    .where(
      and(
        eq(matterFieldValues.matterId, input.matterId),
        eq(matterFieldValues.fieldDefinitionId, input.fieldDefinitionId),
        eq(matterFieldValues.version, input.expectedVersion),
      ),
    )
    .returning()

  if (!row) throw new ConcurrencyConflictError()
  return row
}
