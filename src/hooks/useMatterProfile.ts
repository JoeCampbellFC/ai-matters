import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/services/api'
import {
  classifyMatter,
  fetchClassificationFields,
  fetchMatterProfile,
  reclassifyMatter,
  updateProfileFields,
} from '@/services/matterProfileApi'
import type { ClassificationFieldOption, MatterProfile } from '@/types/matterProfile'
import type { ResearchRunStatus } from '@/types/research'
import type { ClassificationLiveSignal } from './useMatterResearch'

/**
 * Durable Matter Profile state (fetched via REST, the authoritative source
 * of truth) merged with the *live* classification signal already streaming
 * through useMatterResearch's own SSE subscription -- deliberately not a
 * second EventSource to the same run; see ClassificationLiveSignal.
 */
export function useMatterProfile(
  workspaceId: string,
  live: { researchStatus: ResearchRunStatus | 'idle'; classificationLive?: ClassificationLiveSignal },
) {
  const [profile, setProfile] = useState<MatterProfile | undefined>()
  const [fieldOptions, setFieldOptions] = useState<ClassificationFieldOption[]>([])
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState<string | undefined>()
  const [conflict, setConflict] = useState(false)
  const lastHandledLiveStatus = useRef<string | undefined>(undefined)

  // Resets profile state when workspaceId changes, adjusted during render
  // (React's recommended pattern for this) rather than in an effect, which
  // would cause an extra cascading render.
  const [renderedForWorkspaceId, setRenderedForWorkspaceId] = useState(workspaceId)
  if (workspaceId !== renderedForWorkspaceId) {
    setRenderedForWorkspaceId(workspaceId)
    setProfile(undefined)
  }

  // Refs are only safe to read/write outside of render -- this effect (which
  // calls no setState) is the counterpart to the render-time reset above.
  useEffect(() => {
    lastHandledLiveStatus.current = undefined
  }, [workspaceId])

  const refresh = useCallback(() => {
    fetchMatterProfile(workspaceId)
      .then(setProfile)
      .catch(() => undefined)
  }, [workspaceId])

  // Loads the durable, previously-persisted profile as soon as a workspace is opened --
  // without this, a matter classified in an earlier session would show blank fields until
  // a new research run (or live classification event) happened to fire in *this* session.
  useEffect(() => {
    refresh()
  }, [refresh])

  // Refetch once research succeeds (auto-classification was just triggered
  // server-side) -- also covers revisiting a workspace that was already classified.
  useEffect(() => {
    if (live.researchStatus === 'succeeded') refresh()
  }, [workspaceId, live.researchStatus, refresh])

  // Refetch again once the live classification batch reaches a terminal state,
  // so the durable profile (every field's status/confidence/probabilities) catches up promptly.
  useEffect(() => {
    const status = live.classificationLive?.status
    if (status && status !== lastHandledLiveStatus.current && status !== 'classifying') {
      refresh()
    }
    lastHandledLiveStatus.current = status
  }, [live.classificationLive?.status, refresh])

  useEffect(() => {
    fetchClassificationFields()
      .then(setFieldOptions)
      .catch(() => undefined)
  }, [])

  const runAction = useCallback(async (action: () => Promise<MatterProfile>) => {
    setActionPending(true)
    setActionError(undefined)
    setConflict(false)
    try {
      const result = await action()
      setProfile(result)
      return true
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.code === 'concurrency_conflict') {
        setConflict(true)
        setActionError('Someone else changed this field since you loaded it. Reload to see the latest values.')
      } else {
        setActionError(error instanceof Error ? error.message : 'The request failed.')
      }
      return false
    } finally {
      setActionPending(false)
    }
  }, [])

  const retryClassification = useCallback(() => runAction(() => classifyMatter(workspaceId)), [runAction, workspaceId])
  const reclassify = useCallback(() => runAction(() => reclassifyMatter(workspaceId)), [runAction, workspaceId])
  const correct = useCallback(
    (fieldId: string, valueId: string, expectedVersion: number) =>
      runAction(() => updateProfileFields(workspaceId, [{ fieldKey: fieldId, value: valueId, expectedVersion }])),
    [runAction, workspaceId],
  )

  const isClassifying = live.classificationLive?.status === 'classifying'

  return {
    profile,
    fieldOptions,
    isClassifying,
    actionPending,
    actionError,
    conflict,
    refresh,
    retryClassification,
    reclassify,
    correct,
  }
}
