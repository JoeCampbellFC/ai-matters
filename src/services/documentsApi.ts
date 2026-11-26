import { apiRequest } from './api'
import type { ContainerType, DocumentChildrenPage, DocumentSearchResult } from '@/types/documents'

/** Lists one container's immediate children -- omit containerId/containerType for the workspace root. */
export async function fetchContainerChildren(
  workspaceId: string,
  input: { containerId?: string; containerType?: ContainerType; cursor?: string } = {},
): Promise<DocumentChildrenPage> {
  const params = new URLSearchParams()
  if (input.containerId) params.set('containerId', input.containerId)
  if (input.containerType) params.set('containerType', input.containerType)
  if (input.cursor) params.set('cursor', input.cursor)
  const query = params.toString()
  return apiRequest<DocumentChildrenPage>(`/matters/${encodeURIComponent(workspaceId)}/documents/children${query ? `?${query}` : ''}`)
}

/** Workspace-scoped document search -- every returned hit has already passed membership verification server-side. */
export async function searchDocuments(workspaceId: string, query: string): Promise<DocumentSearchResult> {
  const params = new URLSearchParams({ query })
  return apiRequest<DocumentSearchResult>(`/matters/${encodeURIComponent(workspaceId)}/documents/search?${params.toString()}`)
}
