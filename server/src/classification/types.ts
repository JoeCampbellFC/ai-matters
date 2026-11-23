export type { ClassificationFieldId } from './classificationFields.js'
import type { ClassificationFieldId } from './classificationFields.js'

export type ClassificationInputMode = 'full' | 'reduced'

export type ClassificationStatus = 'pending' | 'classified' | 'review_recommended' | 'needs_review' | 'failed'

export interface ClassificationProbability {
  id: string
  label: string
  probability: number
}

/** One Decisions API call's result for one field against one specific MarkdownArtifact. */
export interface ClassificationRecord {
  id: string
  fieldId: ClassificationFieldId
  markdownArtifactId: string
  markdownHash: string
  status: ClassificationStatus
  valueId: string | null
  label: string | null
  confidence: number | null
  probabilities: ClassificationProbability[]
  model: string
  deploymentName: string
  taxonomyVersion: string
  inputMode: ClassificationInputMode
  classifiedAt: string
  error?: { code: string; message: string }
}

/** A user's explicit correction for one field, layered on top of (never replacing) the AI result. */
export interface ManualCorrection {
  fieldId: ClassificationFieldId
  valueId: string
  label: string
  correctedBy: string
  correctedAt: string
}

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

/** Durable, per session+workspace record -- what classificationRepository.ts persists. */
export interface MatterProfileRecord {
  sessionId: string
  workspaceId: string
  workspaceName?: string
  /** Keyed by fieldId -- the current classification result for each field classified so far. */
  fields: Partial<Record<ClassificationFieldId, ClassificationRecord>>
  /** Keyed by fieldId -- prior classifications, retained for audit once superseded by a newer artifact. */
  history: Partial<Record<ClassificationFieldId, ClassificationRecord[]>>
  /** Keyed by fieldId -- manual overrides, independent per field. */
  overrides: Partial<Record<ClassificationFieldId, ManualCorrection>>
  /** Keyed by fieldId -- most recent failed attempt, kept only until the next successful classification of that field. */
  lastErrors: Partial<Record<ClassificationFieldId, { code: string; message: string; at: string }>>
  updatedAt: string
}

/** API-facing projection of a single field's classification state. */
export interface MatterProfileField {
  fieldId: ClassificationFieldId
  fieldLabel: string
  valueId: string | null
  label: string | null
  confidence: number | null
  status: ClassificationStatus
  probabilities: ClassificationProbability[]
  override?: ManualCorrection
  error?: { code: string; message: string }
}

/** API-facing projection of a MatterProfileRecord -- never exposes other sessions' data or raw Markdown. */
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
  /** One entry per classification dimension, in CLASSIFICATION_FIELDS order. */
  fields: MatterProfileField[]
}
