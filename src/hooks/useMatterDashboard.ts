import { useCallback, useEffect, useState } from 'react'
import { fetchDashboard, generateDashboard } from '@/services/dashboardApi'
import type { MatterDashboardResponse } from '@/types/dashboard'

/** Cache-first Matter Dashboard projection for a workspace -- mirrors useMatterKnowledge's fetch/mutate conventions. */
export function useMatterDashboard(workspaceId: string) {
  const [data, setData] = useState<MatterDashboardResponse | undefined>()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | undefined>()

  // Resets state when workspaceId changes, adjusted during render (React's
  // recommended pattern for this) rather than in an effect, which would
  // cause an extra cascading render -- mirrors useMatterProfile.ts.
  const [loadedForWorkspaceId, setLoadedForWorkspaceId] = useState(workspaceId)
  if (workspaceId !== loadedForWorkspaceId) {
    setLoadedForWorkspaceId(workspaceId)
    setData(undefined)
    setError(undefined)
    setLoading(true)
  }

  const refresh = useCallback(() => {
    fetchDashboard(workspaceId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the dashboard.'))
      .finally(() => setLoading(false))
  }, [workspaceId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const generate = useCallback(async () => {
    setGenerating(true)
    setError(undefined)
    try {
      const result = await generateDashboard(workspaceId)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate the dashboard.')
    } finally {
      setGenerating(false)
    }
  }, [workspaceId])

  return { data, loading, generating, error, generate, refresh }
}
