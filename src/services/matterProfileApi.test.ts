import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api'
import { fetchMatterProfile, fetchMattersBatch, updateProfileFields } from './matterProfileApi'

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

describe('fetchMatterProfile', () => {
  it('returns undefined (not an error) on 404', async () => {
    mockFetchOnce({ status: 404, body: { error: { code: 'matter_not_found', message: 'not found' } } })
    await expect(fetchMatterProfile('WS-1')).resolves.toBeUndefined()
  })

  it('returns the profile on success', async () => {
    mockFetchOnce({ status: 200, body: { matterId: 'm-1', workspaceId: 'WS-1', outdated: false, fields: [], profileFields: [] } })
    const profile = await fetchMatterProfile('WS-1')
    expect(profile?.matterId).toBe('m-1')
  })

  it('rethrows non-404 errors', async () => {
    mockFetchOnce({ status: 403, body: { error: { code: 'permission_denied', message: 'denied' } } })
    await expect(fetchMatterProfile('WS-1')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('fetchMattersBatch', () => {
  it('returns [] without calling fetch when given no ids', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await expect(fetchMattersBatch([])).resolves.toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches and returns matter summaries', async () => {
    mockFetchOnce({ status: 200, body: { matters: [{ workspaceId: 'WS-1', workspaceName: 'Acme', status: 'active', hasKnowledge: true, updatedAt: '2026-01-01T00:00:00Z' }] } })
    const result = await fetchMattersBatch(['WS-1'])
    expect(result).toHaveLength(1)
    expect(result[0]!.workspaceId).toBe('WS-1')
  })
})

describe('updateProfileFields', () => {
  it('throws a concurrency_conflict ApiError on 409', async () => {
    mockFetchOnce({ status: 409, body: { error: { code: 'concurrency_conflict', message: 'conflict' } } })
    await expect(updateProfileFields('WS-1', [{ fieldKey: 'matter_name', value: 'New Name', expectedVersion: 1 }])).rejects.toMatchObject({
      code: 'concurrency_conflict',
      status: 409,
    })
  })

  it('returns the refreshed profile on success', async () => {
    mockFetchOnce({ status: 200, body: { matterId: 'm-1', workspaceId: 'WS-1', outdated: false, fields: [], profileFields: [] } })
    const profile = await updateProfileFields('WS-1', [{ fieldKey: 'matter_name', value: 'New Name', expectedVersion: 1 }])
    expect(profile.matterId).toBe('m-1')
  })
})
