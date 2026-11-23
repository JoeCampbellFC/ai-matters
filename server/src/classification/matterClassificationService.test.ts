import { describe, expect, it, vi } from 'vitest'

const { classifyChoice } = vi.hoisted(() => ({ classifyChoice: vi.fn() }))
vi.mock('./decisionsClient.js', () => ({ classifyChoice }))

/**
 * A tiny in-memory stand-in for classificationRepository.js -- real
 * persistence behavior (artifact versioning, current/history, override and
 * lastError clearing) is already covered by classificationRepository.test.ts
 * against the real file-backed store; this fake exists only so the
 * *service's* orchestration (triggering, dedup, status mapping, refusal/
 * failure handling, reclassify, manual correction) can be tested without
 * real disk I/O, while still exercising the exact same call sequence.
 */
const { fakeRepo } = vi.hoisted(() => {
  const state = { artifacts: [] as Array<Record<string, unknown>>, profiles: [] as Array<Record<string, unknown>> }
  function findProfile(sessionId: string, workspaceId: string) {
    return state.profiles.find((p) => p.sessionId === sessionId && p.workspaceId === workspaceId)
  }
  const saveMarkdownArtifact = vi.fn((input: Record<string, unknown>) => {
    const versions = state.artifacts.filter((a) => a.sessionId === input.sessionId && a.workspaceId === input.workspaceId)
    const artifact = { ...input, id: `artifact-${state.artifacts.length + 1}`, version: versions.length + 1, createdAt: new Date().toISOString() }
    state.artifacts.push(artifact)
    return artifact
  })
  const getMarkdownArtifact = vi.fn((id: string) => state.artifacts.find((a) => a.id === id))
  const getLatestMarkdownArtifact = vi.fn((sessionId: string, workspaceId: string) => {
    const matches = state.artifacts.filter((a) => a.sessionId === sessionId && a.workspaceId === workspaceId)
    return matches.at(-1)
  })
  const getProfileRecord = vi.fn((sessionId: string, workspaceId: string) => findProfile(sessionId, workspaceId))
  const upsertClassification = vi.fn(
    ({ sessionId, workspaceId, workspaceName, record }: { sessionId: string; workspaceId: string; workspaceName?: string; record: Record<string, unknown> }) => {
      let profile = findProfile(sessionId, workspaceId)
      if (!profile) {
        profile = { sessionId, workspaceId, workspaceName, history: [], updatedAt: new Date().toISOString() }
        state.profiles.push(profile)
      }
      if (profile.current) (profile.history as unknown[]).push(profile.current)
      profile.current = record
      profile.override = undefined
      profile.lastError = undefined
      return profile
    },
  )
  const recordClassificationFailure = vi.fn(
    (sessionId: string, workspaceId: string, workspaceName: string | undefined, error: { code: string; message: string }) => {
      let profile = findProfile(sessionId, workspaceId)
      if (!profile) {
        profile = { sessionId, workspaceId, workspaceName, history: [], updatedAt: new Date().toISOString() }
        state.profiles.push(profile)
      }
      profile.lastError = { ...error, at: new Date().toISOString() }
      return profile
    },
  )
  const recordManualCorrection = vi.fn((sessionId: string, workspaceId: string, correction: Record<string, unknown>) => {
    const profile = findProfile(sessionId, workspaceId)
    if (!profile) return undefined
    profile.override = correction
    return profile
  })
  return {
    fakeRepo: {
      state,
      saveMarkdownArtifact,
      getMarkdownArtifact,
      getLatestMarkdownArtifact,
      getProfileRecord,
      upsertClassification,
      recordClassificationFailure,
      recordManualCorrection,
    },
  }
})

vi.mock('./classificationRepository.js', () => fakeRepo)

const { classifyFromCompletedRun, reclassifyLatestArtifact, recordManualClassificationCorrection, toMatterProfile } =
  await import('./matterClassificationService.js')
