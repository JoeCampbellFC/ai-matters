import { apiRequest } from './api'
import type { Workspace } from '@/types/workspace'

interface WorkspacesResponse {
  workspaces: Workspace[]
}

export async function fetchRecentWorkspaces(options?: { libraryId?: string; signal?: AbortSignal }): Promise<Workspace[]> {
  const params = new URLSearchParams()
  if (options?.libraryId) params.set('libraryId', options.libraryId)
  const query = params.toString()
  const { workspaces } = await apiRequest<WorkspacesResponse>(`/workspaces/recent${query ? `?${query}` : ''}`, {
    signal: options?.signal,
  })
  return workspaces
}

export async function searchWorkspaces(options: {
  query: string
  libraryId?: string
  signal?: AbortSignal
}): Promise<Workspace[]> {
  const params = new URLSearchParams({ q: options.query })
  if (options.libraryId) params.set('libraryId', options.libraryId)
  const { workspaces } = await apiRequest<WorkspacesResponse>(`/workspaces/search?${params.toString()}`, {
    signal: options.signal,
  })
  return workspaces
}
