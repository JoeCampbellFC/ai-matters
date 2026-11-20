import { useCallback, useEffect, useReducer, useRef } from 'react'
import { cancelResearch, fetchRunSnapshot, startResearch, subscribeToResearchEvents } from '@/services/matterResearchApi'
import type {
  CoverageAssessment,
  ResearchActivityItem,
  ResearchDocument,
  ResearchEvent,
  ResearchRunStatus,
  ResearchStage,
  RunSnapshot,
} from '@/types/research'

interface MatterResearchState {
  runId?: string
  status: ResearchRunStatus | 'idle'
  stage?: ResearchStage
  documents: Record<string, ResearchDocument>
  activity: ResearchActivityItem[]
  coverage?: CoverageAssessment
  error?: { code: string; message: string }
}

type Action =
  | { type: 'reset' }
  | { type: 'attached'; runId: string }
  | { type: 'snapshot'; snapshot: RunSnapshot }
  | { type: 'event'; event: ResearchEvent }

/** Caps the rendered activity feed so a long run doesn't grow this list unbounded. */
const MAX_ACTIVITY_ITEMS = 300

const INITIAL_STATE: MatterResearchState = { status: 'idle', documents: {}, activity: [] }

function applyEvent(state: MatterResearchState, event: ResearchEvent): MatterResearchState {
  switch (event.type) {
    case 'run_started':
      return state
    case 'stage_changed':
      return { ...state, stage: event.stage }
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
      return { ...state, status: 'succeeded' }
    case 'run_failed':
      return { ...state, status: 'failed', error: event.error }
    case 'run_cancelled':
      return { ...state, status: 'cancelled' }
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
        documents: Object.fromEntries(action.snapshot.documents.map((doc) => [doc.documentId, doc])),
        coverage: action.snapshot.coverage,
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

  const attach = useCallback((runId: string) => {
    unsubscribeRef.current?.()
    dispatch({ type: 'attached', runId })

    fetchRunSnapshot(runId)
      .then((snapshot) => dispatch({ type: 'snapshot', snapshot }))
      .catch(() => {
        // Best-effort catch-up only; live events still arrive via the SSE subscription below.
      })

    unsubscribeRef.current = subscribeToResearchEvents(runId, {
      onEvent: (event) => dispatch({ type: 'event', event }),
    })
  }, [])

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
    activity: state.activity,
    coverage: state.coverage,
    error: state.error,
    start,
    cancel,
  }
}
