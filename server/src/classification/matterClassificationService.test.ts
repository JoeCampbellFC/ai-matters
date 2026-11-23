import { describe, expect, it, vi } from 'vitest'

const { classifyChoice } = vi.hoisted(() => ({ classifyChoice: vi.fn() }))
vi.mock('./decisionsClient.js', () => ({ classifyChoice }))

/**
 * A tiny in-memory stand-in for classificationRepository.js -- real
 * persistence behavior (artifact versioning, per-field current/history,
 * override and lastError clearing) is already covered by
 * classificationRepository.test.ts against the real file-backed store; this
 * fake exists only so the *service's* orchestration (triggering, dedup,
 * per-field status mapping, refusal/failure isolation, reclassify, manual
 * correction) can be tested without real disk I/O, while still exercising
 * the exact same call sequence.
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
  function ensureProfile(sessionId: string, workspaceId: string, workspaceName?: string) {
    let profile = findProfile(sessionId, workspaceId)
    if (!profile) {
      profile = { sessionId, workspaceId, workspaceName, fields: {}, history: {}, overrides: {}, lastErrors: {}, updatedAt: new Date().toISOString() }
      state.profiles.push(profile)
    }
    return profile
  }
  const upsertFieldClassification = vi.fn(
    ({ sessionId, workspaceId, workspaceName, record }: { sessionId: string; workspaceId: string; workspaceName?: string; record: Record<string, unknown> }) => {
      const profile = ensureProfile(sessionId, workspaceId, workspaceName)
      const fields = profile.fields as Record<string, unknown>
      const history = profile.history as Record<string, unknown[]>
      const fieldId = record.fieldId as string
      const existing = fields[fieldId]
      if (existing) history[fieldId] = [...(history[fieldId] ?? []), existing]
      fields[fieldId] = record
      delete (profile.overrides as Record<string, unknown>)[fieldId]
      delete (profile.lastErrors as Record<string, unknown>)[fieldId]
      return profile
    },
  )
  const recordFieldClassificationFailure = vi.fn(
    (sessionId: string, workspaceId: string, workspaceName: string | undefined, fieldId: string, error: { code: string; message: string }) => {
      const profile = ensureProfile(sessionId, workspaceId, workspaceName)
      ;(profile.lastErrors as Record<string, unknown>)[fieldId] = { ...error, at: new Date().toISOString() }
      return profile
    },
  )
  const recordManualCorrection = vi.fn((sessionId: string, workspaceId: string, correction: { fieldId: string }) => {
    const profile = findProfile(sessionId, workspaceId)
    if (!profile) return undefined
    ;(profile.overrides as Record<string, unknown>)[correction.fieldId] = correction
    return profile
  })
  return {
    fakeRepo: {
      state,
      saveMarkdownArtifact,
      getMarkdownArtifact,
      getLatestMarkdownArtifact,
      getProfileRecord,
      upsertFieldClassification,
      recordFieldClassificationFailure,
      recordManualCorrection,
    },
  }
})

vi.mock('./classificationRepository.js', () => fakeRepo)

const { classifyFromCompletedRun, reclassifyLatestArtifact, recordManualClassificationCorrection, toMatterProfile } =
  await import('./matterClassificationService.js')
const { ClassificationInProgressError, MarkdownNotReadyError, MatterProfileNotFoundError } = await import('./errors.js')
const { CLASSIFICATION_FIELDS } = await import('./classificationFields.js')

/** Generic default: always answers with whichever field's own first choice is -- valid for any of the 16 fields. */
function installGenericClassifyMock() {
  classifyChoice.mockImplementation(async (input: { choices: Array<{ value: string }> }) => ({
    type: 'choice' as const,
    choice: input.choices[0]!.value,
    confidence: 0.9,
    probabilities: input.choices.map((c, i) => ({ value: c.value, probability: i === 0 ? 0.9 : 0.01 })),
  }))
}

function fieldView(profile: Awaited<ReturnType<typeof toMatterProfile>>, fieldId: string) {
  return profile?.fields.find((f) => f.fieldId === fieldId)
}

