import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authMock, disconnectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  disconnectMock: vi.fn(),
}))

vi.mock('@modelcontextprotocol/sdk/client/auth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@modelcontextprotocol/sdk/client/auth.js')>()
  return { ...actual, auth: authMock }
})
vi.mock('../mcp/connection.js', () => ({ disconnect: disconnectMock }))

const { authRouter } = await import('./auth.js')

function buildApp() {
  const app = express()
  app.use((req, _res, next) => {
    ;(req as unknown as { session: Record<string, unknown>; sessionID: string }).session = {}
    ;(req as unknown as { sessionID: string }).sessionID = 'test-session'
    next()
  })
  app.use('/api/auth', authRouter)
  return app
}

beforeEach(() => {
  authMock.mockReset()
  disconnectMock.mockReset()
})

describe('GET /api/auth/connect', () => {
  it('redirects to the authorization URL produced by the OAuth provider', async () => {
    authMock.mockImplementation(async (provider) => {
      provider.redirectToAuthorization(new URL('https://cloudimanage.com/mcp/oauth2/authorize?client_id=abc'))
      return 'REDIRECT'
    })
    const res = await request(buildApp()).get('/api/auth/connect')
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('https://cloudimanage.com/mcp/oauth2/authorize?client_id=abc')
  })

  it('redirects straight back into the app when already authorized', async () => {
    authMock.mockResolvedValue('AUTHORIZED')
    const res = await request(buildApp()).get('/api/auth/connect')
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('/workspaces')
  })

  it('redirects to a connection error page when the OAuth flow throws', async () => {
    authMock.mockRejectedValue(new Error('discovery failed'))
    const res = await request(buildApp()).get('/api/auth/connect')
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('connection=error')
  })
})

describe('GET /api/auth/callback', () => {
  it('rejects a callback without a matching state parameter', async () => {
    const res = await request(buildApp()).get('/api/auth/callback').query({ code: 'abc', state: 'unknown' })
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('connection=error')
    expect(authMock).not.toHaveBeenCalled()
  })

  it('redirects to an error page when the authorization server reports an error', async () => {
    const res = await request(buildApp()).get('/api/auth/callback').query({ error: 'access_denied' })
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('connection=error')
    expect(authMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/disconnect', () => {
  it('disconnects the session and returns 204', async () => {
    disconnectMock.mockResolvedValue(undefined)
    const res = await request(buildApp()).post('/api/auth/disconnect')
    expect(res.status).toBe(204)
    expect(disconnectMock).toHaveBeenCalledTimes(1)
  })
})
