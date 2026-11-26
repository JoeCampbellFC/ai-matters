import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import { fetchDashboard, generateDashboard } from './dashboardApi'

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

describe('fetchDashboard', () => {
  it('returns generated: false with no projection when nothing is cached yet', async () => {
    mockFetchOnce({ status: 200, body: { generated: false, markdownVersionId: 'v1', citationRegistry: [] } })
    const result = await fetchDashboard('WS-1')
    expect(result.generated).toBe(false)
    expect(result.projection).toBeUndefined()
  })

  it('returns the cached projection when one exists', async () => {
    mockFetchOnce({
      status: 200,
      body: { generated: true, projection: { schemaVersion: 'v1', widgets: [], generatedAt: '2026-01-01T00:00:00.000Z' }, markdownVersionId: 'v1', citationRegistry: [] },
    })
    const result = await fetchDashboard('WS-1')
    expect(result.generated).toBe(true)
    expect(result.projection?.widgets).toEqual([])
  })

  it('maps a 409 (no published Markdown) to an ApiError', async () => {
    mockFetchOnce({ status: 409, body: { error: { code: 'markdown_not_published', message: 'none yet' } } })
    await expect(fetchDashboard('WS-1')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('generateDashboard', () => {
  it('returns the generated projection', async () => {
    mockFetchOnce({
      status: 201,
      body: { generated: true, projection: { schemaVersion: 'v1', widgets: [], generatedAt: '2026-01-01T00:00:00.000Z' }, markdownVersionId: 'v1', citationRegistry: [], wasCached: false },
    })
    const result = await generateDashboard('WS-1')
    expect(result.wasCached).toBe(false)
  })
})
