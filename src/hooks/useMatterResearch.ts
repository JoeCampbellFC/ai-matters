import { useCallback, useEffect, useReducer, useRef } from 'react'
import { ApiError } from '@/services/api'
import { cancelResearch, fetchRunSnapshot, startResearch, subscribeToResearchEvents } from '@/services/matterResearchApi'
import type {
  CoverageAssessment,
  ResearchActivityItem,
  ResearchDocument,
  ResearchEvent,
  ResearchRunStatus,
  ResearchStage,
  RunSnapshot,
  SearchQueryItem,
  SelectedSkill,
} from '@/types/research'

interface MatterResearchState {
  runId?: string
  status: ResearchRunStatus | 'idle'
  stage?: ResearchStage
  documents: Record<string, ResearchDocument>
  searchQueries: Record<string, SearchQueryItem>
  activity: ResearchActivityItem[]
  coverage?: CoverageAssessment
  skill?: SelectedSkill
  error?: { code: string; message: string }
  /** Frozen durations (ms) for stages that have already finished. */
  stageDurationsMs: Partial<Record<ResearchStage, number>>
  /** Epoch ms the *current* stage started -- lets the UI tick a live elapsed counter. */
  currentStageStartedAt?: number
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
    stageDurationsMs[state.stage] = now - state.currentStageStartedAt
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
  documents: {},
  searchQueries: {},
  activity: [],
  stageDurationsMs: {},
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
      return { ...state, ...finalizeStageDuration(state, event.stage, event.ts), stage: event.stage }
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
    case 'snapshot':
      return {
        ...state,
        status: action.snapshot.status,
        stage: action.snapshot.stage,
        // Reattaching (e.g. after a page refresh) only recovers where the *current* stage started --
        // durations for stages that already finished before reattach aren't recoverable from a snapshot.
        currentStageStartedAt: new Date(action.snapshot.stageStartedAt).getTime(),
        documents: Object.fromEntries(action.snapshot.documents.map((doc) => [doc.documentId, doc])),
        searchQueries: Object.fromEntries(action.snapshot.searchQueries.map((q) => [q.query, q])),
        coverage: action.snapshot.coverage,
        skill: action.snapshot.skill,
        error: action.snapshot.error,
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
    documents: Object.values(state.documents),
    searchQueries: Object.values(state.searchQueries),
    activity: state.activity,
    coverage: state.coverage,
    skill: state.skill,
    error: state.error,
    stageDurationsMs: state.stageDurationsMs,
    currentStageStartedAt: state.currentStageStartedAt,
    start,
    cancel,
  }
}
