import { randomUUID } from 'node:crypto'
import { config } from '../config.js'
import { buildClassificationInput, hashMarkdown } from './classificationInputBuilder.js'
import { classifyChoice } from './decisionsClient.js'
import { statusForChoice, ManualCorrectionInputSchema } from './classificationValidator.js'
import {
  getLatestMarkdownArtifact,
  getMarkdownArtifact,
  getProfileRecord,
  recordClassificationFailure,
  recordManualCorrection,
  saveMarkdownArtifact,
  upsertClassification,
} from './classificationRepository.js'
import {
  ALL_CLASSIFICATION_CHOICES,
  TAXONOMY_VERSION,
  getMatterTypeLabel,
  isKnownMatterTypeChoice,
} from './matterTypes.js'
import { ClassificationInProgressError, DecisionsRequestError, MarkdownNotReadyError, MatterProfileNotFoundError } from './errors.js'
import type { ClassificationRecord, MatterProfile, MatterTypeChoiceId, MatterTypeProbability } from './types.js'

const CLASSIFICATION_QUESTION_NAME = 'matter_type'

const CLASSIFICATION_INSTRUCTIONS = [
  'Determine the primary legal matter type described in this Matter Knowledge File.',
  'Classify based on the overall legal engagement, principal activities undertaken, purpose of the matter and substantive deliverables.',
  'Do not classify solely by the client industry, names of documents, the presence of particular legal terminology or incidental secondary work.',
  'Where multiple categories are relevant, select the category that best represents the central purpose of the engagement.',
  'If the evidence is insufficient, contradictory or does not support any category, select Unclear / Other.',
].join(' ')

/** Guards against duplicate concurrent jobs for the same session+workspace -- not persisted, reset naturally on restart. */
const inFlightWorkspaces = new Set<string>()

function workspaceKey(sessionId: string, workspaceId: string): string {
  return `${sessionId}:${workspaceId}`
}

export interface ClassificationEventSink {
  onStarted?: () => void
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

/**
 * Entry point called automatically once a Phase 2 research run succeeds
 * (never from a client-supplied Markdown payload) -- persists the completed
 * Markdown as a new durable artifact, then classifies it. Never runs on an
 * incomplete or failed run; callers only invoke this from the run-succeeded
 * path.
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

  return runClassification(
    { sessionId: input.sessionId, workspaceId: input.workspaceId, workspaceName: input.workspaceName, artifactId: artifact.id },
    sink,
  )
}

/** Reruns the Decisions API against the existing latest artifact -- never triggers Phase 2 research. */
export async function reclassifyLatestArtifact(
  sessionId: string,
  workspaceId: string,
  sink?: ClassificationEventSink,
): Promise<MatterProfile> {
  const artifact = getLatestMarkdownArtifact(sessionId, workspaceId)
  if (!artifact) throw new MarkdownNotReadyError()
  return runClassification(
    { sessionId, workspaceId, workspaceName: artifact.workspaceName, artifactId: artifact.id },
    sink,
  )
}

async function runClassification(
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
    const choices = ALL_CLASSIFICATION_CHOICES.map((def) => ({
      value: def.id,
      description: `${def.label}: ${def.description} ${def.guidance}`,
    }))

    const answer = await classifyChoice({
      questionName: CLASSIFICATION_QUESTION_NAME,
      instructions: CLASSIFICATION_INSTRUCTIONS,
      evidenceText: text,
      choices,
    })

    const deploymentName = config.azureOpenAiDecisionsDeploymentName
    const baseRecord = {
      id: randomUUID(),
      markdownArtifactId: artifact.id,
      markdownHash: artifact.markdownHash,
      model: 'gpt-6-luna',
      deploymentName,
      taxonomyVersion: TAXONOMY_VERSION,
      inputMode: mode,
      classifiedAt: new Date().toISOString(),
    }

    let record: ClassificationRecord
    if (answer.type === 'refusal') {
      // A refusal is marked for human review, never papered over with an invented category.
      record = { ...baseRecord, status: 'needs_review', matterTypeId: null, label: null, confidence: null, probabilities: [] }
    } else {
      if (!isKnownMatterTypeChoice(answer.choice)) {
        throw new DecisionsRequestError(`The Decisions API returned an unrecognized matter type id: "${answer.choice}".`)
      }
      const matterTypeId = answer.choice
      const probabilities: MatterTypeProbability[] = answer.probabilities
        .filter((p): p is { value: MatterTypeChoiceId; probability: number } => isKnownMatterTypeChoice(p.value))
        .map((p) => ({ id: p.value, label: getMatterTypeLabel(p.value), probability: p.probability }))
      record = {
        ...baseRecord,
        status: statusForChoice(matterTypeId, answer.confidence),
        matterTypeId,
        label: getMatterTypeLabel(matterTypeId),
        confidence: answer.confidence,
        probabilities,
      }
    }

    upsertClassification({ sessionId: ctx.sessionId, workspaceId: ctx.workspaceId, workspaceName: ctx.workspaceName, record })
    const profile = toMatterProfile(ctx.sessionId, ctx.workspaceId)
    if (!profile) throw new MatterProfileNotFoundError()
    sink?.onCompleted?.(profile)
    return profile
  } catch (error) {
    const classified =
      error instanceof Error ? { code: error.name, message: error.message } : { code: 'unknown_error', message: 'Classification failed.' }
    recordClassificationFailure(ctx.sessionId, ctx.workspaceId, ctx.workspaceName, classified)
    sink?.onFailed?.(classified)
    throw error
  } finally {
    inFlightWorkspaces.delete(key)
  }
}

export function recordManualClassificationCorrection(
  sessionId: string,
  workspaceId: string,
  input: { matterTypeId: string; correctedBy: string },
): MatterProfile {
  const parsed = ManualCorrectionInputSchema.parse(input)
  const existing = getProfileRecord(sessionId, workspaceId)
  if (!existing) throw new MatterProfileNotFoundError()

  recordManualCorrection(sessionId, workspaceId, {
    matterTypeId: parsed.matterTypeId as MatterTypeChoiceId,
    label: getMatterTypeLabel(parsed.matterTypeId as MatterTypeChoiceId),
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

  const current = profile.current
  const latestArtifact = getLatestMarkdownArtifact(sessionId, workspaceId)
  const outdated = Boolean(current && latestArtifact && current.markdownHash !== latestArtifact.markdownHash)

  const matterType = profile.override
    ? {
        id: profile.override.matterTypeId,
        label: profile.override.label,
        confidence: current?.confidence ?? null,
        status: 'classified' as const,
      }
    : current
      ? { id: current.matterTypeId, label: current.label, confidence: current.confidence, status: current.status }
      : { id: null, label: null, confidence: null, status: profile.lastError ? ('failed' as const) : ('needs_review' as const) }

  const artifact = current ? getMarkdownArtifact(current.markdownArtifactId) : undefined

  return {
    workspaceId,
    workspaceName: profile.workspaceName,
    matterType,
    classification: current
      ? {
          model: current.model,
          deploymentName: current.deploymentName,
          method: 'azure-decisions-api',
          classifiedAt: current.classifiedAt,
          taxonomyVersion: current.taxonomyVersion,
          probabilities: current.probabilities,
          inputMode: current.inputMode,
        }
      : undefined,
    source: artifact
      ? {
          researchRunId: artifact.researchRunId,
          markdownArtifactId: artifact.id,
          markdownVersion: artifact.version,
          markdownHash: artifact.markdownHash,
          documentsUsed: artifact.documentsUsed,
        }
      : undefined,
    override: profile.override,
    outdated,
    error: !current ? profile.lastError : undefined,
  }
}
