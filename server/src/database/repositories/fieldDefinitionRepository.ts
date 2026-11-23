import { asc, eq, inArray } from 'drizzle-orm'
import { CLASSIFICATION_FIELDS } from '../../classification/classificationFields.js'
import { getDb } from '../connection.js'
import { matterFieldDefinitions } from '../schema/matterFields.js'

export type MatterFieldDefinition = typeof matterFieldDefinitions.$inferSelect

/**
 * Pure-profile fields with no AI classifier -- the 16 Phase 3 dimensions are
 * seeded separately below, straight from classificationFields.ts, so their
 * choices are never duplicated/hand-copied here (see PLAN decision #4: no
 * second taxonomy).
 */
const PROFILE_FIELD_SEEDS: Array<Omit<typeof matterFieldDefinitions.$inferInsert, 'id'>> = [
  { fieldKey: 'matter_name', displayName: 'Matter Name', dataType: 'text', required: true, editable: true, systemField: false, displayOrder: 0 },
  { fieldKey: 'client_name', displayName: 'Client Name', dataType: 'text', required: false, editable: true, systemField: false, displayOrder: 1 },
  {
    fieldKey: 'matter_description',
    displayName: 'Matter Description',
    dataType: 'multiline_text',
    required: false,
    editable: true,
    systemField: false,
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
    systemField: false,
    displayOrder: 3,
  },
  { fieldKey: 'matter_value', displayName: 'Matter Value', dataType: 'decimal', required: false, editable: true, systemField: false, displayOrder: 4 },
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
    systemField: false,
    displayOrder: 5,
  },
  { fieldKey: 'start_date', displayName: 'Start Date', dataType: 'date', required: false, editable: true, systemField: false, displayOrder: 6 },
  { fieldKey: 'completion_date', displayName: 'Completion Date', dataType: 'date', required: false, editable: true, systemField: false, displayOrder: 7 },
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
