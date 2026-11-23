import { useCallback, useEffect, useReducer, useRef } from 'react'
import { ApiError } from '@/services/api'
import { cancelResearch, fetchRunSnapshot, startResearch, subscribeToResearchEvents } from '@/services/matterResearchApi'
import {
  RESEARCH_STAGE_ORDER,
  type CoverageAssessment,
  type ResearchActivityItem,
  type ResearchDocument,
  type ResearchEvent,
  type ResearchRunStatus,
  type ResearchStage,
  type RunSnapshot,
  type SearchQueryItem,
  type SelectedSkill,
} from '@/types/research'

/** Transient, live-only signal from this run's own SSE stream -- see useMatterProfile.ts for the durable source of truth. */
export interface ClassificationLiveSignal {
  status: 'classifying' | 'completed' | 'failed'
  error?: { code: string; message: string }
}

/** Live per-field progress, one entry per classification dimension, keyed by fieldId. */
export interface ClassificationFieldLiveSignal {
  fieldId: string
  fieldLabel: string
  status: 'classifying' | 'completed' | 'failed'
  valueId?: string | null
  label?: string | null
  confidence?: number | null
  reviewStatus?: string
  error?: { code: string; message: string }
}

interface MatterResearchState {
  runId?: string
  status: ResearchRunStatus | 'idle'
  stage?: ResearchStage
  /** Which refine pass is active (0 = the initial pass, 1 = the first re-search after gaps were found, ...). */
  iteration: number
  /**
   * The furthest index into RESEARCH_STAGE_ORDER this run has ever reached.
   * A refine pass re-enters planning_searches/searching, which sit *earlier*
   * in that order than assessing_coverage -- without this, the timeline
   * would render as if the whole run had rewound to the start instead of
   * looping back for another round.
   */
  maxStageIndexReached: number
  documents: Record<string, ResearchDocument>
  searchQueries: Record<string, SearchQueryItem>
  activity: ResearchActivityItem[]
  coverage?: CoverageAssessment
  skill?: SelectedSkill
  error?: { code: string; message: string }
  /** Cumulative durations (ms) across every pass a stage has run for so far. */
  stageDurationsMs: Partial<Record<ResearchStage, number>>
  /** Epoch ms the *current* stage started -- lets the UI tick a live elapsed counter. */
  currentStageStartedAt?: number
  /** Phase 3: overall live classification progress pushed onto this same run's event stream. */
  classificationLive?: ClassificationLiveSignal
  /** Phase 3: per-field live classification progress, keyed by fieldId. */
  classificationFieldsLive: Record<string, ClassificationFieldLiveSignal>
  /** Epoch ms classification_started fired -- lets the UI tick a live elapsed counter for the classification step. */
  classificationStartedAt?: number
  /** Frozen once classification_completed/failed fires. */
  classificationDurationMs?: number
}

/** Finalizes the outgoing stage's duration using `atTs` as its end time, unless it's still the same stage. */
function finalizeStageDuration(
  state: MatterResearchState,
  nextStage: ResearchStage | undefined,
  atTs: string,
): Pick<MatterResearchState, 'stageDurationsMs' | 'currentStageStartedAt'> {
  const now = new Date(atTs).getTime()
  if (state.stage === nextStage) {
    // Same stage continuing (e.g. several synthesis nodes in a row) -- don't reset the clock.
    return { stageDurationsMs: state.stageDurationsMs, currentStageStartedAt: state.currentStageStartedAt ?? now }
  }
  const stageDurationsMs = { ...state.stageDurationsMs }
  if (state.stage && state.currentStageStartedAt !== undefined) {
    // Accumulated, not overwritten -- a refine pass re-running an earlier
    // stage (e.g. a second "searching") adds to its total time rather than
    // discarding how long the first pass took there.
    stageDurationsMs[state.stage] = (stageDurationsMs[state.stage] ?? 0) + (now - state.currentStageStartedAt)
  }
  return { stageDurationsMs, currentStageStartedAt: now }
}

type Action =
  | { type: 'reset' }
  | { type: 'attached'; runId: string }
  | { type: 'snapshot'; snapshot: RunSnapshot }
  | { type: 'event'; event: ResearchEvent }

/** Caps the rendered activity feed so a long run doesn't grow this list unbounded. */
const MAX_ACTIVITY_ITEMS = 300

const INITIAL_STATE: MatterResearchState = {
  status: 'idle',
  iteration: 0,
  maxStageIndexReached: -1,
  documents: {},
  searchQueries: {},
  activity: [],
  stageDurationsMs: {},
  classificationFieldsLive: {},
}

