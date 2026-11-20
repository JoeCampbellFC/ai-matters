import { ApiError, apiRequest } from './api'
import type { CitationRegistryEntry, ResearchEvent, ResearchEventType, RunSnapshot } from '@/types/research'

const RESEARCH_EVENT_TYPES: ResearchEventType[] = [
  'run_started',
  'stage_changed',
  'activity',
  'document_discovered',
  'document_status_changed',
  'coverage_assessed',
  'run_succeeded',
  'run_failed',
  'run_cancelled',
  'heartbeat',
]

/**
 * A 409 here means a run is already active for this workspace; the server
 * includes the existing runId so the UI can reattach instead of treating it
 * as a hard failure. apiRequest's generic error contract doesn't carry that
 * extra field, so this makes its own fetch call rather than reusing it.
 */
export async function startResearch(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<{ runId: string; alreadyInProgress: boolean }> {
  const response = await fetch(`/api/matters/${encodeURIComponent(workspaceId)}/research`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  })
  const body = (await response.json().catch(() => undefined)) as
    | { runId?: string; error?: { code?: string; message?: string } }
    | undefined

  if (response.status === 409 && body?.runId) {
    return { runId: body.runId, alreadyInProgress: true }
  }
  if (!response.ok || !body?.runId) {
    throw new ApiError(
      body?.error?.message ?? `Failed to start research for workspace ${workspaceId}.`,
      body?.error?.code ?? 'unknown_error',
      response.status,
    )
  }
  return { runId: body.runId, alreadyInProgress: false }
}

export async function fetchRunSnapshot(runId: string, signal?: AbortSignal): Promise<RunSnapshot> {
  return apiRequest<RunSnapshot>(`/matters/research/${encodeURIComponent(runId)}`, { signal })
}

export async function cancelResearch(runId: string): Promise<void> {
  await apiRequest<void>(`/matters/research/${encodeURIComponent(runId)}/cancel`, { method: 'POST' })
}

export async function fetchResearchMarkdown(
  runId: string,
): Promise<{ markdown: string; citations: CitationRegistryEntry[] }> {
  return apiRequest(`/matters/research/${encodeURIComponent(runId)}/markdown`)
}

/**
 * apiRequest is JSON request/response only and can't be reused for a
 * long-lived server push stream -- this is the net-new streaming helper,
 * built on a plain EventSource.
 */
export function subscribeToResearchEvents(
  runId: string,
  handlers: { onEvent: (event: ResearchEvent) => void; onError?: (error: Event) => void },
): () => void {
  const source = new EventSource(`/api/matters/research/${encodeURIComponent(runId)}/events`, {
    withCredentials: true,
  })

  for (const type of RESEARCH_EVENT_TYPES) {
    source.addEventListener(type, (event) => {
      handlers.onEvent(JSON.parse((event as MessageEvent).data) as ResearchEvent)
    })
  }
  if (handlers.onError) {
    source.onerror = handlers.onError
  }

  return () => source.close()
}