const { ClassificationInProgressError, MarkdownNotReadyError, MatterProfileNotFoundError } = await import('./errors.js')

function choiceAnswer(overrides: Partial<{ choice: string; confidence: number; probabilities: Array<{ value: string; probability: number }> }> = {}) {
  return {
    type: 'choice' as const,
    choice: 'mergers_acquisitions',
    confidence: 0.9,
    probabilities: [{ value: 'mergers_acquisitions', probability: 0.9 }],
    ...overrides,
  }
}

describe('classifyFromCompletedRun', () => {
  it('never classifies an incomplete run -- throws MarkdownNotReadyError for empty Markdown', async () => {
    await expect(
      classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-empty', researchRunId: 'run-1', markdown: '   ', documentsUsed: 0 }),
    ).rejects.toThrow(MarkdownNotReadyError)
    expect(classifyChoice).not.toHaveBeenCalled()
  })

  it('classifies a completed run and produces a "classified" profile at high confidence', async () => {
    classifyChoice.mockResolvedValueOnce(choiceAnswer({ confidence: 0.95 }))
    const started = vi.fn()
    const completed = vi.fn()

    const profile = await classifyFromCompletedRun(
      { sessionId: 's1', workspaceId: 'WS-1', workspaceName: 'Acme Matter', researchRunId: 'run-1', markdown: '# Matter', documentsUsed: 5 },
      { onStarted: started, onCompleted: completed },
    )

    expect(started).toHaveBeenCalledOnce()
    expect(completed).toHaveBeenCalledWith(profile)
    expect(profile.matterType).toEqual({
      id: 'mergers_acquisitions',
      label: 'Mergers & Acquisitions',
      confidence: 0.95,
      status: 'classified',
    })
    expect(profile.source?.documentsUsed).toBe(5)
    expect(profile.outdated).toBe(false)
  })

  it('marks a refusal as needs_review without inventing a category', async () => {
    classifyChoice.mockResolvedValueOnce({ type: 'refusal', name: 'matter_type' })
    const profile = await classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-refusal', researchRunId: 'run-1', markdown: '# Matter', documentsUsed: 1 })
    expect(profile.matterType).toEqual({ id: null, label: null, confidence: null, status: 'needs_review' })
  })

  it('rejects a Decisions API answer that names an unrecognized matter type id', async () => {
    classifyChoice.mockResolvedValueOnce(choiceAnswer({ choice: 'not_a_real_category' }))
    const failed = vi.fn()
    await expect(
      classifyFromCompletedRun(
        { sessionId: 's1', workspaceId: 'WS-bad', researchRunId: 'run-1', markdown: '# Matter', documentsUsed: 1 },
        { onFailed: failed },
      ),
    ).rejects.toThrow()
    expect(failed).toHaveBeenCalledOnce()
    expect(fakeRepo.recordClassificationFailure).toHaveBeenCalled()
    expect(fakeRepo.upsertClassification).not.toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'WS-bad' }))
  })

  it('prevents a duplicate concurrent classification job for the same session+workspace', async () => {
    let resolveClassify: ((value: ReturnType<typeof choiceAnswer>) => void) | undefined
    classifyChoice.mockImplementationOnce(() => new Promise((resolve) => (resolveClassify = resolve)))

    const first = classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-dup', researchRunId: 'run-1', markdown: '# Matter', documentsUsed: 1 })
    const second = classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-dup', researchRunId: 'run-1', markdown: '# Matter', documentsUsed: 1 })

    await expect(second).rejects.toThrow(ClassificationInProgressError)
    resolveClassify?.(choiceAnswer())
    await first
  })

  it('isolates profiles by session -- two sessions classifying the same workspace id never share state', async () => {
    classifyChoice.mockResolvedValue(choiceAnswer({ choice: 'tax' }))
    await classifyFromCompletedRun({ sessionId: 'session-A', workspaceId: 'WS-shared', researchRunId: 'run-1', markdown: '# Matter A', documentsUsed: 1 })
    await classifyFromCompletedRun({ sessionId: 'session-B', workspaceId: 'WS-shared', researchRunId: 'run-2', markdown: '# Matter B', documentsUsed: 1 })

    expect(toMatterProfile('session-A', 'WS-shared')?.source?.researchRunId).toBe('run-1')
    expect(toMatterProfile('session-B', 'WS-shared')?.source?.researchRunId).toBe('run-2')
  })
})

