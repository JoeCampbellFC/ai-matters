import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import { fetchKnowledgeVersions, restoreKnowledgeVersion, saveKnowledgeEdit } from './matterKnowledgeApi'

function mockFetchOnce(response: { status: number; body?: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
      json: async () => response.body,
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchKnowledgeVersions', () => {
  it('returns the version list', async () => {
    mockFetchOnce({ status: 200, body: { versions: [{ id: 'v1', versionNumber: 1 }] } })
    const versions = await fetchKnowledgeVersions('WS-1')
    expect(versions).toHaveLength(1)
  })
})

describe('saveKnowledgeEdit', () => {
  it('returns the new version on success', async () => {
    mockFetchOnce({ status: 200, body: { version: { id: 'v2', versionNumber: 2 } } })
    const version = await saveKnowledgeEdit('WS-1', { content: '# Updated', basedOnVersionId: 'v1' })
    expect(version.versionNumber).toBe(2)
  })

  it('throws stale_markdown_version as an ApiError on 409', async () => {
    mockFetchOnce({ status: 409, body: { error: { code: 'stale_markdown_version', message: 'stale' } } })
    await expect(saveKnowledgeEdit('WS-1', { content: '# Updated', basedOnVersionId: 'stale' })).rejects.toBeInstanceOf(ApiError)
  })
})

describe('restoreKnowledgeVersion', () => {
  it('returns the newly created version', async () => {
    mockFetchOnce({ status: 200, body: { version: { id: 'v3', versionNumber: 3 } } })
    const version = await restoreKnowledgeVersion('WS-1', 'v1')
    expect(version.versionNumber).toBe(3)
  })
})
