import { randomUUID } from 'node:crypto'
import { config } from '../config.js'
import { buildClassificationInput, hashMarkdown } from './classificationInputBuilder.js'
import { classifyChoice } from './decisionsClient.js'
import { statusForChoice, ManualCorrectionInputSchema } from './classificationValidator.js'
import {
  getLatestMarkdownArtifact,
  getMarkdownArtifact,
  getProfileRecord,
  recordFieldClassificationFailure,
  recordManualCorrection,
  saveMarkdownArtifact,
  upsertFieldClassification,
} from './classificationRepository.js'
import { CLASSIFICATION_FIELDS, getChoiceLabel, isKnownChoice } from './classificationFields.js'
import type { ClassificationFieldId, ClassificationFieldDefinition } from './classificationFields.js'
import { TAXONOMY_VERSION } from './matterTypes.js'
import { ClassificationInProgressError, DecisionsRequestError, MarkdownNotReadyError, MatterProfileNotFoundError } from './errors.js'
import type { ClassificationProbability, ClassificationRecord, MatterProfile, MatterProfileField } from './types.js'

export interface ClassificationEventSink {
  onStarted?: () => void
  onFieldStarted?: (fieldId: ClassificationFieldId, fieldLabel: string) => void
  onFieldCompleted?: (field: MatterProfileField) => void
  onFieldFailed?: (fieldId: ClassificationFieldId, fieldLabel: string, error: { code: string; message: string }) => void
  onCompleted?: (profile: MatterProfile) => void
  onFailed?: (error: { code: string; message: string }) => void
}

export interface ClassifyFromRunInput {
  sessionId: string
  workspaceId: string
  workspaceName?: string
  researchRunId: string
  markdown: string
  documentsUsed: number
}

/** Guards against duplicate concurrent classification batches for the same session+workspace -- not persisted, reset naturally on restart. */
const inFlightWorkspaces = new Set<string>()

function workspaceKey(sessionId: string, workspaceId: string): string {
  return `${sessionId}:${workspaceId}`
}

/**
 * Entry point called automatically once a Phase 2 research run succeeds
 * (never from a client-supplied Markdown payload) -- persists the completed
 * Markdown as a new durable artifact, then classifies every field against
 * it. Never runs on an incomplete or failed run; callers only invoke this
 * from the run-succeeded path.
 */
export async function classifyFromCompletedRun(
  input: ClassifyFromRunInput,
  sink?: ClassificationEventSink,
): Promise<MatterProfile> {
  if (!input.markdown || input.markdown.trim().length === 0) {
    throw new MarkdownNotReadyError('The completed research run produced empty Markdown -- nothing to classify.')
  }

  const artifact = saveMarkdownArtifact({
    sessionId: input.sessionId,
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    researchRunId: input.researchRunId,
    markdown: input.markdown,
    markdownHash: hashMarkdown(input.markdown),
    documentsUsed: input.documentsUsed,
  })

  return classifyAllFields(
    { sessionId: input.sessionId, workspaceId: input.workspaceId, workspaceName: input.workspaceName, artifactId: artifact.id },
    sink,
  )
}

/** Reruns the Decisions API (every field) against the existing latest artifact -- never triggers Phase 2 research. */
export async function reclassifyLatestArtifact(
  sessionId: string,
  workspaceId: string,
  sink?: ClassificationEventSink,
): Promise<MatterProfile> {
  const artifact = getLatestMarkdownArtifact(sessionId, workspaceId)
  if (!artifact) throw new MarkdownNotReadyError()
  return classifyAllFields({ sessionId, workspaceId, workspaceName: artifact.workspaceName, artifactId: artifact.id }, sink)
}

async function classifyOneField(
  field: ClassificationFieldDefinition,
  evidenceText: string,
  artifact: { id: string; markdownHash: string },
  mode: 'full' | 'reduced',
): Promise<ClassificationRecord> {
  const deploymentName = config.azureOpenAiDecisionsDeploymentName
  const baseRecord = {
    id: randomUUID(),
    fieldId: field.id,
    markdownArtifactId: artifact.id,
    markdownHash: artifact.markdownHash,
    model: 'gpt-6-luna',
    deploymentName,
    taxonomyVersion: TAXONOMY_VERSION,
    inputMode: mode,
    classifiedAt: new Date().toISOString(),
  }

  const answer = await classifyChoice({
    questionName: field.questionName,
    instructions: field.instructions,
    evidenceText,
    choices: field.choices.map((c) => ({ value: c.id, description: c.description ?? c.label })),
  })

  if (answer.type === 'refusal') {
    // A refusal is marked for human review, never papered over with an invented category.
    return { ...baseRecord, status: 'needs_review', valueId: null, label: null, confidence: null, probabilities: [] }
  }

  if (!isKnownChoice(field.id, answer.choice)) {
    throw new DecisionsRequestError(`The Decisions API returned an unrecognized "${field.id}" value: "${answer.choice}".`)
  }

  const probabilities: ClassificationProbability[] = answer.probabilities
    .filter((p) => isKnownChoice(field.id, p.value))
    .map((p) => ({ id: p.value, label: getChoiceLabel(field.id, p.value), probability: p.probability }))

  return {
    ...baseRecord,
    status: statusForChoice(field.id, answer.choice, answer.confidence),
    valueId: answer.choice,
    label: getChoiceLabel(field.id, answer.choice),
    confidence: answer.confidence,
    probabilities,
  }
}

