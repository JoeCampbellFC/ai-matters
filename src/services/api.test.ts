import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './api'

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

describe('apiRequest', () => {
  it('returns the parsed body on success', async () => {
    mockFetchOnce({ status: 200, body: { workspaces: [] } })
    const result = await apiRequest<{ workspaces: unknown[] }>('/workspaces/recent')
    expect(result).toEqual({ workspaces: [] })
  })

  it('returns undefined for a 204 response without parsing the body', async () => {
    mockFetchOnce({ status: 204 })
    const result = await apiRequest<void>('/auth/disconnect', { method: 'POST' })
    expect(result).toBeUndefined()
  })

  it('throws an ApiError with the server-provided code and message', async () => {
    mockFetchOnce({ status: 401, body: { error: { code: 'not_connected', message: 'Not connected.' } } })
    await expect(apiRequest('/workspaces/recent')).rejects.toMatchObject({
      code: 'not_connected',
      message: 'Not connected.',
      status: 401,
    })
  })

  it('falls back to a generic message when the error body is missing', async () => {
    mockFetchOnce({ status: 500, body: undefined })
    const error = await apiRequest('/workspaces/recent').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('unknown_error')
  })
})
