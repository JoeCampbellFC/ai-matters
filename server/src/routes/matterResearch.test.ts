import http from 'node:http'
import type { AddressInfo } from 'node:net'
import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyError } from '../httpErrors.js'
import { NotConnectedError } from '../mcp/errors.js'

const { getConnection } = vi.hoisted(() => ({ getConnection: vi.fn() }))
vi.mock('../mcp/connection.js', () => ({ getConnection }))

const runManagerMocks = vi.hoisted(() => ({
  findActiveRunForWorkspace: vi.fn(),
  startResearchRun: vi.fn(),
  getRun: vi.fn(),
  assertRunOwnedBySession: vi.fn(),
  subscribeToRun: vi.fn(),
  cancelRun: vi.fn(),
  recordHeartbeat: vi.fn(),
}))
vi.mock('../matterResearch/runManager.js', () => runManagerMocks)

const { matterResearchRouter } = await import('./matterResearch.js')
const { RunNotFoundError, RunNotReadyError } = await import('../matterResearch/errors.js')

function buildApp() {
  const app = express()
  app.use((req, _res, next) => {
    ;(req as unknown as { sessionID: string }).sessionID = 'test-session'
    next()
  })
  app.use('/api/matters', matterResearchRouter)
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const { status, code, message } = classifyError(error)
    res.status(status).json({ error: { code, message } })
  })
  return app
}

function fakeRun(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    runId: 'run-1',
    sessionId: 'test-session',
    workspaceId: 'WS-1',
    status: 'running',
    stage: 'initializing',
    documents: new Map(),
    coverage: undefined,
    result: undefined,
    error: undefined,
    ...overrides,
  }
}

beforeEach(() => {
  getConnection.mockReset()
  for (const mockFn of Object.values(runManagerMocks)) mockFn.mockReset()
  runManagerMocks.assertRunOwnedBySession.mockImplementation(() => {})
})

describe('POST /api/matters/:workspaceId/research', () => {
  it('returns 401 when there is no active MCP connection', async () => {
    getConnection.mockRejectedValue(new NotConnectedError())
    const res = await request(buildApp()).post('/api/matters/WS-1/research')
    expect(res.status).toBe(401)
  })

  it('returns 409 with the existing runId when a run is already in progress', async () => {
    getConnection.mockResolvedValue({ client: {}, tools: [] })
    runManagerMocks.findActiveRunForWorkspace.mockReturnValue(fakeRun({ runId: 'existing-run' }))
    const res = await request(buildApp()).post('/api/matters/WS-1/research')
    expect(res.status).toBe(409)
    expect(res.body.runId).toBe('existing-run')
    expect(runManagerMocks.startResearchRun).not.toHaveBeenCalled()
  })

  it('starts a new run and returns 202', async () => {
    getConnection.mockResolvedValue({ client: {}, tools: [] })
    runManagerMocks.findActiveRunForWorkspace.mockReturnValue(undefined)
    runManagerMocks.startResearchRun.mockReturnValue(fakeRun())
    const res = await request(buildApp()).post('/api/matters/WS-1/research')
    expect(res.status).toBe(202)
    expect(res.body).toMatchObject({ runId: 'run-1', status: 'running', stage: 'initializing' })
  })
})

describe('GET /api/matters/research/:runId', () => {
  it('returns 404 when the run does not exist', async () => {
    runManagerMocks.getRun.mockReturnValue(undefined)
    const res = await request(buildApp()).get('/api/matters/research/missing')
    expect(res.status).toBe(404)
  })

  it('returns 404 (not 403) when another session owns the run', async () => {
    runManagerMocks.getRun.mockReturnValue(fakeRun({ sessionId: 'other-session' }))
    runManagerMocks.assertRunOwnedBySession.mockImplementation(() => {
      throw new RunNotFoundError()
    })
    const res = await request(buildApp()).get('/api/matters/research/run-1')
    expect(res.status).toBe(404)
  })

  it('returns a snapshot with document and coverage projections', async () => {
    const run = fakeRun({
      documents: new Map([['DOC-1', { documentId: 'DOC-1', status: 'selected' }]]),
      coverage: { coveredTopics: ['overview'], gaps: [] },
    })
    runManagerMocks.getRun.mockReturnValue(run)
    const res = await request(buildApp()).get('/api/matters/research/run-1')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      runId: 'run-1',
      status: 'running',
      documents: [{ documentId: 'DOC-1', status: 'selected' }],
      coverage: { coveredTopics: ['overview'], gaps: [] },
    })
  })
})

describe('POST /api/matters/research/:runId/cancel', () => {
  it('cancels an owned run', async () => {
    const run = fakeRun()
    runManagerMocks.getRun.mockReturnValue(run)
    const res = await request(buildApp()).post('/api/matters/research/run-1/cancel')
    expect(res.status).toBe(202)
    expect(runManagerMocks.cancelRun).toHaveBeenCalledWith(run)
  })
})

describe('GET /api/matters/research/:runId/markdown', () => {
  it('returns 409 run_not_ready when the run has not succeeded', async () => {
    runManagerMocks.getRun.mockReturnValue(fakeRun({ status: 'running' }))
    const res = await request(buildApp()).get('/api/matters/research/run-1/markdown')
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('run_not_ready')
  })

  it('returns the markdown and citations once succeeded', async () => {
    runManagerMocks.getRun.mockReturnValue(
      fakeRun({ status: 'succeeded', result: { markdown: '# Report', citationRegistry: [{ marker: 'D01' }] } }),
    )
    const res = await request(buildApp()).get('/api/matters/research/run-1/markdown')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ markdown: '# Report', citations: [{ marker: 'D01' }] })
  })

  it('RunNotReadyError is a real exported class usable directly', () => {
    expect(new RunNotReadyError().name).toBe('RunNotReadyError')
  })
})

describe('GET /api/matters/research/:runId/events', () => {
  it('opens an SSE stream with the correct headers and replays events', async () => {
    runManagerMocks.getRun.mockReturnValue(fakeRun())
    runManagerMocks.subscribeToRun.mockImplementation((_run, _afterSeq, onEvent) => {
      onEvent({ seq: 1, ts: new Date().toISOString(), runId: 'run-1', type: 'activity', stage: 'initializing', message: 'hi' })
      return () => {}
    })

    const app = buildApp()
    const server = app.listen(0)
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const { port } = server.address() as AddressInfo

    const result = await new Promise<{ statusCode?: number; contentType?: string; body: string }>((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/api/matters/research/run-1/events`, (res) => {
        let body = ''
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString()
          if (body.includes('\n\n')) {
            resolve({ statusCode: res.statusCode, contentType: res.headers['content-type'], body })
            req.destroy()
          }
        })
      })
      req.on('error', () => {
        // Expected once we destroy() the request after reading the first frame.
      })
    })

    server.close()

    expect(result.statusCode).toBe(200)
    expect(result.contentType).toContain('text/event-stream')
    expect(result.body).toContain('event: activity')
    expect(result.body).toContain('"message":"hi"')
  })
})
