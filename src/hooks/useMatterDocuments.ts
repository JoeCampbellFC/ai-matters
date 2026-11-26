import { useCallback, useEffect, useState } from 'react'
import { fetchContainerChildren, searchDocuments } from '@/services/documentsApi'
import type { ContainerChild, ContainerType, DocumentSearchResult } from '@/types/documents'

export interface BrowseCrumb {
  containerId: string
  containerType: ContainerType
  name: string
}

/**
 * Live, lazy iManage Documents panel state for a single workspace: the
 * Browse tab only ever fetches one container's immediate children (never
 * walks the tree itself), expanding on demand as the user clicks into a
 * folder -- see services/matterDocumentsService.ts on the server for why.
 */
export function useMatterDocuments(workspaceId: string) {
  const [path, setPath] = useState<BrowseCrumb[]>([])
  const [children, setChildren] = useState<ContainerChild[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()

  // Resets browse state when workspaceId changes, adjusted during render
  // (React's recommended pattern) rather than in an effect -- mirrors
  // useMatterProfile.ts/useMatterDashboard.ts.
  const [loadedForWorkspaceId, setLoadedForWorkspaceId] = useState(workspaceId)
  if (workspaceId !== loadedForWorkspaceId) {
    setLoadedForWorkspaceId(workspaceId)
    setPath([])
    setChildren([])
    setNextCursor(undefined)
    setError(undefined)
    setLoading(true)
  }

  /** No setState call here runs synchronously -- every one happens inside a .then/.catch/.finally callback, so this is safe to call from the mount effect below. */
  const loadContainer = useCallback(
    (crumb: BrowseCrumb | undefined, cursor?: string) => {
      fetchContainerChildren(workspaceId, { containerId: crumb?.containerId, containerType: crumb?.containerType, cursor })
        .then((page) => {
          setChildren((prev) => (cursor ? [...prev, ...page.children] : page.children))
          setNextCursor(page.nextCursor)
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load documents.'))
        .finally(() => setLoading(false))
    },
    [workspaceId],
  )

  useEffect(() => {
    loadContainer(undefined)
  }, [loadContainer])

  const openFolder = useCallback(
    (child: ContainerChild) => {
      if (child.type !== 'folder' && child.type !== 'tab') return
      const crumb: BrowseCrumb = { containerId: child.id, containerType: child.type, name: child.name ?? child.id }
      setPath((prev) => [...prev, crumb])
      setLoading(true)
      setError(undefined)
      loadContainer(crumb)
    },
    [loadContainer],
  )

  const goToCrumb = useCallback(
    (index: number) => {
      const newPath = index < 0 ? [] : path.slice(0, index + 1)
      setPath(newPath)
      setLoading(true)
      setError(undefined)
      loadContainer(newPath[newPath.length - 1])
    },
    [path, loadContainer],
  )

  const loadMore = useCallback(() => {
    if (!nextCursor) return
    setLoading(true)
    setError(undefined)
    loadContainer(path[path.length - 1], nextCursor)
  }, [nextCursor, path, loadContainer])

  const [searchResult, setSearchResult] = useState<DocumentSearchResult | undefined>()
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | undefined>()

  const search = useCallback(
    async (query: string) => {
      const trimmed = query.trim()
      if (!trimmed) {
        setSearchResult(undefined)
        return
      }
      setSearching(true)
      setSearchError(undefined)
      try {
        setSearchResult(await searchDocuments(workspaceId, trimmed))
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : 'Search failed.')
      } finally {
        setSearching(false)
      }
    },
    [workspaceId],
  )

  return {
    path,
    children,
    hasMore: Boolean(nextCursor),
    loading,
    error,
    openFolder,
    goToCrumb,
    loadMore,
    searchResult,
    searching,
    searchError,
    search,
  }
}
