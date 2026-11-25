import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import {
  RESEARCH_EVENT_TYPES,
  cancelResearch,
  fetchResearchMarkdown,
  fetchRunSnapshot,
  startResearch,
  subscribeToResearchEvents,
} from './matterResearchApi'
import type { ResearchEventType } from '@/types/research'

function mockFetchOnce(response: { status: number; body?: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
      json: async () => response.body,
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('startResearch', () => {
  it('returns the new runId on success', async () => {
    mockFetchOnce({ status: 202, body: { runId: 'run-1', status: 'running', stage: 'initializing' } })
    const result = await startResearch('WS-1')
    expect(result).toEqual({ runId: 'run-1', alreadyInProgress: false })
  })

  it('treats a 409 with a runId as "already in progress", not an error', async () => {
    mockFetchOnce({
      status: 409,
      body: { error: { code: 'run_in_progress', message: 'already running' }, runId: 'existing-run' },
    })
    const result = await startResearch('WS-1')
    expect(result).toEqual({ runId: 'existing-run', alreadyInProgress: true })
  })

  it('throws ApiError for other failures', async () => {
    mockFetchOnce({ status: 401, body: { error: { code: 'not_connected', message: 'Not connected.' } } })
    await expect(startResearch('WS-1')).rejects.toMatchObject({ code: 'not_connected', status: 401 })
  })
})

describe('fetchRunSnapshot / cancelResearch / fetchResearchMarkdown', () => {
  it('fetches a run snapshot', async () => {
    mockFetchOnce({ status: 200, body: { runId: 'run-1', status: 'running', stage: 'searching', documents: [] } })
    const snapshot = await fetchRunSnapshot('run-1')
    expect(snapshot.runId).toBe('run-1')
  })

  it('cancels a run with no body expected', async () => {
    mockFetchOnce({ status: 204 })
    await expect(cancelResearch('run-1')).resolves.toBeUndefined()
  })

  it('throws run_not_ready as an ApiError when markdown is not ready', async () => {
    mockFetchOnce({ status: 409, body: { error: { code: 'run_not_ready', message: 'not ready' } } })
    await expect(fetchResearchMarkdown('run-1')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('subscribeToResearchEvents', () => {
  it('dispatches parsed events from the EventSource to onEvent, and unsubscribe closes it', () => {
    const listeners = new Map<string, (event: MessageEvent) => void>()
    const close = vi.fn()
    class FakeEventSource {
      addEventListener(type: string, listener: (event: MessageEvent) => void) {
        listeners.set(type, listener)
      }
      close = close
    }
    vi.stubGlobal('EventSource', FakeEventSource)

    const onEvent = vi.fn()
    const unsubscribe = subscribeToResearchEvents('run-1', { onEvent })

    const payload = { seq: 1, ts: '2026-01-01T00:00:00Z', runId: 'run-1', type: 'activity', stage: 'initializing', message: 'hi' }
    listeners.get('activity')?.({ data: JSON.stringify(payload) } as MessageEvent)
    expect(onEvent).toHaveBeenCalledWith(payload)

    unsubscribe()
    expect(close).toHaveBeenCalled()
  })

  it('registers a listener for every event type the server can send (catches the type a future PR forgets)', () => {
    // Mirrors ResearchEventType in @/types/research -- if that union gains a member, add it both there and
    // to RESEARCH_EVENT_TYPES in matterResearchApi.ts, or this test (and the live feature) silently breaks.
    const allEventTypes: ResearchEventType[] = [
      'run_started',
      'skill_selected',
      'stage_changed',
      'activity',
      'search_planned',
      'search_started',
      'search_completed',
      'document_discovered',
      'document_status_changed',
      'workspace_folder_scanning',
      'coverage_assessed',
      'run_succeeded',
      'run_failed',
      'run_cancelled',
      'classification_started',
      'classification_field_started',
      'classification_field_completed',
      'classification_field_failed',
      'classification_completed',
      'classification_failed',
      'heartbeat',
    ]
    expect(new Set(RESEARCH_EVENT_TYPES)).toEqual(new Set(allEventTypes))
  })
})
