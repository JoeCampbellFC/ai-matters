export type { MatterTypeChoiceId } from './matterTypes.js'
import type { MatterTypeChoiceId } from './matterTypes.js'

export type ClassificationInputMode = 'full' | 'reduced'

export type ClassificationStatus = 'classified' | 'review_recommended' | 'needs_review' | 'failed'

/** A completed Matter Knowledge Markdown snapshot, durable and independent of the in-memory research run that produced it. */
export interface MarkdownArtifact {
  id: string
  sessionId: string
  workspaceId: string
  workspaceName?: string
  researchRunId: string
  /** Monotonically increasing per workspace -- 1 for the first successful run, 2 after a regeneration, etc. */
  version: number
  markdown: string
  markdownHash: string
  documentsUsed: number
  createdAt: string
}

export interface MatterTypeProbability {
  id: MatterTypeChoiceId
  label: string
  probability: number
}

/** One Decisions API call's result against one specific MarkdownArtifact. */
export interface ClassificationRecord {
  id: string
  markdownArtifactId: string
  markdownHash: string
  status: ClassificationStatus
  matterTypeId: MatterTypeChoiceId | null
  label: string | null
  confidence: number | null
  probabilities: MatterTypeProbability[]
  model: string
  deploymentName: string
  taxonomyVersion: string
  inputMode: ClassificationInputMode
  classifiedAt: string
  error?: { code: string; message: string }
}

/** A user's explicit correction, layered on top of (never replacing) the AI result. */
export interface ManualCorrection {
  matterTypeId: MatterTypeChoiceId
  label: string
  correctedBy: string
  correctedAt: string
}

/** Durable, per session+workspace record -- what classificationRepository.ts persists. */
export interface MatterProfileRecord {
  sessionId: string
  workspaceId: string
  workspaceName?: string
  current?: ClassificationRecord
  /** Prior classifications, retained for audit once superseded by a newer artifact. */
  history: ClassificationRecord[]
  override?: ManualCorrection
  updatedAt: string
}

/** API-facing projection of a MatterProfileRecord -- never exposes other sessions' data or raw Markdown. */
export interface MatterProfile {
  workspaceId: string
  workspaceName?: string
  matterType: {
    id: MatterTypeChoiceId | null
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

export type ClassificationEventType = 'classification_started' | 'classification_completed' | 'classification_failed'
