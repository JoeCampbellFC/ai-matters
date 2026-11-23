import type { ClassificationFieldId } from '../classification/classificationFields.js'
import type { ClassificationProbability, ClassificationStatus } from '../classification/types.js'

export type MatterFieldDataType =
  | 'text'
  | 'multiline_text'
  | 'number'
  | 'decimal'
  | 'date'
  | 'boolean'
  | 'single_select'
  | 'multi_select'

/** One of the 16 Phase 3 AI-classified dimensions -- same API shape as before Phase 4, now Postgres-backed instead of the JSON file. */
export interface MatterProfileField {
  fieldId: ClassificationFieldId
  fieldLabel: string
  valueId: string | null
  label: string | null
  confidence: number | null
  status: ClassificationStatus
  probabilities: ClassificationProbability[]
  override?: { valueId: string; label: string; correctedBy: string; correctedAt: string }
  error?: { code: string; message: string }
  /** Optimistic-concurrency token for overriding this field (0 = no override saved yet). */
  version: number
}

/** A Phase 4 pure-profile field with no AI classifier -- Matter Name, Client Name, dates, etc. */
export interface MatterProfileFieldView {
  fieldKey: string
  displayName: string
  dataType: MatterFieldDataType
  required: boolean
  editable: boolean
  allowedValues?: Array<{ id: string; label: string }>
  value: unknown
  valueSource: 'iManage' | 'ai' | 'user' | 'system' | null
  updatedBy?: string
  updatedAt?: string
  /** Optimistic-concurrency token (0 = no value saved yet). */
  version: number
}

export interface MatterProfile {
  matterId: string
  workspaceId: string
  workspaceName?: string
  /** True when the matter's current Markdown version has not been classified at all yet (e.g. right after a manual edit, before Reclassify runs). */
  outdated: boolean
  source?: {
    researchRunId: string | null
    markdownVersionId: string
    markdownVersion: number
    markdownHash: string
  }
  fields: MatterProfileField[]
  profileFields: MatterProfileFieldView[]
}

export interface ProfileFieldUpdate {
  fieldKey: string
  value: unknown
  expectedVersion: number
}
