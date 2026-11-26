import { config } from '../config.js'
import {
  CLASSIFICATION_FIELDS,
  getChoiceLabel,
  isKnownChoice,
  isKnownClassificationField,
  type ClassificationFieldDefinition,
  type ClassificationFieldId,
} from '../classification/classificationFields.js'
import { buildClassificationInput } from '../classification/classificationInputBuilder.js'
import { classifyChoice } from '../classification/decisionsClient.js'
import { statusForChoice } from '../classification/classificationValidator.js'
import { ClassificationInProgressError, DecisionsRequestError } from '../classification/errors.js'
import { TAXONOMY_VERSION } from '../classification/matterTypes.js'
import type { ClassificationProbability } from '../classification/types.js'
import { getDb } from '../database/connection.js'
import { getCurrentClassification, insertClassification } from '../database/repositories/classificationRepository.js'
import {
  getFieldDefinitionsByKeys,
  listFieldDefinitions,
  type MatterFieldDefinition,
} from '../database/repositories/fieldDefinitionRepository.js'
import { getCurrentVersion } from '../database/repositories/knowledgeRepository.js'
import { getMatterById, updateMatterMetadata, type Matter } from '../database/repositories/matterRepository.js'
import {
  getFieldValue,
  listFieldValues,
  updateFieldValueWithConcurrencyCheck,
  type MatterFieldValue,
} from '../database/repositories/profileRepository.js'
import { recordAuditEvent } from '../database/repositories/auditRepository.js'
import { MarkdownNotPublishedError, MatterNotFoundError } from '../database/errors.js'
import { validateFieldValue } from './fieldValueValidation.js'
import { publishGeneratedMarkdown } from './matterKnowledgeService.js'
import type { KnowledgeCitationEntry } from '../database/repositories/knowledgeRepository.js'
import type { MatterProfile, MatterProfileField, MatterProfileFieldView, ProfileFieldUpdate } from './types.js'

export interface ClassificationEventSink {
  onStarted?: () => void
  onFieldStarted?: (fieldId: ClassificationFieldId, fieldLabel: string) => void
  onFieldCompleted?: (field: MatterProfileField) => void
  onFieldFailed?: (fieldId: ClassificationFieldId, fieldLabel: string, error: { code: string; message: string }) => void
  onCompleted?: (profile: MatterProfile) => void
  onFailed?: (error: { code: string; message: string }) => void
}

/** Guards against duplicate concurrent classification batches for the same matter -- not persisted, reset naturally on restart (same behavior as pre-Phase-4). */
const inFlightMatters = new Set<string>()

function toErrorShape(error: unknown): { code: string; message: string } {
  return error instanceof Error ? { code: error.name, message: error.message } : { code: 'unknown_error', message: 'Classification failed.' }
}

interface FieldClassificationResult {
  selectedValueId: string | null
  label: string | null
  confidence: number | null
  probabilities: ClassificationProbability[]
  classificationStatus: string
}

async function classifyOneField(field: ClassificationFieldDefinition, evidenceText: string): Promise<FieldClassificationResult> {
  const answer = await classifyChoice({
    questionName: field.questionName,
    instructions: field.instructions,
    evidenceText,
    choices: field.choices.map((c) => ({ value: c.id, description: c.description ?? c.label })),
  })

  if (answer.type === 'refusal') {
    return { selectedValueId: null, label: null, confidence: null, probabilities: [], classificationStatus: 'needs_review' }
  }

  if (!isKnownChoice(field.id, answer.choice)) {
    throw new DecisionsRequestError(`The Decisions API returned an unrecognized "${field.id}" value: "${answer.choice}".`)
  }

  const probabilities: ClassificationProbability[] = answer.probabilities
    .filter((p) => isKnownChoice(field.id, p.value))
    .map((p) => ({ id: p.value, label: getChoiceLabel(field.id, p.value), probability: p.probability }))

  return {
    selectedValueId: answer.choice,
    label: getChoiceLabel(field.id, answer.choice),
    confidence: answer.confidence,
    probabilities,
    classificationStatus: statusForChoice(field.id, answer.choice, answer.confidence),
  }
}