/** Appends a synthesized log line to the shared activity feed -- the Terminal doesn't distinguish its source. */
function pushActivity(state: MatterResearchState, seq: number, ts: string, message: string): ResearchActivityItem[] {
  const item: ResearchActivityItem = { seq, ts, stage: 'classifying', message }
  return [...state.activity, item].slice(-MAX_ACTIVITY_ITEMS)
}

function applyEvent(state: MatterResearchState, event: ResearchEvent): MatterResearchState {
  switch (event.type) {
    case 'run_started':
      return state
    case 'skill_selected':
      return {
        ...state,
        skill: { name: event.skillName, description: event.description, rationale: event.rationale },
      }
    case 'stage_changed':
      return {
        ...state,
        ...finalizeStageDuration(state, event.stage, event.ts),
        stage: event.stage,
        iteration: event.iteration,
        maxStageIndexReached: Math.max(state.maxStageIndexReached, RESEARCH_STAGE_ORDER.indexOf(event.stage)),
      }
    case 'search_planned':
      return {
        ...state,
        searchQueries: {
          ...state.searchQueries,
          [event.query]: { query: event.query, rationale: event.rationale, iteration: event.iteration, status: 'planned' },
        },
      }
    case 'search_started': {
      const existing = state.searchQueries[event.query]
      if (!existing) return state
      return { ...state, searchQueries: { ...state.searchQueries, [event.query]: { ...existing, status: 'searching' } } }
    }
    case 'search_completed': {
      const existing = state.searchQueries[event.query]
      if (!existing) return state
      return {
        ...state,
        searchQueries: {
          ...state.searchQueries,
          [event.query]: { ...existing, status: 'completed', resultCount: event.resultCount },
        },
      }
    }
    case 'activity': {
      const item: ResearchActivityItem = { seq: event.seq, ts: event.ts, stage: event.stage, message: event.message }
      return { ...state, activity: [...state.activity, item].slice(-MAX_ACTIVITY_ITEMS) }
    }
    case 'document_discovered':
      return {
        ...state,
        documents: { ...state.documents, [event.document.documentId]: { ...event.document } },
      }
    case 'document_status_changed': {
      const existing = state.documents[event.documentId]
      return {
        ...state,
        documents: {
          ...state.documents,
          [event.documentId]: {
            documentId: event.documentId,
            name: existing?.name,
            docType: existing?.docType,
            discoveredVia: existing?.discoveredVia,
            status: event.status,
            reason: event.reason,
          },
        },
      }
    }
    case 'coverage_assessed':
      return { ...state, coverage: { coveredTopics: event.coveredTopics, gaps: event.gaps } }
    case 'run_succeeded':
      return { ...state, ...finalizeStageDuration(state, undefined, event.ts), status: 'succeeded' }
    case 'run_failed':
      return { ...state, ...finalizeStageDuration(state, undefined, event.ts), status: 'failed', error: event.error }
    case 'run_cancelled':
      return { ...state, ...finalizeStageDuration(state, undefined, event.ts), status: 'cancelled' }
    case 'classification_started':
      return {
        ...state,
        classificationLive: { status: 'classifying' },
        classificationFieldsLive: {},
        classificationStartedAt: new Date(event.ts).getTime(),
        classificationDurationMs: undefined,
      }
    case 'classification_field_started':
      return {
        ...state,
        classificationFieldsLive: {
          ...state.classificationFieldsLive,
          [event.fieldId]: { fieldId: event.fieldId, fieldLabel: event.fieldLabel, status: 'classifying' },
        },
        activity: pushActivity(state, event.seq, event.ts, `Classifying ${event.fieldLabel}…`),
      }
    case 'classification_field_completed': {
      const confidenceText = event.confidence !== null ? ` (${Math.round(event.confidence * 100)}%)` : ''
      return {
        ...state,
        classificationFieldsLive: {
          ...state.classificationFieldsLive,
          [event.fieldId]: {
            fieldId: event.fieldId,
            fieldLabel: event.fieldLabel,
            status: 'completed',
            valueId: event.valueId,
            label: event.label,
            confidence: event.confidence,
            reviewStatus: event.status,
          },
        },
        activity: pushActivity(state, event.seq, event.ts, `${event.fieldLabel} classified: ${event.label ?? 'Unclear / Other'}${confidenceText}`),
      }
    }
    case 'classification_field_failed':
      return {
        ...state,
        classificationFieldsLive: {
          ...state.classificationFieldsLive,
          [event.fieldId]: { fieldId: event.fieldId, fieldLabel: event.fieldLabel, status: 'failed', error: event.error },
        },
        activity: pushActivity(state, event.seq, event.ts, `${event.fieldLabel} classification failed: ${event.error.message}`),
      }
    case 'classification_completed':
      return {
        ...state,
        classificationLive: { status: 'completed' },
        classificationDurationMs:
          state.classificationStartedAt !== undefined ? new Date(event.ts).getTime() - state.classificationStartedAt : undefined,
      }
    case 'classification_failed':
      return {
        ...state,
        classificationLive: { status: 'failed', error: event.error },
        classificationDurationMs:
          state.classificationStartedAt !== undefined ? new Date(event.ts).getTime() - state.classificationStartedAt : undefined,
      }
    case 'heartbeat':
      return state
    default:
      return state
  }
}