describe('reclassifyLatestArtifact', () => {
  it('throws MarkdownNotReadyError when no artifact exists yet for this workspace', async () => {
    await expect(reclassifyLatestArtifact('s1', 'WS-never-classified')).rejects.toThrow(MarkdownNotReadyError)
  })

  it('reclassifies the most recent artifact after the Markdown has been regenerated, never an older version', async () => {
    classifyChoice.mockResolvedValueOnce(choiceAnswer({ choice: 'tax' }))
    await classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-regen', researchRunId: 'run-1', markdown: '# v1', documentsUsed: 1 })
    classifyChoice.mockResolvedValueOnce(choiceAnswer({ choice: 'tax' }))
    await classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-regen', researchRunId: 'run-2', markdown: '# v2', documentsUsed: 2 })

    classifyChoice.mockResolvedValueOnce(choiceAnswer({ choice: 'corporate_advisory', confidence: 0.7 }))
    const profile = await reclassifyLatestArtifact('s1', 'WS-regen')

    expect(profile.source?.researchRunId).toBe('run-2')
    expect(profile.matterType.id).toBe('corporate_advisory')
    expect(profile.outdated).toBe(false)
  })
})

describe('toMatterProfile outdated detection', () => {
  it('marks a classification outdated once a newer Markdown artifact exists for the same workspace', async () => {
    classifyChoice.mockResolvedValueOnce(choiceAnswer())
    await classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-outdated', researchRunId: 'run-1', markdown: '# v1', documentsUsed: 1 })
    expect(toMatterProfile('s1', 'WS-outdated')?.outdated).toBe(false)

    // Markdown regenerated, but not yet reclassified.
    fakeRepo.saveMarkdownArtifact({ sessionId: 's1', workspaceId: 'WS-outdated', researchRunId: 'run-2', markdown: '# v2', markdownHash: 'hash-v2', documentsUsed: 2 })

    expect(toMatterProfile('s1', 'WS-outdated')?.outdated).toBe(true)
  })
})

describe('recordManualClassificationCorrection', () => {
  it('throws MatterProfileNotFoundError when no profile exists yet', () => {
    expect(() => recordManualClassificationCorrection('s1', 'WS-none', { matterTypeId: 'tax', correctedBy: 'alice' })).toThrow(
      MatterProfileNotFoundError,
    )
  })

  it('records an explicit user correction that overrides the AI matterType while preserving the AI result', async () => {
    classifyChoice.mockResolvedValueOnce(choiceAnswer({ choice: 'mergers_acquisitions', confidence: 0.9 }))
    await classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-correct', researchRunId: 'run-1', markdown: '# Matter', documentsUsed: 1 })

    const profile = recordManualClassificationCorrection('s1', 'WS-correct', { matterTypeId: 'corporate_advisory', correctedBy: 'alice' })

    expect(profile.matterType).toEqual({ id: 'corporate_advisory', label: 'Corporate Advisory', confidence: 0.9, status: 'classified' })
    expect(profile.override).toMatchObject({ matterTypeId: 'corporate_advisory', label: 'Corporate Advisory', correctedBy: 'alice' })
    // The original AI result is preserved under `classification`, not erased by the override.
    expect(profile.classification?.probabilities).toEqual([{ id: 'mergers_acquisitions', label: 'Mergers & Acquisitions', probability: 0.9 }])
  })
})