/** Classifies every field independently (one Decisions API call each, same Markdown as evidence) so one field's failure never blocks the other 15. */
async function classifyAllFieldsForMatter(
  matterId: string,
  version: { id: string; content: string },
  actor: string,
  sink?: ClassificationEventSink,
): Promise<MatterProfile> {
  if (inFlightMatters.has(matterId)) {
    throw new ClassificationInProgressError()
  }
  inFlightMatters.add(matterId)
  sink?.onStarted?.()

  try {
    const { text } = buildClassificationInput(version.content)

    for (const field of CLASSIFICATION_FIELDS) {
      sink?.onFieldStarted?.(field.id, field.label)
      try {
        const result = await classifyOneField(field, text)
        await insertClassification({
          matterId,
          fieldId: field.id,
          markdownVersionId: version.id,
          taxonomyVersion: TAXONOMY_VERSION,
          selectedValueId: result.selectedValueId,
          label: result.label,
          confidence: result.confidence,
          probabilities: result.probabilities,
          classificationStatus: result.classificationStatus,
          modelDeployment: config.azureOpenAiDecisionsDeploymentName,
          classifiedAt: new Date(),
        })
        const view = await buildClassificationFieldView(matterId, field, version.id)
        sink?.onFieldCompleted?.(view)
      } catch (error) {
        const classified = toErrorShape(error)
        await insertClassification({
          matterId,
          fieldId: field.id,
          markdownVersionId: version.id,
          taxonomyVersion: TAXONOMY_VERSION,
          selectedValueId: null,
          label: null,
          confidence: null,
          probabilities: [],
          classificationStatus: 'failed',
          modelDeployment: config.azureOpenAiDecisionsDeploymentName,
          classifiedAt: new Date(),
          error: classified,
        })
        sink?.onFieldFailed?.(field.id, field.label, classified)
      }
    }

    await recordAuditEvent({
      matterId,
      entityType: 'matter_classification',
      entityId: version.id,
      action: 'classified',
      newValue: { markdownVersionId: version.id, fieldCount: CLASSIFICATION_FIELDS.length },
      changedBy: actor,
    })

    const profile = await getMatterProfile(matterId)
    sink?.onCompleted?.(profile)
    return profile
  } catch (error) {
    sink?.onFailed?.(toErrorShape(error))
    throw error
  } finally {
    inFlightMatters.delete(matterId)
  }
}

export interface ClassifyFromRunInput {
  matterId: string
  markdown: string
  researchRunId: string
  createdBy: string
  citationRegistry?: KnowledgeCitationEntry[]
}

/**
 * Entry point called automatically once a Phase 2 research run succeeds --
 * persists the completed Markdown as a new durable version (committing
 * before classification ever starts, per spec), then classifies every field
 * against it.
 */
export async function classifyFromCompletedRun(
  input: ClassifyFromRunInput,
  sink?: ClassificationEventSink,
): Promise<{ versionId: string; profile: MatterProfile }> {
  const version = await publishGeneratedMarkdown({
    matterId: input.matterId,
    markdown: input.markdown,
    researchRunId: input.researchRunId,
    createdBy: input.createdBy,
    citationRegistry: input.citationRegistry,
  })
  const profile = await classifyAllFieldsForMatter(input.matterId, version, input.createdBy, sink)
  return { versionId: version.id, profile }
}

/** Reruns the Decisions API (every field) against the existing current version -- never triggers Phase 2 research. */
export async function reclassifyCurrentVersion(matterId: string, actor: string, sink?: ClassificationEventSink): Promise<MatterProfile> {
  const version = await getCurrentVersion(matterId)
  if (!version) throw new MarkdownNotPublishedError()
  return classifyAllFieldsForMatter(matterId, version, actor, sink)
}

