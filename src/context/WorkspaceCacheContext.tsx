import { createContext, useCallback, useContext, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Workspace } from '@/types/workspace'

interface WorkspaceCacheValue {
  getWorkspace: (id: string) => Workspace | undefined
  remember: (workspaces: Workspace[]) => void
}

const WorkspaceCacheContext = createContext<WorkspaceCacheValue | undefined>(undefined)

/**
 * Keeps the most recently seen workspace records (from search or recents) in
 * memory for the lifetime of the SPA session, so the detail view can show
 * what the user selected without calling get_workspace_profile — out of
 * scope for this phase.
 */
export function WorkspaceCacheProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef(new Map<string, Workspace>())

  const remember = useCallback((workspaces: Workspace[]) => {
    for (const workspace of workspaces) {
      cacheRef.current.set(workspace.id, workspace)
    }
  }, [])

  const getWorkspace = useCallback((id: string) => cacheRef.current.get(id), [])

  const value = useMemo(() => ({ getWorkspace, remember }), [getWorkspace, remember])

  return <WorkspaceCacheContext.Provider value={value}>{children}</WorkspaceCacheContext.Provider>
}

export function useWorkspaceCache() {
  const context = useContext(WorkspaceCacheContext)
  if (!context) {
    throw new Error('useWorkspaceCache must be used within a WorkspaceCacheProvider')
  }
  return context
}
