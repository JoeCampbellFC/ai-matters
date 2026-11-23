/**
 * Mirrors server/src/classification/types.ts (API-facing MatterProfile
 * projection) -- kept hand-in-sync with the backend, same convention as
 * Workspace mirroring workspaceMapper.ts. Matter type ids are treated as
 * opaque strings here; the canonical taxonomy (labels/descriptions/
 * guidance) lives server-side only and is fetched via matterProfileApi's
 * fetchMatterTypeOptions, never duplicated.
 */
export type ClassificationStatus = 'classified' | 'review_recommended' | 'needs_review' | 'failed'

export type ClassificationInputMode = 'full' | 'reduced'

export interface MatterTypeOption {
  id: string
  label: string
}

export interface MatterTypeProbability {
  id: string
  label: string
  probability: number
}

export interface ManualCorrection {
  matterTypeId: string
  label: string
  correctedBy: string
  correctedAt: string
}

export interface MatterProfile {
  workspaceId: string
  workspaceName?: string
  matterType: {
    id: string | null
    label: string | null
    confidence: number | null
    status: ClassificationStatus
  }
  classification?: {
    model: string
    deploymentName: string
    method: 'azure-decisions-api'
    classifiedAt: string
    taxonomyVersion: string
    probabilities: MatterTypeProbability[]
    inputMode: ClassificationInputMode
  }
  source?: {
    researchRunId: string
    markdownArtifactId: string
    markdownVersion: number
    markdownHash: string
    documentsUsed: number
  }
  override?: ManualCorrection
  outdated: boolean
  error?: { code: string; message: string }
}
