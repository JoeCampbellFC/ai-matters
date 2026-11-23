import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Fakes the filesystem as an in-memory Map so these tests never touch real
 * disk -- the repository's atomic write-then-rename is simulated faithfully
 * enough (tmp path write, then "rename" overwrites the real path) to exercise
 * the real persist()/load() logic.
 */
const { fakeFiles } = vi.hoisted(() => ({ fakeFiles: new Map<string, string>() }))

vi.mock('node:fs', () => ({
  existsSync: (path: string) => fakeFiles.has(path),
  mkdirSync: () => undefined,
  readFileSync: (path: string) => {
    const content = fakeFiles.get(path)
    if (content === undefined) throw new Error(`ENOENT: ${path}`)
    return content
  },
  writeFileSync: (path: string, content: string) => {
    fakeFiles.set(path, content)
  },
  renameSync: (from: string, to: string) => {
    const content = fakeFiles.get(from)
    if (content !== undefined) {
      fakeFiles.set(to, content)
      fakeFiles.delete(from)
    }
  },
}))

const {
  getLatestMarkdownArtifact,
  getMarkdownArtifact,
  getProfileRecord,
  recordFieldClassificationFailure,
  recordManualCorrection,
  saveMarkdownArtifact,
  upsertFieldClassification,
  __resetStoreForTests,
} = await import('./classificationRepository.js')

function record(overrides: Partial<Parameters<typeof upsertFieldClassification>[0]['record']> = {}) {
  return {
    id: 'rec-1',
    fieldId: 'matter_type' as const,
    markdownArtifactId: 'artifact-1',
    markdownHash: 'hash-1',
    status: 'classified' as const,
    valueId: 'mergers_acquisitions',
    label: 'Mergers & Acquisitions',
    confidence: 0.9,
    probabilities: [],
    model: 'gpt-6-luna',
    deploymentName: 'gpt-6-luna',
    taxonomyVersion: '2026.1',
    inputMode: 'full' as const,
    classifiedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('classificationRepository', () => {
  beforeEach(() => {
    fakeFiles.clear()
    __resetStoreForTests()
  })

  it('saves a Markdown artifact and retrieves it as the latest for its workspace', () => {
    const artifact = saveMarkdownArtifact({
      sessionId: 's1',
      workspaceId: 'WS-1',
      researchRunId: 'run-1',
      markdown: '# Matter',
      markdownHash: 'hash-1',
      documentsUsed: 3,
    })
    expect(artifact.version).toBe(1)
    expect(getLatestMarkdownArtifact('s1', 'WS-1')?.id).toBe(artifact.id)
    expect(getMarkdownArtifact(artifact.id)).toEqual(artifact)
  })

  it('increments the artifact version on a subsequent save for the same session+workspace', () => {
    saveMarkdownArtifact({ sessionId: 's1', workspaceId: 'WS-1', researchRunId: 'run-1', markdown: 'v1', markdownHash: 'h1', documentsUsed: 1 })
    const second = saveMarkdownArtifact({ sessionId: 's1', workspaceId: 'WS-1', researchRunId: 'run-2', markdown: 'v2', markdownHash: 'h2', documentsUsed: 2 })
    expect(second.version).toBe(2)
    expect(getLatestMarkdownArtifact('s1', 'WS-1')?.markdown).toBe('v2')
  })

  it('isolates artifacts and profiles by session -- a different session never sees another session\'s data', () => {
    saveMarkdownArtifact({ sessionId: 's1', workspaceId: 'WS-1', researchRunId: 'run-1', markdown: 'v1', markdownHash: 'h1', documentsUsed: 1 })
    expect(getLatestMarkdownArtifact('s2', 'WS-1')).toBeUndefined()

    upsertFieldClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record() })
    expect(getProfileRecord('s2', 'WS-1')).toBeUndefined()
  })

  it('records a successful field classification as current, pushing any prior result for that field into its history', () => {
    upsertFieldClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record({ id: 'rec-1' }) })
    upsertFieldClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record({ id: 'rec-2' }) })

    const profile = getProfileRecord('s1', 'WS-1')
    expect(profile?.fields.matter_type?.id).toBe('rec-2')
    expect(profile?.history.matter_type?.map((r) => r.id)).toEqual(['rec-1'])
  })

  it('keeps each field\'s results independent -- classifying one field never disturbs another', () => {
    upsertFieldClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record({ fieldId: 'matter_type', id: 'rec-mt' }) })
    upsertFieldClassification({
      sessionId: 's1',
      workspaceId: 'WS-1',
      record: record({ fieldId: 'practice_area', id: 'rec-pa', valueId: 'tax', label: 'Tax' }),
    })

    const profile = getProfileRecord('s1', 'WS-1')
    expect(profile?.fields.matter_type?.id).toBe('rec-mt')
    expect(profile?.fields.practice_area?.id).toBe('rec-pa')
    expect(profile?.fields.practice_area?.label).toBe('Tax')
  })

  it('clears a field\'s manual override and last error when a fresh classification for that field is recorded', () => {
    upsertFieldClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record() })
    recordManualCorrection('s1', 'WS-1', {
      fieldId: 'matter_type',
      valueId: 'corporate_advisory',
      label: 'Corporate Advisory',
      correctedBy: 'alice',
      correctedAt: new Date().toISOString(),
    })
    expect(getProfileRecord('s1', 'WS-1')?.overrides.matter_type).toBeDefined()

    upsertFieldClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record({ id: 'rec-2' }) })
    expect(getProfileRecord('s1', 'WS-1')?.overrides.matter_type).toBeUndefined()
  })

  it('records a field failure without disturbing that field\'s (or any other field\'s) existing successful result', () => {
    upsertFieldClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record({ fieldId: 'matter_type' }) })
    upsertFieldClassification({
      sessionId: 's1',
      workspaceId: 'WS-1',
      record: record({ fieldId: 'practice_area', id: 'rec-pa', valueId: 'tax', label: 'Tax' }),
    })
    recordFieldClassificationFailure('s1', 'WS-1', undefined, 'industry_sector', { code: 'decisions_request_error', message: 'boom' })

    const profile = getProfileRecord('s1', 'WS-1')
    expect(profile?.fields.matter_type?.id).toBe('rec-1')
    expect(profile?.fields.practice_area?.id).toBe('rec-pa')
    expect(profile?.lastErrors.industry_sector?.message).toBe('boom')
  })

  it('persists across a fresh load (simulating a server restart)', async () => {
    saveMarkdownArtifact({ sessionId: 's1', workspaceId: 'WS-1', researchRunId: 'run-1', markdown: 'v1', markdownHash: 'h1', documentsUsed: 1 })
    upsertFieldClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record() })

    vi.resetModules()
    const reloaded = await import('./classificationRepository.js')
    expect(reloaded.getLatestMarkdownArtifact('s1', 'WS-1')?.markdown).toBe('v1')
    expect(reloaded.getProfileRecord('s1', 'WS-1')?.fields.matter_type?.id).toBe('rec-1')
  })
})
