/**
 * Mirrors server/src/services/types.ts (API-facing MatterProfile projection)
 * -- kept hand-in-sync with the backend, same convention as Workspace
 * mirroring workspaceMapper.ts. Field and value ids are treated as opaque
 * strings here; the canonical taxonomies (labels/descriptions/guidance)
 * live server-side only and are fetched via matterProfileApi's
 * fetchClassificationFields, never duplicated.
 */
export type ClassificationStatus = 'pending' | 'classified' | 'review_recommended' | 'needs_review' | 'failed'

export type MatterFieldDataType =
  | 'text'
  | 'multiline_text'
  | 'number'
  | 'decimal'
  | 'date'
  | 'boolean'
  | 'single_select'
  | 'multi_select'

export interface ClassificationFieldOption {
  fieldId: string
  label: string
  choices: Array<{ id: string; label: string }>
}

export interface ClassificationProbability {
  id: string
  label: string
  probability: number
}

export interface ManualCorrection {
  valueId: string
  label: string
  correctedBy: string
  correctedAt: string
}

/** One of the 16 Phase 3 AI-classified dimensions. */
export interface MatterProfileField {
  fieldId: string
  fieldLabel: string
  valueId: string | null
  label: string | null
  confidence: number | null
  status: ClassificationStatus
  probabilities: ClassificationProbability[]
  override?: ManualCorrection
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

export interface MatterSummary {
  workspaceId: string
  workspaceName: string | null
  status: string
  hasKnowledge: boolean
  updatedAt: string
}
