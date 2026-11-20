import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { ToolUnavailableError, NotConnectedError, PermissionDeniedError } from '../mcp/errors.js'
import { classifyError } from '../httpErrors.js'

const { getConnection } = vi.hoisted(() => ({ getConnection: vi.fn() }))
vi.mock('../mcp/connection.js', () => ({ getConnection }))

const { workspacesRouter } = await import('./workspaces.js')

function buildApp() {
  const app = express()
  app.use((req, _res, next) => {
    // Minimal stand-in for express-session in these unit tests.
    ;(req as unknown as { sessionID: string }).sessionID = 'test-session'
    next()
  })
  app.use('/api/workspaces', workspacesRouter)
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const { status, code, message } = classifyError(error)
    res.status(status).json({ error: { code, message } })
  })
  return app
}

const SEARCH_TOOL: Tool = {
  name: 'search_workspaces',
  inputSchema: { type: 'object', properties: { criteria: { type: 'string' } } },
}

const RECENT_TOOL: Tool = {
  name: 'get_recent_workspaces',
  inputSchema: { type: 'object', properties: {} },
}

function toolResult(workspaces: Array<Record<string, unknown>>): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ workspaces }) }] }
}

beforeEach(() => {
  getConnection.mockReset()
})

describe('GET /api/workspaces/search', () => {
  it('returns 400 for a missing search term', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/workspaces/search').query({ q: '' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('invalid_request')
    expect(getConnection).not.toHaveBeenCalled()
  })

  it('returns 401 not_connected when there is no active session', async () => {
    getConnection.mockRejectedValue(new NotConnectedError())
    const app = buildApp()
    const res = await request(app).get('/api/workspaces/search').query({ q: 'acme' })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('not_connected')
  })

  it('returns 503 when search_workspaces is not among the discovered tools', async () => {
    getConnection.mockResolvedValue({ client: { callTool: vi.fn() }, tools: [RECENT_TOOL] })
    const app = buildApp()
    const res = await request(app).get('/api/workspaces/search').query({ q: 'acme' })
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('tool_unavailable')
  })

  it('returns 403 permission_denied when the MCP connection reports it', async () => {
    getConnection.mockRejectedValue(new PermissionDeniedError())
    const app = buildApp()
    const res = await request(app).get('/api/workspaces/search').query({ q: 'acme' })
    expect(res.status).toBe(403)
  })

  it('maps the query onto the discovered schema and normalizes the response', async () => {
    const callTool = vi.fn().mockResolvedValue(toolResult([{ id: 'WS-1', name: 'Acme Matter' }]))
    getConnection.mockResolvedValue({ client: { callTool }, tools: [SEARCH_TOOL] })
    const app = buildApp()
    const res = await request(app).get('/api/workspaces/search').query({ q: 'acme' })

    expect(res.status).toBe(200)
    expect(callTool).toHaveBeenCalledWith({ name: 'search_workspaces', arguments: { criteria: 'acme' } })
    expect(res.body.workspaces).toEqual([
      expect.objectContaining({ id: 'WS-1', name: 'Acme Matter' }),
    ])
  })
})

describe('GET /api/workspaces/recent', () => {
  it('returns 503 when get_recent_workspaces is unavailable', async () => {
    getConnection.mockRejectedValue(new ToolUnavailableError('get_recent_workspaces'))
    const app = buildApp()
    const res = await request(app).get('/api/workspaces/recent')
    expect(res.status).toBe(503)
  })

  it('returns normalized recent workspaces', async () => {
    const callTool = vi.fn().mockResolvedValue(toolResult([{ id: 'WS-9', name: 'Recent Matter' }]))
    getConnection.mockResolvedValue({ client: { callTool }, tools: [RECENT_TOOL] })
    const app = buildApp()
    const res = await request(app).get('/api/workspaces/recent')

    expect(res.status).toBe(200)
    expect(callTool).toHaveBeenCalledWith({ name: 'get_recent_workspaces', arguments: {} })
    expect(res.body.workspaces).toHaveLength(1)
  })
})