function reducer(state: MatterResearchState, action: Action): MatterResearchState {
  switch (action.type) {
    case 'reset':
      return INITIAL_STATE
    case 'attached':
      return { ...INITIAL_STATE, runId: action.runId, status: 'running' }
    case 'snapshot': {
      // The live SSE subscription (not this snapshot) replays every historical
      // stage_changed event, so it's what actually rebuilds maxStageIndexReached
      // precisely. This is just a defensive floor in case the snapshot's
      // stage/queries resolve before that replay catches up.
      const snapshotIteration = action.snapshot.searchQueries.reduce((max, q) => Math.max(max, q.iteration), 0)
      return {
        ...state,
        status: action.snapshot.status,
        stage: action.snapshot.stage,
        iteration: Math.max(state.iteration, snapshotIteration),
        maxStageIndexReached: Math.max(state.maxStageIndexReached, RESEARCH_STAGE_ORDER.indexOf(action.snapshot.stage)),
        // Reattaching (e.g. after a page refresh) only recovers where the *current* stage started --
        // durations for stages that already finished before reattach aren't recoverable from a snapshot.
        currentStageStartedAt: new Date(action.snapshot.stageStartedAt).getTime(),
        documents: Object.fromEntries(action.snapshot.documents.map((doc) => [doc.documentId, doc])),
        searchQueries: Object.fromEntries(action.snapshot.searchQueries.map((q) => [q.query, q])),
        coverage: action.snapshot.coverage,
        skill: action.snapshot.skill,
        error: action.snapshot.error,
      }
    }
    case 'event':
      return applyEvent(state, action.event)
    default:
      return state
  }
}

function storageKey(workspaceId: string): string {
  return `matterResearch:${workspaceId}`
}

/**
 * Backs the live research UI with a reducer fed by Server-Sent Events,
 * rather than TanStack Query -- Query has no model for a long-lived server
 * push stream, and polling wouldn't be "genuine real-time" progress.
 * Persists the active runId in sessionStorage so a page refresh mid-run
 * reattaches (snapshot catch-up + event replay) instead of losing progress.
 */
export function useMatterResearch(workspaceId: string) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const attach = useCallback(
    (runId: string) => {
      unsubscribeRef.current?.()
      dispatch({ type: 'attached', runId })

      fetchRunSnapshot(runId)
        .then((snapshot) => dispatch({ type: 'snapshot', snapshot }))
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) {
            // The run no longer exists server-side (e.g. a dev-server restart wiped in-memory run
            // state, or it aged out past its retention window) -- forget it rather than leaving the
            // UI stuck showing "running" forever with nothing left to correct it.
            unsubscribeRef.current?.()
            unsubscribeRef.current = null
            sessionStorage.removeItem(storageKey(workspaceId))
            dispatch({ type: 'reset' })
            return
          }
          // Other errors: best-effort catch-up only; live events still arrive via the SSE subscription below.
        })

      unsubscribeRef.current = subscribeToResearchEvents(runId, {
        onEvent: (event) => dispatch({ type: 'event', event }),
      })
    },
    [workspaceId],
  )

  useEffect(() => {
    const storedRunId = sessionStorage.getItem(storageKey(workspaceId))
    if (storedRunId) {
      attach(storedRunId)
    } else {
      dispatch({ type: 'reset' })
    }
    return () => {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [workspaceId, attach])

  const start = useCallback(async () => {
    const { runId } = await startResearch(workspaceId)
    sessionStorage.setItem(storageKey(workspaceId), runId)
    attach(runId)
  }, [workspaceId, attach])

  const cancel = useCallback(() => {
    if (state.runId) {
      void cancelResearch(state.runId)
    }
  }, [state.runId])

  return {
    runId: state.runId,
    status: state.status,
    stage: state.stage,
    iteration: state.iteration,
    maxStageIndexReached: state.maxStageIndexReached,
    documents: Object.values(state.documents),
    searchQueries: Object.values(state.searchQueries),
    activity: state.activity,
    coverage: state.coverage,
    skill: state.skill,
    error: state.error,
    stageDurationsMs: state.stageDurationsMs,
    currentStageStartedAt: state.currentStageStartedAt,
    classificationLive: state.classificationLive,
    classificationFieldsLive: state.classificationFieldsLive,
    classificationStartedAt: state.classificationStartedAt,
    classificationDurationMs: state.classificationDurationMs,
    start,
    cancel,
  }
}
