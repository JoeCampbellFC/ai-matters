import { useQuery } from '@tanstack/react-query'
import { fetchRecentWorkspaces, searchWorkspaces } from '@/services/workspaceService'

export function useRecentWorkspaces(options: { enabled: boolean; libraryId?: string }) {
  return useQuery({
    queryKey: ['workspaces', 'recent', options.libraryId ?? null],
    queryFn: ({ signal }) => fetchRecentWorkspaces({ libraryId: options.libraryId, signal }),
    enabled: options.enabled,
  })
}

export function useWorkspaceSearch(options: { query: string; libraryId?: string; enabled: boolean }) {
  return useQuery({
    queryKey: ['workspaces', 'search', options.query, options.libraryId ?? null],
    queryFn: ({ signal }) => searchWorkspaces({ query: options.query, libraryId: options.libraryId, signal }),
    enabled: options.enabled && options.query.trim().length > 0,
  })
}
