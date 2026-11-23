import { ApiError, apiRequest } from './api'
import type { MatterProfile, MatterTypeOption } from '@/types/matterProfile'

export async function fetchMatterTypeOptions(): Promise<MatterTypeOption[]> {
  const result = await apiRequest<{ matterTypes: MatterTypeOption[] }>('/matters/matter-types')
  return result.matterTypes
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

/** Retries classification after a failure -- never reruns Phase 2 research. */
export async function classifyMatter(workspaceId: string): Promise<MatterProfile> {
  return apiRequest<MatterProfile>(`/matters/${encodeURIComponent(workspaceId)}/classify`, { method: 'POST' })
}

/** Explicit user-initiated re-run of the Decisions API against the existing Matter Knowledge File. */
export async function reclassifyMatter(workspaceId: string): Promise<MatterProfile> {
  return apiRequest<MatterProfile>(`/matters/${encodeURIComponent(workspaceId)}/reclassify`, { method: 'POST' })
}

export async function correctMatterType(
  workspaceId: string,
  input: { matterTypeId: string; correctedBy?: string },
): Promise<MatterProfile> {
  return apiRequest<MatterProfile>(`/matters/${encodeURIComponent(workspaceId)}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
