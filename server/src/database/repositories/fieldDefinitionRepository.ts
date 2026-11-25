import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { CLASSIFICATION_FIELDS } from '../../classification/classificationFields.js'
import { type Db, getDb } from '../connection.js'
import { ConcurrencyConflictError } from '../errors.js'
import { matterFieldDefinitions } from '../schema/matterFields.js'

export type MatterFieldDefinition = typeof matterFieldDefinitions.$inferSelect

/**
 * Pure-profile fields with no AI classifier -- the 16 Phase 3 dimensions are
 * seeded separately below, straight from classificationFields.ts, so their
 * choices are never duplicated/hand-copied here (see PLAN decision #4: no
 * second taxonomy).
 */
const PROFILE_FIELD_SEEDS: Array<Omit<typeof matterFieldDefinitions.$inferInsert, 'id'>> = [
  { fieldKey: 'matter_name', displayName: 'Matter Name', dataType: 'text', required: true, editable: true, systemField: true, displayOrder: 0 },
  { fieldKey: 'client_name', displayName: 'Client Name', dataType: 'text', required: false, editable: true, systemField: true, displayOrder: 1 },
  {
    fieldKey: 'matter_description',
    displayName: 'Matter Description',
    dataType: 'multiline_text',
    required: false,
    editable: true,
    systemField: true,
    displayOrder: 2,
  },
  {
    fieldKey: 'matter_status',
    displayName: 'Matter Status',
    dataType: 'single_select',
    allowedValues: [
      { id: 'active', label: 'Active' },
      { id: 'on_hold', label: 'On Hold' },
      { id: 'closed', label: 'Closed' },
    ],
    required: true,
    editable: true,
    systemField: true,
    displayOrder: 3,
  },
  { fieldKey: 'matter_value', displayName: 'Matter Value', dataType: 'decimal', required: false, editable: true, systemField: true, displayOrder: 4 },
  {
    fieldKey: 'currency',
    displayName: 'Currency',
    dataType: 'single_select',
    allowedValues: [
      { id: 'gbp', label: 'GBP' },
      { id: 'usd', label: 'USD' },
      { id: 'eur', label: 'EUR' },
    ],
    required: false,
    editable: true,
    systemField: true,
    displayOrder: 5,
  },
  { fieldKey: 'start_date', displayName: 'Start Date', dataType: 'date', required: false, editable: true, systemField: true, displayOrder: 6 },
  { fieldKey: 'completion_date', displayName: 'Completion Date', dataType: 'date', required: false, editable: true, systemField: true, displayOrder: 7 },
  { fieldKey: 'workspace_id', displayName: 'Workspace ID', dataType: 'text', required: true, editable: false, systemField: true, displayOrder: 8 },
  { fieldKey: 'imanage_library', displayName: 'iManage Library', dataType: 'text', required: false, editable: false, systemField: true, displayOrder: 9 },
]

function classificationFieldSeeds(): Array<Omit<typeof matterFieldDefinitions.$inferInsert, 'id'>> {
  return CLASSIFICATION_FIELDS.map((field, index) => ({
    fieldKey: field.id,
    displayName: field.label,
    description: '',
    dataType: 'single_select',
    allowedValues: field.choices.map((c) => ({ id: c.id, label: c.label })),
    required: false,
    editable: true,
    systemField: true,
    displayOrder: 10 + index,
  }))
}

/** Idempotent: safe to call on every server startup (see index.ts) -- inserts only field_keys that don't already exist, never overwrites an existing row (so a later hand-edit to a definition isn't silently reverted). */
export async function seedFieldDefinitions(): Promise<void> {
  const db = getDb()
  const seeds = [...classificationFieldSeeds(), ...PROFILE_FIELD_SEEDS]
  await db.insert(matterFieldDefinitions).values(seeds).onConflictDoNothing({ target: matterFieldDefinitions.fieldKey })
}

export async function listFieldDefinitions(): Promise<MatterFieldDefinition[]> {
  return getDb().select().from(matterFieldDefinitions).orderBy(asc(matterFieldDefinitions.displayOrder))
}

export async function getFieldDefinitionByKey(fieldKey: string): Promise<MatterFieldDefinition | undefined> {
  const [row] = await getDb().select().from(matterFieldDefinitions).where(eq(matterFieldDefinitions.fieldKey, fieldKey)).limit(1)
  return row
}

export async function getFieldDefinitionsByKeys(fieldKeys: string[]): Promise<MatterFieldDefinition[]> {
  if (fieldKeys.length === 0) return []
  return getDb().select().from(matterFieldDefinitions).where(inArray(matterFieldDefinitions.fieldKey, fieldKeys))
}

export async function getFieldDefinitionById(id: string, db: Db = getDb()): Promise<MatterFieldDefinition | undefined> {
  const [row] = await db.select().from(matterFieldDefinitions).where(eq(matterFieldDefinitions.id, id)).limit(1)
  return row
}

export interface CreateFieldDefinitionInput {
  fieldKey: string
  displayName: string
  description?: string
  dataType: MatterFieldDefinition['dataType']
  allowedValues?: Array<{ id: string; label: string }> | null
  required?: boolean
  editable?: boolean
  displayOrder?: number
}

/** `systemField` is always false here -- only seedFieldDefinitions() inserts true rows. */
export async function createFieldDefinition(input: CreateFieldDefinitionInput, db: Db = getDb()): Promise<MatterFieldDefinition> {
  const [row] = await db
    .insert(matterFieldDefinitions)
    .values({
      fieldKey: input.fieldKey,
      displayName: input.displayName,
      description: input.description ?? '',
      dataType: input.dataType,
      allowedValues: input.allowedValues ?? null,
      required: input.required ?? false,
      editable: input.editable ?? true,
      systemField: false,
      displayOrder: input.displayOrder ?? 0,
    })
    .returning()
  return row!
}

export interface UpdateFieldDefinitionInput {
  displayName?: string
  description?: string
  allowedValues?: Array<{ id: string; label: string }> | null
  required?: boolean
  editable?: boolean
  displayOrder?: number
  expectedVersion: number
}

/** Same `WHERE id=... AND version=expectedVersion` idiom as profileRepository.updateFieldValueWithConcurrencyCheck -- never accepts `fieldKey`/`dataType`/`systemField`, which are immutable after creation. */
export async function updateFieldDefinitionWithConcurrencyCheck(
  id: string,
  input: UpdateFieldDefinitionInput,
  db: Db = getDb(),
): Promise<MatterFieldDefinition> {
  const [row] = await db
    .update(matterFieldDefinitions)
    .set({
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.allowedValues !== undefined ? { allowedValues: input.allowedValues } : {}),
      ...(input.required !== undefined ? { required: input.required } : {}),
      ...(input.editable !== undefined ? { editable: input.editable } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      updatedAt: new Date(),
      version: sql`${matterFieldDefinitions.version} + 1`,
    })
    .where(and(eq(matterFieldDefinitions.id, id), eq(matterFieldDefinitions.version, input.expectedVersion)))
    .returning()

  if (!row) throw new ConcurrencyConflictError()
  return row
}

export async function deleteFieldDefinition(id: string, db: Db = getDb()): Promise<void> {
  await db.delete(matterFieldDefinitions).where(eq(matterFieldDefinitions.id, id))
}
