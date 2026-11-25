import { CLASSIFICATION_FIELDS } from '../classification/classificationFields.js'
import { FieldDefinitionNotFoundError, SystemDefaultImmutableError, ValidationError } from '../database/errors.js'
import {
  type CreateFieldDefinitionInput,
  type MatterFieldDefinition,
  type UpdateFieldDefinitionInput,
  createFieldDefinition,
  deleteFieldDefinition as deleteFieldDefinitionRow,
  getFieldDefinitionById,
  getFieldDefinitionByKey,
  listFieldDefinitions,
  updateFieldDefinitionWithConcurrencyCheck,
} from '../database/repositories/fieldDefinitionRepository.js'

const CLASSIFICATION_FIELD_IDS = new Set<string>(CLASSIFICATION_FIELDS.map((field) => field.id))
const SELECT_DATA_TYPES = new Set(['single_select', 'multi_select'])

export interface AdminFieldDefinition extends MatterFieldDefinition {
  /** True for the 16 AI-classified dimensions -- editing displayName/description/allowedValues here is catalog-only and does not change classification/Decisions API behavior or the Matter Profile correction dropdown, both of which read from classification/classificationFields.ts instead. */
  isAiClassified: boolean
}

function withAiClassifiedFlag(row: MatterFieldDefinition): AdminFieldDefinition {
  return { ...row, isAiClassified: CLASSIFICATION_FIELD_IDS.has(row.fieldKey) }
}

export async function listFieldDefinitionsForAdmin(): Promise<AdminFieldDefinition[]> {
  const rows = await listFieldDefinitions()
  return rows.map(withAiClassifiedFlag)
}

function validateAllowedValues(dataType: string, allowedValues: Array<{ id: string; label: string }> | null | undefined): void {
  if (!SELECT_DATA_TYPES.has(dataType)) return
  if (!allowedValues || allowedValues.length === 0) {
    throw new ValidationError(`A ${dataType === 'single_select' ? 'single-select' : 'multi-select'} field needs at least one allowed value.`)
  }
  const ids = new Set(allowedValues.map((v) => v.id))
  if (ids.size !== allowedValues.length) {
    throw new ValidationError('Allowed value ids must be unique.')
  }
}

export async function createCustomFieldDefinition(input: CreateFieldDefinitionInput): Promise<AdminFieldDefinition> {
  if (CLASSIFICATION_FIELD_IDS.has(input.fieldKey)) {
    throw new ValidationError(`"${input.fieldKey}" is a reserved field key used by AI classification.`)
  }
  const existing = await getFieldDefinitionByKey(input.fieldKey)
  if (existing) {
    throw new ValidationError(`A field with key "${input.fieldKey}" already exists.`)
  }
  validateAllowedValues(input.dataType, input.allowedValues)
  const row = await createFieldDefinition(input)
  return withAiClassifiedFlag(row)
}

/**
 * displayName/description/allowedValues/required/editable/displayOrder are
 * editable on every row, including the 16 AI-classified and 10 profile
 * system fields -- that's the point of this admin screen. `fieldKey` and
 * `dataType` are never accepted here: they're immutable after creation for
 * every row (system and custom alike), since fieldKey strings are matched
 * exactly elsewhere in the classification code.
 */
export async function updateFieldDefinition(id: string, input: UpdateFieldDefinitionInput): Promise<AdminFieldDefinition> {
  const existing = await getFieldDefinitionById(id)
  if (!existing) throw new FieldDefinitionNotFoundError()
  if (input.allowedValues !== undefined) {
    validateAllowedValues(existing.dataType, input.allowedValues)
  }
  const row = await updateFieldDefinitionWithConcurrencyCheck(id, input)
  return withAiClassifiedFlag(row)
}

/**
 * Deleting a custom field permanently destroys every matter's stored value
 * for it (matterFieldValues.fieldDefinitionId cascades on delete) -- the
 * caller (route/UI) must make this explicit to the user, not just "are you
 * sure".
 */
export async function deleteFieldDefinition(id: string): Promise<void> {
  const existing = await getFieldDefinitionById(id)
  if (!existing) throw new FieldDefinitionNotFoundError()
  if (existing.systemField) throw new SystemDefaultImmutableError('System matter fields cannot be deleted.')
  await deleteFieldDefinitionRow(id)
}