function toFieldView(record: ClassificationRecord, fieldLabel: string, override?: MatterProfileField['override']): MatterProfileField {
  if (override) {
    return {
      fieldId: record.fieldId,
      fieldLabel,
      valueId: override.valueId,
      label: override.label,
      confidence: record.confidence,
      status: 'classified',
      probabilities: record.probabilities,
      override,
    }
  }
  return {
    fieldId: record.fieldId,
    fieldLabel,
    valueId: record.valueId,
    label: record.label,
    confidence: record.confidence,
    status: record.status,
    probabilities: record.probabilities,
    error: record.error,
  }
}

/**
 * Classifies every field independently (one Decisions API call each, same
 * Markdown as evidence for all of them) so that one field's failure never
 * blocks the other 15 from completing -- each field's own try/catch records
 * success or failure and reports progress via the sink before moving on.
 */
async function classifyAllFields(
  ctx: { sessionId: string; workspaceId: string; workspaceName?: string; artifactId: string },
  sink?: ClassificationEventSink,
): Promise<MatterProfile> {
  const key = workspaceKey(ctx.sessionId, ctx.workspaceId)
  if (inFlightWorkspaces.has(key)) {
    throw new ClassificationInProgressError()
  }
  const artifact = getMarkdownArtifact(ctx.artifactId)
  if (!artifact) throw new MarkdownNotReadyError()

  inFlightWorkspaces.add(key)
  sink?.onStarted?.()

  try {
    const { text, mode } = buildClassificationInput(artifact.markdown)

    for (const field of CLASSIFICATION_FIELDS) {
      sink?.onFieldStarted?.(field.id, field.label)
      try {
        const record = await classifyOneField(field, text, artifact, mode)
        upsertFieldClassification({ sessionId: ctx.sessionId, workspaceId: ctx.workspaceId, workspaceName: ctx.workspaceName, record })
        sink?.onFieldCompleted?.(toFieldView(record, field.label))
      } catch (error) {
        const classified =
          error instanceof Error ? { code: error.name, message: error.message } : { code: 'unknown_error', message: 'Classification failed.' }
        recordFieldClassificationFailure(ctx.sessionId, ctx.workspaceId, ctx.workspaceName, field.id, classified)
        sink?.onFieldFailed?.(field.id, field.label, classified)
      }
    }

    const profile = toMatterProfile(ctx.sessionId, ctx.workspaceId)
    if (!profile) throw new MatterProfileNotFoundError()
    sink?.onCompleted?.(profile)
    return profile
  } catch (error) {
    const classified =
      error instanceof Error ? { code: error.name, message: error.message } : { code: 'unknown_error', message: 'Classification failed.' }
    sink?.onFailed?.(classified)
    throw error
  } finally {
    inFlightWorkspaces.delete(key)
  }
}

export function recordManualClassificationCorrection(
  sessionId: string,
  workspaceId: string,
  input: { fieldId: string; valueId: string; correctedBy: string },
): MatterProfile {
  const parsed = ManualCorrectionInputSchema.parse(input)
  const existing = getProfileRecord(sessionId, workspaceId)
  if (!existing) throw new MatterProfileNotFoundError()

  recordManualCorrection(sessionId, workspaceId, {
    fieldId: parsed.fieldId as ClassificationFieldId,
    valueId: parsed.valueId,
    label: getChoiceLabel(parsed.fieldId, parsed.valueId),
    correctedBy: parsed.correctedBy,
    correctedAt: new Date().toISOString(),
  })

  const profile = toMatterProfile(sessionId, workspaceId)
  if (!profile) throw new MatterProfileNotFoundError()
  return profile
}

/** Projects the durable record into the API-facing shape, computing `outdated` against the latest artifact. */
export function toMatterProfile(sessionId: string, workspaceId: string): MatterProfile | undefined {
  const profile = getProfileRecord(sessionId, workspaceId)
  if (!profile) return undefined

  const latestArtifact = getLatestMarkdownArtifact(sessionId, workspaceId)
  const anyRecord = Object.values(profile.fields)[0]
  const outdated = Boolean(anyRecord && latestArtifact && anyRecord.markdownHash !== latestArtifact.markdownHash)

  const fields: MatterProfileField[] = CLASSIFICATION_FIELDS.map((field) => {
    const override = profile.overrides[field.id]
    const record = profile.fields[field.id]
    if (record) return toFieldView(record, field.label, override)

    const error = profile.lastErrors[field.id]
    return {
      fieldId: field.id,
      fieldLabel: field.label,
      valueId: null,
      label: null,
      confidence: null,
      status: error ? 'failed' : 'pending',
      probabilities: [],
      error,
    }
  })

  // Any classified field's artifact reference describes the whole profile (all fields share one artifact per classification pass).
  const sourceRecord = Object.values(profile.fields)[0]
  const artifact = sourceRecord ? getMarkdownArtifact(sourceRecord.markdownArtifactId) : latestArtifact

  return {
    workspaceId,
    workspaceName: profile.workspaceName,
    outdated,
    source: artifact
      ? {
          researchRunId: artifact.researchRunId,
          markdownArtifactId: artifact.id,
          markdownVersion: artifact.version,
          markdownHash: artifact.markdownHash,
          documentsUsed: artifact.documentsUsed,
        }
      : undefined,
    fields,
  }
}
