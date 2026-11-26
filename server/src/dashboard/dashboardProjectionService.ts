import { randomUUID } from 'node:crypto'
import { config } from '../config.js'
import { classifyAzureError, getAzureChatModel } from '../llm/azureOpenAI.js'
import { hashMarkdown } from '../classification/classificationInputBuilder.js'
import { getCurrentVersionOrThrow } from '../services/matterKnowledgeService.js'
import type { MatterKnowledgeVersion } from '../database/repositories/knowledgeRepository.js'
import { PROJECTION_SCHEMA_VERSION, getProjection, saveProjectionFailed, saveProjectionReady } from '../database/repositories/dashboardRepository.js'
import {
  MatterDashboardProjectionSchema,
  ProjectionExtractionSchema,
  type DashboardWidget,
  type MatterDashboardProjectionData,
  type ProjectionExtraction,
} from './projectionSchemas.js'

/** Reuses the classification input budget rather than inventing a new config knob -- same "don't resend a huge document" concern, same conservative cap. */
const MAX_INPUT_CHARS = config.classificationMaxInputChars

function buildPrompt(markdown: string, knownMarkers: string[]): string {
  const truncated = markdown.length > MAX_INPUT_CHARS ? `${markdown.slice(0, MAX_INPUT_CHARS)}\n\n[... Markdown truncated for length ...]` : markdown
  return [
    'You are converting a completed legal Matter Knowledge Markdown report into structured dashboard data for a legal professional.',
    'Extract ONLY what the Markdown actually states. Never invent information, never infer missing dates/values/people, and never add a factual claim the text does not support.',
    "Distinguish confirmed, completed events from planned, expected, or proposed ones -- a projected completion date is not proof of completion, and counsel's recommendation is not evidence the action was performed. Do not treat an absence of evidence as proof an event did not occur.",
    'Preserve exact names, dates, and identifiers exactly as written in the source. Preserve conflicting or uncertain statements rather than silently resolving them into one preferred conclusion.',
    knownMarkers.length > 0
      ? `Every citation marker you put in a sourceRefs array must be exactly one of these known markers from the document register: ${knownMarkers.join(', ')}. Never invent a marker that is not in this list.`
      : 'No document register markers are available for this matter -- leave every sourceRefs array empty rather than inventing one.',
    'Only include a timeline event, party, issue, outcome, or custom item if the Markdown actually contains substantive information about it -- an empty or near-empty array is the correct answer when nothing relevant is present, not a reason to invent filler content.',
    'Use the custom items list only for substantive information that genuinely does not fit the timeline, parties, issues, or outcomes categories.',
    'Write concise, factual descriptions -- a few sentences at most per item, never a restated essay.',
    '---',
    truncated,
  ].join('\n')
}

function keepKnownRefs(refs: string[], knownMarkers: Set<string>): string[] {
  return refs.filter((ref) => knownMarkers.has(ref))
}

/**
 * Converts the LLM's flat extraction into the discriminated-union widgets
 * the frontend renders -- an empty category produces no widget at all
 * (never an empty card), per the "widget visibility driven by supported
 * information" requirement. Source refs that don't resolve to a known
 * citation marker are dropped (not the whole item), since a single bad ref
 * shouldn't discard an otherwise well-supported fact.
 */
