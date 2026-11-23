import { randomUUID } from 'node:crypto'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { config } from '../config.js'
import { classifyError } from '../httpErrors.js'
import { ClassificationInProgressError, MarkdownNotReadyError } from '../classification/errors.js'
import { classifyFromCompletedRun } from '../classification/matterClassificationService.js'
import { budgetLimitsFromConfig } from './budget.js'
import { RunAlreadyInProgressError, RunNotFoundError } from './errors.js'
import { buildMatterResearchGraph } from './graph/graph.js'
import type { ResearchState } from './graph/state.js'
import type {
  CitationRegistryEntry,
  CoverageAssessment,
  DocumentStatus,
  EmittedResearchEvent,
  ResearchEvent,
  ResearchRunStatus,
  ResearchStage,
  SearchQueryItem,
  SelectedSkill,
} from './types.js'

export interface RunDocumentSnapshot {
  documentId: string
  name?: string
  docType?: string
  status: DocumentStatus
  reason?: string
}

export interface ResearchRunRecord {
  runId: string
  sessionId: string
  workspaceId: string
  status: ResearchRunStatus
  stage: ResearchStage
  createdAt: Date
  updatedAt: Date
  events: ResearchEvent[]
  nextSeq: number
  abortController: AbortController
  subscribers: Set<(event: ResearchEvent) => void>
  /** Live projections kept in sync as events are pushed, so a snapshot poll never has to re-scan the full event log. */
  documents: Map<string, RunDocumentSnapshot>
  searchQueries: Map<string, SearchQueryItem>
  coverage?: CoverageAssessment
  skill?: SelectedSkill
  /** Wall-clock time the current `stage` started, for the per-stage duration debug log and the UI's duration pill. */
  stageStartedAt: Date
  result?: { markdown: string; citationRegistry: CitationRegistryEntry[] }
  error?: { code: string; message: string }
  /** Resolves once the graph run has fully settled (succeeded/failed/cancelled). */
  done: Promise<void>
}

const runsByRunId = new Map<string, ResearchRunRecord>()
/** Active runs only, keyed by session+workspace -- removed as soon as a run leaves 'running'. */
const activeRunIdByWorkspace = new Map<string, string>()

function workspaceKey(sessionId: string, workspaceId: string): string {
  return `${sessionId}:${workspaceId}`
}

function applyProjection(run: ResearchRunRecord, event: ResearchEvent): void {
  if (event.type === 'stage_changed') {
    // Only a genuine transition resets the clock and logs -- several nodes
    // (buildOutline/writeMarkdown/validateCitations/finalize) all report
    // 'synthesizing' back-to-back and should read as one continuous
    // duration, and the very first event ('initializing', matching the
    // record's own starting default) correctly confirms rather than resets.
    if (event.stage !== run.stage) {
      const now = new Date(event.ts)
      const elapsedMs = now.getTime() - run.stageStartedAt.getTime()
      console.log(
        `[research:${run.runId}] stage "${run.stage}" took ${(elapsedMs / 1000).toFixed(1)}s -> entering "${event.stage}"`,
      )
      run.stage = event.stage
      run.stageStartedAt = now
    }
  } else if (event.type === 'document_discovered') {
    run.documents.set(event.document.documentId, { ...event.document })
  } else if (event.type === 'document_status_changed') {
    const existing = run.documents.get(event.documentId)
    run.documents.set(event.documentId, {
      documentId: event.documentId,
      name: existing?.name,
      docType: existing?.docType,
      status: event.status,
      reason: event.reason,
    })
  } else if (event.type === 'coverage_assessed') {
    run.coverage = { coveredTopics: event.coveredTopics, gaps: event.gaps }
  } else if (event.type === 'skill_selected') {
    run.skill = { name: event.skillName, description: event.description, rationale: event.rationale }
  } else if (event.type === 'search_planned') {
    run.searchQueries.set(event.query, {
      query: event.query,
      rationale: event.rationale,
      iteration: event.iteration,
      status: 'planned',
    })
  } else if (event.type === 'search_started') {
    const existing = run.searchQueries.get(event.query)
    if (existing) run.searchQueries.set(event.query, { ...existing, status: 'searching' })
  } else if (event.type === 'search_completed') {
    const existing = run.searchQueries.get(event.query)
    if (existing) run.searchQueries.set(event.query, { ...existing, status: 'completed', resultCount: event.resultCount })
  }
}