describe('classifyFromCompletedRun', () => {
  it('never classifies an incomplete run -- throws MarkdownNotReadyError for empty Markdown', async () => {
    await expect(
      classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-empty', researchRunId: 'run-1', markdown: '   ', documentsUsed: 0 }),
    ).rejects.toThrow(MarkdownNotReadyError)
    expect(classifyChoice).not.toHaveBeenCalled()
  })

  it('classifies every field (one Decisions API call each) and produces a "classified" matter_type at high confidence', async () => {
    installGenericClassifyMock()
    const started = vi.fn()
    const completed = vi.fn()
    const fieldStarted = vi.fn()
    const fieldCompleted = vi.fn()

    const profile = await classifyFromCompletedRun(
      { sessionId: 's1', workspaceId: 'WS-1', workspaceName: 'Acme Matter', researchRunId: 'run-1', markdown: '# Matter', documentsUsed: 5 },
      { onStarted: started, onCompleted: completed, onFieldStarted: fieldStarted, onFieldCompleted: fieldCompleted },
    )

    expect(classifyChoice).toHaveBeenCalledTimes(CLASSIFICATION_FIELDS.length)
    expect(started).toHaveBeenCalledOnce()
    expect(completed).toHaveBeenCalledWith(profile)
    expect(fieldStarted).toHaveBeenCalledTimes(CLASSIFICATION_FIELDS.length)
    expect(fieldCompleted).toHaveBeenCalledTimes(CLASSIFICATION_FIELDS.length)
    expect(profile.fields).toHaveLength(CLASSIFICATION_FIELDS.length)

    expect(fieldView(profile, 'matter_type')).toEqual({
      fieldId: 'matter_type',
      fieldLabel: 'Matter Type',
      valueId: 'mergers_acquisitions',
      label: 'Mergers & Acquisitions',
      confidence: 0.9,
      status: 'classified',
      probabilities: expect.any(Array),
    })
    expect(profile.source?.documentsUsed).toBe(5)
    expect(profile.outdated).toBe(false)
  })

  it('marks a refusal as needs_review without inventing a category', async () => {
    installGenericClassifyMock()
    classifyChoice.mockResolvedValueOnce({ type: 'refusal', name: 'matter_type' })
    const profile = await classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-refusal', researchRunId: 'run-1', markdown: '# Matter', documentsUsed: 1 })
    expect(fieldView(profile, 'matter_type')).toMatchObject({ valueId: null, label: null, confidence: null, status: 'needs_review' })
  })

  it('rejects a Decisions API answer that names an unrecognized value, without blocking the other 15 fields', async () => {
    installGenericClassifyMock()
    classifyChoice.mockResolvedValueOnce({
      type: 'choice',
      choice: 'not_a_real_category',
      confidence: 0.9,
      probabilities: [],
    })
    const fieldFailed = vi.fn()

    const profile = await classifyFromCompletedRun(
      { sessionId: 's1', workspaceId: 'WS-bad', researchRunId: 'run-1', markdown: '# Matter', documentsUsed: 1 },
      { onFieldFailed: fieldFailed },
    )

    expect(fieldFailed).toHaveBeenCalledTimes(1)
    expect(fakeRepo.recordFieldClassificationFailure).toHaveBeenCalledWith('s1', 'WS-bad', undefined, 'matter_type', expect.any(Object))
    expect(fieldView(profile, 'matter_type')?.status).toBe('failed')
    // The other 15 fields still classified successfully -- one field's failure never blocks the batch.
    expect(fieldView(profile, 'practice_area')?.status).toBe('classified')
    expect(classifyChoice).toHaveBeenCalledTimes(CLASSIFICATION_FIELDS.length)
  })

  it('prevents a duplicate concurrent classification job for the same session+workspace', async () => {
    installGenericClassifyMock()
    let resolveFirstField: ((value: Awaited<ReturnType<typeof classifyChoice>>) => void) | undefined
    classifyChoice.mockImplementationOnce(() => new Promise((resolve) => (resolveFirstField = resolve)))

    const first = classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-dup', researchRunId: 'run-1', markdown: '# Matter', documentsUsed: 1 })
    const second = classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-dup', researchRunId: 'run-1', markdown: '# Matter', documentsUsed: 1 })

    await expect(second).rejects.toThrow(ClassificationInProgressError)
    resolveFirstField?.({ type: 'choice', choice: 'mergers_acquisitions', confidence: 0.9, probabilities: [] })
    await first
  })

  it('isolates profiles by session -- two sessions classifying the same workspace id never share state', async () => {
    installGenericClassifyMock()
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
    installGenericClassifyMock()
    await classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-regen', researchRunId: 'run-1', markdown: '# v1', documentsUsed: 1 })
    await classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-regen', researchRunId: 'run-2', markdown: '# v2', documentsUsed: 2 })

    classifyChoice.mockResolvedValueOnce({ type: 'choice', choice: 'corporate_advisory', confidence: 0.7, probabilities: [] })
    const profile = await reclassifyLatestArtifact('s1', 'WS-regen')

    expect(profile.source?.researchRunId).toBe('run-2')
    expect(fieldView(profile, 'matter_type')?.valueId).toBe('corporate_advisory')
    expect(profile.outdated).toBe(false)
  })
})

