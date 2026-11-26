import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchContainerChildren, searchDocuments } from './documentsApi'

function mockFetchOnce(response: { status: number; body?: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    json: async () => response.body,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchContainerChildren', () => {
  it('requests the workspace root with no query params when nothing is passed', async () => {
    const fetchMock = mockFetchOnce({ status: 200, body: { matterId: 'm1', children: [] } })
    await fetchContainerChildren('WS-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/matters/WS-1/documents/children', expect.anything())
  })

  it('includes containerId/containerType/cursor when given', async () => {
    const fetchMock = mockFetchOnce({ status: 200, body: { matterId: 'm1', children: [] } })
    await fetchContainerChildren('WS-1', { containerId: 'folder-1', containerType: 'folder', cursor: 'page-2' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/matters/WS-1/documents/children?containerId=folder-1&containerType=folder&cursor=page-2',
      expect.anything(),
    )
  })
})

describe('searchDocuments', () => {
  it('returns only verified hits', async () => {
    mockFetchOnce({
      status: 200,
      body: { matterId: 'm1', hits: [{ documentId: 'doc-1', name: 'Agreement.pdf', raw: {}, verifiedBy: 'workspace_listing' }], excludedCount: 1 },
    })
    const result = await searchDocuments('WS-1', 'arbitration')
    expect(result.hits).toHaveLength(1)
    expect(result.excludedCount).toBe(1)
  })
})