async function buildClassificationFieldView(matterId: string, field: ClassificationFieldDefinition, currentVersionId: string): Promise<MatterProfileField> {
  const [definition] = await getFieldDefinitionsByKeys([field.id])
  const [classification, overrideRow] = await Promise.all([
    currentVersionId ? getCurrentClassification(matterId, field.id, currentVersionId) : Promise.resolve(undefined),
    definition ? getFieldValue(matterId, definition.id) : Promise.resolve(undefined),
  ])

  const override =
    overrideRow && overrideRow.valueSource === 'user'
      ? {
          valueId: (overrideRow.value as { valueId: string; label: string }).valueId,
          label: (overrideRow.value as { valueId: string; label: string }).label,
          correctedBy: overrideRow.updatedBy,
          correctedAt: overrideRow.updatedAt.toISOString(),
        }
      : undefined

  if (override) {
    return {
      fieldId: field.id,
      fieldLabel: field.label,
      valueId: override.valueId,
      label: override.label,
      confidence: classification?.confidence ? Number(classification.confidence) : null,
      status: 'classified',
      probabilities: classification?.probabilities ?? [],
      override,
      version: overrideRow!.version,
    }
  }

  if (!classification) {
    return {
      fieldId: field.id,
      fieldLabel: field.label,
      valueId: null,
      label: null,
      confidence: null,
      status: 'pending',
      probabilities: [],
      version: overrideRow?.version ?? 0,
    }
  }

  return {
    fieldId: field.id,
    fieldLabel: field.label,
    valueId: classification.selectedValueId,
    label: classification.label,
    confidence: classification.confidence ? Number(classification.confidence) : null,
    status: classification.classificationStatus as MatterProfileField['status'],
    probabilities: classification.probabilities,
    error: classification.error ?? undefined,
    version: overrideRow?.version ?? 0,
  }
}

function dataTypeDefaultValue(dataType: MatterFieldDefinition['dataType']): unknown {
  return dataType === 'multi_select' ? [] : null
}

function buildProfileFieldView(definition: MatterFieldDefinition, valueRow: MatterFieldValue | undefined): MatterProfileFieldView {
  return {
    fieldKey: definition.fieldKey,
    displayName: definition.displayName,
    dataType: definition.dataType as MatterProfileFieldView['dataType'],
    required: definition.required,
    editable: definition.editable,
    allowedValues: definition.allowedValues ?? undefined,
    value: valueRow ? valueRow.value : dataTypeDefaultValue(definition.dataType as MatterFieldDefinition['dataType']),
    valueSource: valueRow ? (valueRow.valueSource as MatterProfileFieldView['valueSource']) : null,
    updatedBy: valueRow?.updatedBy,
    updatedAt: valueRow?.updatedAt.toISOString(),
    version: valueRow?.version ?? 0,
  }
}

/** Full API-facing projection: the matter, the 16 AI-classified fields, and the pure-profile fields. Never exposes other matters' data. */
export async function getMatterProfile(matterId: string): Promise<MatterProfile> {
  const matter = await getMatterById(matterId)
  if (!matter) throw new MatterNotFoundError()

  const version = await getCurrentVersion(matterId)

  const [fields, allDefinitions, fieldValues] = await Promise.all([
    Promise.all(CLASSIFICATION_FIELDS.map((field) => buildClassificationFieldView(matterId, field, version?.id ?? ''))),
    listFieldDefinitions(),
    listFieldValues(matterId),
  ])

  const valuesByDefinitionId = new Map(fieldValues.map((v) => [v.fieldDefinitionId, v]))
  const profileFields = allDefinitions
    .filter((d) => !isKnownClassificationField(d.fieldKey))
    .map((d) => buildProfileFieldView(d, valuesByDefinitionId.get(d.id)))

  // "Outdated" here means the current Markdown version hasn't been (fully) classified yet
  // (e.g. right after publish/edit, before classification/reclassification runs) -- a field
  // with a user override is never counted as pending, since its effective value is settled
  // regardless of the underlying AI classification's state.
  const outdated = version ? fields.some((f) => f.status === 'pending') : true

  return {
    matterId: matter.id,
    workspaceId: matter.workspaceId,
    workspaceName: matter.workspaceName ?? undefined,
    outdated,
    source: version
      ? {
          researchRunId: version.researchRunId,
          markdownVersionId: version.id,
          markdownVersion: version.versionNumber,
          markdownHash: version.contentHash,
        }
      : undefined,
    fields,
    profileFields,
  }
}

