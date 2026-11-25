import type { MatterFieldDataType } from './matterProfile'

/** Mirrors server/src/services/fieldDefinitionService.ts's AdminFieldDefinition. */
export interface FieldDefinition {
  id: string
  fieldKey: string
  displayName: string
  description: string
  dataType: MatterFieldDataType
  allowedValues: Array<{ id: string; label: string }> | null
  required: boolean
  editable: boolean
  systemField: boolean
  displayOrder: number
  version: number
  createdAt: string
  updatedAt: string
  /** True for the 16 AI-classified dimensions -- editing this row here is catalog-only, see server-side doc comment. */
  isAiClassified: boolean
}
