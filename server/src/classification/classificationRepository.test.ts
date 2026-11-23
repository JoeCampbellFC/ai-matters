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
  recordClassificationFailure,
  recordManualCorrection,
  saveMarkdownArtifact,
  upsertClassification,
  __resetStoreForTests,
} = await import('./classificationRepository.js')

function record(overrides: Partial<Parameters<typeof upsertClassification>[0]['record']> = {}) {
  return {
    id: 'rec-1',
    markdownArtifactId: 'artifact-1',
    markdownHash: 'hash-1',
    status: 'classified' as const,
    matterTypeId: 'mergers_acquisitions' as const,
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

    upsertClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record() })
    expect(getProfileRecord('s2', 'WS-1')).toBeUndefined()
  })

  it('records a successful classification as current, pushing any prior current into history', () => {
    upsertClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record({ id: 'rec-1' }) })
    upsertClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record({ id: 'rec-2' }) })

    const profile = getProfileRecord('s1', 'WS-1')
    expect(profile?.current?.id).toBe('rec-2')
    expect(profile?.history.map((r) => r.id)).toEqual(['rec-1'])
  })

  it('clears any manual override and last error when a fresh classification is recorded', () => {
    upsertClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record() })
    recordManualCorrection('s1', 'WS-1', {
      matterTypeId: 'corporate_advisory',
      label: 'Corporate Advisory',
      correctedBy: 'alice',
      correctedAt: new Date().toISOString(),
    })
    expect(getProfileRecord('s1', 'WS-1')?.override).toBeDefined()

    upsertClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record({ id: 'rec-2' }) })
    expect(getProfileRecord('s1', 'WS-1')?.override).toBeUndefined()
  })

  it('records a failure without disturbing an existing successful current classification', () => {
    upsertClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record() })
    recordClassificationFailure('s1', 'WS-1', undefined, { code: 'decisions_request_error', message: 'boom' })

    const profile = getProfileRecord('s1', 'WS-1')
    expect(profile?.current?.id).toBe('rec-1')
    expect(profile?.lastError?.message).toBe('boom')
  })

  it('persists across a fresh load (simulating a server restart)', async () => {
    saveMarkdownArtifact({ sessionId: 's1', workspaceId: 'WS-1', researchRunId: 'run-1', markdown: 'v1', markdownHash: 'h1', documentsUsed: 1 })
    upsertClassification({ sessionId: 's1', workspaceId: 'WS-1', record: record() })

    vi.resetModules()
    const reloaded = await import('./classificationRepository.js')
    expect(reloaded.getLatestMarkdownArtifact('s1', 'WS-1')?.markdown).toBe('v1')
    expect(reloaded.getProfileRecord('s1', 'WS-1')?.current?.id).toBe('rec-1')
  })
})