describe('toMatterProfile outdated detection', () => {
  it('marks the profile outdated once a newer Markdown artifact exists for the same workspace', async () => {
    installGenericClassifyMock()
    await classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-outdated', researchRunId: 'run-1', markdown: '# v1', documentsUsed: 1 })
    expect(toMatterProfile('s1', 'WS-outdated')?.outdated).toBe(false)

    // Markdown regenerated, but not yet reclassified.
    fakeRepo.saveMarkdownArtifact({ sessionId: 's1', workspaceId: 'WS-outdated', researchRunId: 'run-2', markdown: '# v2', markdownHash: 'hash-v2', documentsUsed: 2 })

    expect(toMatterProfile('s1', 'WS-outdated')?.outdated).toBe(true)
  })

  it('shows a field that has not been classified yet as pending, independent of other fields already classified', () => {
    const artifact = fakeRepo.saveMarkdownArtifact({
      sessionId: 's1',
      workspaceId: 'WS-partial',
      researchRunId: 'run-1',
      markdown: '# M',
      markdownHash: 'hash-partial',
      documentsUsed: 1,
    })
    fakeRepo.upsertFieldClassification({
      sessionId: 's1',
      workspaceId: 'WS-partial',
      record: {
        id: 'rec-1',
        fieldId: 'matter_type',
        markdownArtifactId: artifact.id as string,
        markdownHash: 'hash-partial',
        status: 'classified',
        valueId: 'tax',
        label: 'Tax',
        confidence: 0.9,
        probabilities: [],
        model: 'gpt-6-luna',
        deploymentName: 'gpt-6-luna',
        taxonomyVersion: '2026.1',
        inputMode: 'full',
        classifiedAt: new Date().toISOString(),
      },
    })

    const profile = toMatterProfile('s1', 'WS-partial')
    expect(fieldView(profile, 'matter_type')?.status).toBe('classified')
    expect(fieldView(profile, 'practice_area')).toMatchObject({ status: 'pending', valueId: null })
  })
})

describe('recordManualClassificationCorrection', () => {
  it('throws MatterProfileNotFoundError when no profile exists yet', () => {
    expect(() =>
      recordManualClassificationCorrection('s1', 'WS-none', { fieldId: 'matter_type', valueId: 'tax', correctedBy: 'alice' }),
    ).toThrow(MatterProfileNotFoundError)
  })

  it('records an explicit user correction for one field that overrides its AI value while preserving the AI result', async () => {
    installGenericClassifyMock()
    await classifyFromCompletedRun({ sessionId: 's1', workspaceId: 'WS-correct', researchRunId: 'run-1', markdown: '# Matter', documentsUsed: 1 })

    const profile = recordManualClassificationCorrection('s1', 'WS-correct', {
      fieldId: 'matter_type',
      valueId: 'corporate_advisory',
      correctedBy: 'alice',
    })

    const corrected = fieldView(profile, 'matter_type')
    expect(corrected).toMatchObject({ valueId: 'corporate_advisory', label: 'Corporate Advisory', status: 'classified' })
    expect(corrected?.override).toMatchObject({ fieldId: 'matter_type', valueId: 'corporate_advisory', label: 'Corporate Advisory', correctedBy: 'alice' })
    // The original AI result is preserved under probabilities, not erased by the override.
    expect(corrected?.probabilities.some((p) => p.id === 'mergers_acquisitions')).toBe(true)
    // Other fields are untouched by a correction scoped to matter_type.
    expect(fieldView(profile, 'practice_area')?.override).toBeUndefined()
  })
})