function pushEvent(run: ResearchRunRecord, event: EmittedResearchEvent): void {
  const fullEvent = { ...event, seq: run.nextSeq, ts: new Date().toISOString(), runId: run.runId } as ResearchEvent
  run.nextSeq += 1
  run.events.push(fullEvent)
  if (run.events.length > config.researchEventBufferMax) {
    run.events.shift()
  }
  run.updatedAt = new Date()
  applyProjection(run, fullEvent)
  for (const subscriber of run.subscribers) {
    subscriber(fullEvent)
  }
}

export function findActiveRunForWorkspace(sessionId: string, workspaceId: string): ResearchRunRecord | undefined {
  const runId = activeRunIdByWorkspace.get(workspaceKey(sessionId, workspaceId))
  return runId ? runsByRunId.get(runId) : undefined
}

export function getRun(runId: string): ResearchRunRecord | undefined {
  return runsByRunId.get(runId)
}

/** Throws RunNotFoundError (never a 403) on mismatch, so a foreign session can't even confirm the run exists. */
export function assertRunOwnedBySession(run: ResearchRunRecord, sessionId: string): void {
  if (run.sessionId !== sessionId) {
    throw new RunNotFoundError()
  }
}

export function subscribeToRun(
  run: ResearchRunRecord,
  afterSeq: number,
  onEvent: (event: ResearchEvent) => void,
): () => void {
  for (const event of run.events) {
    if (event.seq > afterSeq) onEvent(event)
  }
  run.subscribers.add(onEvent)
  return () => run.subscribers.delete(onEvent)
}

export function cancelRun(run: ResearchRunRecord): void {
  if (run.status !== 'running') return
  run.abortController.abort()
}

export function recordHeartbeat(run: ResearchRunRecord): void {
  pushEvent(run, { type: 'heartbeat' })
}

/**
 * Fires Phase 3 classification automatically once (and only once) a run has
 * actually succeeded with a non-empty Markdown result -- never on a failed
 * or cancelled run. Reuses this run's own SSE event log (classification_*
 * events) rather than a separate progress channel. Fire-and-forget: a
 * classification failure must never affect the research run's own already-
 * settled status.
 */
function triggerClassification(run: ResearchRunRecord, workspaceName: string | undefined, documentsUsed: number): void {
  if (!run.result) return
  classifyFromCompletedRun(
    {
      sessionId: run.sessionId,
      workspaceId: run.workspaceId,
      workspaceName,
      researchRunId: run.runId,
      markdown: run.result.markdown,
      documentsUsed,
    },
    {
      onStarted: () => pushEvent(run, { type: 'classification_started' }),
      onCompleted: (profile) =>
        pushEvent(run, {
          type: 'classification_completed',
          matterTypeId: profile.matterType.id,
          label: profile.matterType.label,
          confidence: profile.matterType.confidence,
          status: profile.matterType.status,
        }),
      onFailed: (error) => pushEvent(run, { type: 'classification_failed', error }),
    },
  ).catch((error: unknown) => {
    // The sink above already pushed classification_failed for in-process failures;
    // this only guards the cases that throw before that (e.g. empty Markdown).
    if (!(error instanceof MarkdownNotReadyError) && !(error instanceof ClassificationInProgressError)) {
      console.error(`[research:${run.runId}] automatic classification failed:`, (error as Error).message)
    }
  })
}