function resolveUpdateValue(definition: MatterFieldDefinition, rawValue: unknown): unknown {
  if (!isKnownClassificationField(definition.fieldKey)) {
    return validateFieldValue(definition, rawValue)
  }
  if (!isKnownChoice(definition.fieldKey, rawValue as string)) {
    throw new Error(`"${String(rawValue)}" is not a valid option for ${definition.displayName}.`)
  }
  return { valueId: rawValue as string, label: getChoiceLabel(definition.fieldKey, rawValue as string) }
}

/**
 * matter_field_values is the source of truth for every profile field, but
 * the `matters` row carries its own denormalized copies of client name and
 * status (clientName/status) for cheap, no-join reads -- e.g. the Workspaces
 * list's batch summary (matterRepository.listMattersByWorkspaceIds). Keeps
 * those copies from going stale whenever the corresponding profile field is
 * edited here.
 */
function matterMetadataFor(fieldKey: string, value: unknown): Partial<Pick<Matter, 'clientName' | 'status'>> {
  if (fieldKey === 'client_name') return { clientName: (value as string | null) ?? null }
  if (fieldKey === 'matter_status') return { status: (value as { valueId: string }).valueId }
  return {}
}

/**
 * Generalized field editor -- handles BOTH the 16 AI-field manual overrides
 * (value = the chosen choice id, re-expressed as {valueId,label}) and the
 * pure-profile fields (value = the raw typed value), through the same
 * optimistic-concurrency write path. Applied in one transaction: any single
 * field's conflict rolls back the whole batch rather than partially
 * applying it.
 */
export async function updateProfileFields(matterId: string, updates: ProfileFieldUpdate[], actor: string): Promise<MatterProfile> {
  const matter = await getMatterById(matterId)
  if (!matter) throw new MatterNotFoundError()
  if (updates.length === 0) return getMatterProfile(matterId)

  const definitions = await getFieldDefinitionsByKeys(updates.map((u) => u.fieldKey))
  const definitionsByKey = new Map(definitions.map((d) => [d.fieldKey, d]))

  await getDb().transaction(async (tx) => {
    let metadataUpdates: Partial<Pick<Matter, 'clientName' | 'status'>> = {}

    for (const update of updates) {
      const definition = definitionsByKey.get(update.fieldKey)
      if (!definition) throw new Error(`Unknown field key "${update.fieldKey}".`)
      if (!definition.editable) throw new Error(`Field "${definition.displayName}" is not editable.`)

      const value = resolveUpdateValue(definition, update.value)
      const before = await getFieldValue(matterId, definition.id, tx)
      const after = await updateFieldValueWithConcurrencyCheck(
        {
          matterId,
          fieldDefinitionId: definition.id,
          value,
          valueSource: 'user',
          updatedBy: actor,
          expectedVersion: update.expectedVersion,
        },
        tx,
      )
      await recordAuditEvent(
        {
          matterId,
          entityType: 'matter_field_value',
          entityId: definition.id,
          action: 'edited',
          fieldKey: update.fieldKey,
          previousValue: before?.value ?? null,
          newValue: after.value,
          changedBy: actor,
        },
        tx,
      )
      metadataUpdates = { ...metadataUpdates, ...matterMetadataFor(update.fieldKey, after.value) }
    }

    if (Object.keys(metadataUpdates).length > 0) {
      await updateMatterMetadata(matterId, metadataUpdates, tx)
    }
  })

  return getMatterProfile(matterId)
}