function assembleWidgets(extraction: ProjectionExtraction, knownMarkers: Set<string>): DashboardWidget[] {
  const widgets: DashboardWidget[] = []
  let order = 0

  if (extraction.overview) {
    widgets.push({
      id: randomUUID(),
      type: 'overview',
      title: 'Matter Overview',
      order: order++,
      summary: extraction.overview.summary,
      sourceRefs: keepKnownRefs(extraction.overview.sourceRefs, knownMarkers),
    })
  }
  if (extraction.timelineEvents.length > 0) {
    widgets.push({
      id: randomUUID(),
      type: 'timeline',
      title: 'Timeline',
      order: order++,
      events: extraction.timelineEvents.map((event) => ({ ...event, sourceRefs: keepKnownRefs(event.sourceRefs, knownMarkers) })),
    })
  }
  if (extraction.parties.length > 0) {
    widgets.push({
      id: randomUUID(),
      type: 'parties',
      title: 'Parties & People',
      order: order++,
      parties: extraction.parties.map((party) => ({ ...party, sourceRefs: keepKnownRefs(party.sourceRefs, knownMarkers) })),
    })
  }
  if (extraction.issues.length > 0) {
    widgets.push({
      id: randomUUID(),
      type: 'issues',
      title: 'Key Issues',
      order: order++,
      issues: extraction.issues.map((issue) => ({ ...issue, sourceRefs: keepKnownRefs(issue.sourceRefs, knownMarkers) })),
    })
  }
  if (extraction.outcomeItems.length > 0) {
    widgets.push({
      id: randomUUID(),
      type: 'outcomes',
      title: 'Outcomes & Next Steps',
      order: order++,
      items: extraction.outcomeItems.map((item) => ({ ...item, sourceRefs: keepKnownRefs(item.sourceRefs, knownMarkers) })),
    })
  }
  if (extraction.customItems.length > 0) {
    widgets.push({
      id: randomUUID(),
      type: 'custom',
      title: 'Additional Information',
      order,
      items: extraction.customItems.map((item) => ({ ...item, sourceRefs: keepKnownRefs(item.sourceRefs, knownMarkers) })),
    })
  }
  return widgets
}

export interface DashboardProjectionResult {
  projection: MatterDashboardProjectionData
  version: MatterKnowledgeVersion
  wasCached: boolean
}

/**
 * The single entry point: returns a cached projection for the matter's
 * current Markdown version if one already exists (zero LLM calls), otherwise
 * generates, validates, and persists one. Never regenerates the Markdown and
 * never reruns Phase 2 research -- purely a read-side transform of whatever
 * Markdown is already current.
 */
export async function getOrCreateDashboardProjection(matterId: string): Promise<DashboardProjectionResult> {
  const version = await getCurrentVersionOrThrow(matterId)

  const existing = await getProjection(matterId, version.id)
  if (existing?.status === 'ready' && existing.projectionJson) {
    return { projection: existing.projectionJson as MatterDashboardProjectionData, version, wasCached: true }
  }

  const knownMarkers = new Set((version.citationRegistry ?? []).map((entry) => entry.marker))
  const prompt = buildPrompt(version.content, [...knownMarkers])

  let extraction: ProjectionExtraction
  try {
    const model = getAzureChatModel().withStructuredOutput(ProjectionExtractionSchema)
    extraction = await model.invoke(prompt)
  } catch (error) {
    const classified = classifyAzureError(error)
    await saveProjectionFailed({
      matterId,
      markdownVersionId: version.id,
      markdownHash: version.contentHash,
      errorMessage: classified.message,
    })
    throw classified
  }

  const widgets = assembleWidgets(extraction, knownMarkers)
  const projection: MatterDashboardProjectionData = {
    schemaVersion: PROJECTION_SCHEMA_VERSION,
    widgets,
    generatedAt: new Date().toISOString(),
  }
  // Defensive: re-validate our own assembled output (including the id/order/type fields we just added) before persisting.
  MatterDashboardProjectionSchema.parse(projection)

  await saveProjectionReady({
    matterId,
    markdownVersionId: version.id,
    markdownHash: hashMarkdown(version.content),
    projectionJson: projection,
  })

  return { projection, version, wasCached: false }
}

/** GET-only lookup -- never triggers generation. Used by the dashboard page's initial load to decide whether to show cached content immediately or prompt a generation request. */
export async function getExistingDashboardProjection(matterId: string): Promise<{ projection: MatterDashboardProjectionData; version: MatterKnowledgeVersion } | undefined> {
  const version = await getCurrentVersionOrThrow(matterId)
  const existing = await getProjection(matterId, version.id)
  if (existing?.status === 'ready' && existing.projectionJson) {
    return { projection: existing.projectionJson as MatterDashboardProjectionData, version }
  }
  return undefined
}
