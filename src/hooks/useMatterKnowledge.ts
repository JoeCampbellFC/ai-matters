import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/services/api'
import { fetchKnowledgeVersions, restoreKnowledgeVersion, saveKnowledgeEdit } from '@/services/matterKnowledgeApi'
import type { MatterKnowledgeVersion } from '@/types/matterKnowledge'

/** Markdown version history + edit/restore actions for a workspace's Matter Knowledge File -- mirrors useMatterProfile's fetch/mutate conventions. */
export function useMatterKnowledge(workspaceId: string, refreshKey: unknown) {
  const [versions, setVersions] = useState<MatterKnowledgeVersion[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [stale, setStale] = useState(false)

  const refresh = useCallback(() => {
    fetchKnowledgeVersions(workspaceId)
      .then(setVersions)
      .catch(() => setVersions([]))
  }, [workspaceId])

  useEffect(() => {
    refresh()
  }, [refresh, refreshKey])

  const currentVersion = versions[0]

  const save = useCallback(
    async (content: string, changeSummary?: string): Promise<boolean> => {
      if (!currentVersion) return false
      setSaving(true)
      setError(undefined)
      setStale(false)
      try {
        await saveKnowledgeEdit(workspaceId, { content, basedOnVersionId: currentVersion.id, changeSummary })
        refresh()
        return true
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          setStale(true)
          setError('This Matter Knowledge File was updated by someone else since you loaded it. Reload and try again.')
        } else {
          setError(err instanceof Error ? err.message : 'Failed to save the edit.')
        }
        return false
      } finally {
        setSaving(false)
      }
    },
    [workspaceId, currentVersion, refresh],
  )

  const restore = useCallback(
    async (versionId: string): Promise<boolean> => {
      setSaving(true)
      setError(undefined)
      try {
        await restoreKnowledgeVersion(workspaceId, versionId)
        refresh()
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to restore that version.')
        return false
      } finally {
        setSaving(false)
      }
    },
    [workspaceId, refresh],
  )

  return { versions, currentVersion, saving, error, stale, save, restore, refresh }
}
