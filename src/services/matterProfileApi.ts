import { ApiError, apiRequest } from './api'
import type { ClassificationFieldOption, MatterProfile, MatterSummary, ProfileFieldUpdate } from '@/types/matterProfile'

export async function fetchClassificationFields(): Promise<ClassificationFieldOption[]> {
  const result = await apiRequest<{ fields: ClassificationFieldOption[] }>('/matters/classification-fields')
  return result.fields
}

/** Returns undefined (not an error) when no profile has been classified yet for this workspace. */
export async function fetchMatterProfile(workspaceId: string): Promise<MatterProfile | undefined> {
  try {
    return await apiRequest<MatterProfile>(`/matters/${encodeURIComponent(workspaceId)}/profile`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined
    throw error
  }
}

/** Batch "already analysed" lookup for the Workspaces list -- one request for every row on the page. */
export async function fetchMattersBatch(workspaceIds: string[]): Promise<MatterSummary[]> {
  if (workspaceIds.length === 0) return []
  const result = await apiRequest<{ matters: MatterSummary[] }>(`/matters?workspaceIds=${workspaceIds.map(encodeURIComponent).join(',')}`)
  return result.matters
}

/** Retries classification after a failure -- never reruns Phase 2 research. */
export async function classifyMatter(workspaceId: string): Promise<MatterProfile> {
  return apiRequest<MatterProfile>(`/matters/${encodeURIComponent(workspaceId)}/classify`, { method: 'POST' })
}

/** Explicit user-initiated re-run of the Decisions API (every field) against the existing Matter Knowledge File. */
export async function reclassifyMatter(workspaceId: string): Promise<MatterProfile> {
  return apiRequest<MatterProfile>(`/matters/${encodeURIComponent(workspaceId)}/reclassify`, { method: 'POST' })
}

/**
 * Generalized field editor -- both an AI-classified field's manual override
 * (value = the chosen choice id) and the pure-profile fields (value = the
 * raw typed value) go through this same batch call, one optimistic-
 * concurrency check per field. A 409 ApiError means at least one field
 * conflicted; the caller should reload the profile and let the user retry.
 */
export async function updateProfileFields(workspaceId: string, updates: ProfileFieldUpdate[]): Promise<MatterProfile> {
  return apiRequest<MatterProfile>(`/matters/${encodeURIComponent(workspaceId)}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  })
}