/** Removes terminal runs older than researchRunTtlMs. Never touches a running run. */
export function sweepStaleRuns(): void {
  const now = Date.now()
  for (const [runId, run] of runsByRunId) {
    if (run.status === 'running') continue
    if (now - run.updatedAt.getTime() > config.researchRunTtlMs) {
      runsByRunId.delete(runId)
    }
  }
}

export function startResearchRun(input: {
  sessionId: string
  workspaceId: string
  client: Client
  tools: Tool[]
}): ResearchRunRecord {
  const existing = findActiveRunForWorkspace(input.sessionId, input.workspaceId)
  if (existing) {
    throw new RunAlreadyInProgressError(existing.runId)
  }

  const runId = randomUUID()
  const abortController = new AbortController()
  const startedAt = new Date()
  const run: ResearchRunRecord = {
    runId,
    sessionId: input.sessionId,
    workspaceId: input.workspaceId,
    status: 'running',
    stage: 'initializing',
    createdAt: startedAt,
    updatedAt: startedAt,
    stageStartedAt: startedAt,
    events: [],
    // Starts at 1 so afterSeq=0 (the client's "give me everything" sentinel,
    // e.g. no Last-Event-ID yet) still replays the very first event.
    nextSeq: 1,
    abortController,
    subscribers: new Set(),
    documents: new Map(),
    searchQueries: new Map(),
    done: Promise.resolve(),
  }
  runsByRunId.set(runId, run)
  activeRunIdByWorkspace.set(workspaceKey(input.sessionId, input.workspaceId), runId)

  pushEvent(run, { type: 'run_started', workspaceId: input.workspaceId })

  run.done = runGraph(run, input.client, input.tools)

  return run
}

/** Generously above LangGraph's default 25-step recursion limit: a multi-pass refine loop plus one writeMarkdown call per report section can legitimately take dozens of graph steps. */
const RECURSION_LIMIT = 200

async function runGraph(run: ResearchRunRecord, client: Client, tools: Tool[]): Promise<void> {
  const startedAt = Date.now()
  let latestValues: ResearchState | undefined

  try {
    const graph = buildMatterResearchGraph()
    const stream = await graph.stream(
      { runId: run.runId, sessionId: run.sessionId, workspaceId: run.workspaceId },
      {
        streamMode: ['values', 'custom'],
        configurable: { client, tools, limits: budgetLimitsFromConfig() },
        signal: run.abortController.signal,
        recursionLimit: RECURSION_LIMIT,
      },
    )

    for await (const [mode, chunk] of stream as AsyncIterable<[string, unknown]>) {
      if (mode === 'values') {
        latestValues = chunk as ResearchState
      } else if (mode === 'custom') {
        pushEvent(run, chunk as EmittedResearchEvent)
      }
    }

    if (run.abortController.signal.aborted) {
      run.status = 'cancelled'
      pushEvent(run, { type: 'run_cancelled' })
      return
    }

    const markdown = latestValues?.markdown ?? ''
    const citationRegistry = latestValues?.citationRegistry ?? []
    run.result = { markdown, citationRegistry }
    run.status = 'succeeded'
    pushEvent(run, {
      type: 'run_succeeded',
      summary: {
        documentsUsed: citationRegistry.length,
        tokensUsed: 0,
        durationMs: Date.now() - startedAt,
      },
    })
    triggerClassification(run, latestValues?.workspace?.name, citationRegistry.length)
  } catch (error) {
    if (run.abortController.signal.aborted) {
      run.status = 'cancelled'
      pushEvent(run, { type: 'run_cancelled' })
      return
    }
    const classified = classifyError(error)
    run.status = 'failed'
    run.error = { code: classified.code, message: classified.message }
    pushEvent(run, { type: 'run_failed', error: run.error })
  } finally {
    activeRunIdByWorkspace.delete(workspaceKey(run.sessionId, run.workspaceId))
  }
}
