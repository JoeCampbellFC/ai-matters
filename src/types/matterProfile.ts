/**
 * Mirrors server/src/classification/types.ts (API-facing MatterProfile
 * projection) -- kept hand-in-sync with the backend, same convention as
 * Workspace mirroring workspaceMapper.ts. Field and value ids are treated as
 * opaque strings here; the canonical taxonomies (labels/descriptions/
 * guidance) live server-side only and are fetched via matterProfileApi's
 * fetchClassificationFields, never duplicated.
 */
export type ClassificationStatus = 'pending' | 'classified' | 'review_recommended' | 'needs_review' | 'failed'

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
  fieldId: string
  valueId: string
  label: string
  correctedBy: string
  correctedAt: string
}

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
}

export interface MatterProfile {
  workspaceId: string
  workspaceName?: string
  outdated: boolean
  source?: {
    researchRunId: string
    markdownArtifactId: string
    markdownVersion: number
    markdownHash: string
    documentsUsed: number
  }
  fields: MatterProfileField[]
}
