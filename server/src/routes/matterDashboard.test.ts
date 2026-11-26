import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyError } from '../httpErrors.js'

const accessMocks = vi.hoisted(() => ({
  resolveAccessibleMatter: vi.fn(),
}))
vi.mock('../services/matterAccessService.js', () => accessMocks)

const knowledgeServiceMocks = vi.hoisted(() => ({
  getCurrentVersionOrThrow: vi.fn(),
}))
vi.mock('../services/matterKnowledgeService.js', () => knowledgeServiceMocks)

const projectionServiceMocks = vi.hoisted(() => ({
  getExistingDashboardProjection: vi.fn(),
  getOrCreateDashboardProjection: vi.fn(),
}))
vi.mock('../dashboard/dashboardProjectionService.js', () => projectionServiceMocks)

const { matterDashboardRouter } = await import('./matterDashboard.js')
const { MarkdownNotPublishedError } = await import('../database/errors.js')

function buildApp() {
  const app = express()
  app.use('/api/matters', matterDashboardRouter)
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const { status, code, message } = classifyError(error)
    res.status(status).json({ error: { code, message } })
  })
  return app
}

const fakeProjection = { schemaVersion: 'v1', widgets: [], generatedAt: '2026-01-01T00:00:00.000Z' }

beforeEach(() => {
  for (const mockFn of Object.values(accessMocks)) mockFn.mockReset()
  for (const mockFn of Object.values(knowledgeServiceMocks)) mockFn.mockReset()
  for (const mockFn of Object.values(projectionServiceMocks)) mockFn.mockReset()
  accessMocks.resolveAccessibleMatter.mockResolvedValue({ matter: { id: 'matter-1' }, workspace: { id: 'WS-1', name: 'Acme', raw: {} } })
})

describe('GET /api/matters/:workspaceId/dashboard', () => {
  it('returns generated: false with no LLM call when nothing is cached yet', async () => {
    projectionServiceMocks.getExistingDashboardProjection.mockResolvedValue(undefined)
    knowledgeServiceMocks.getCurrentVersionOrThrow.mockResolvedValue({ id: 'v1', citationRegistry: null })

    const res = await request(buildApp()).get('/api/matters/WS-1/dashboard')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ generated: false, markdownVersionId: 'v1', citationRegistry: [] })
    expect(projectionServiceMocks.getOrCreateDashboardProjection).not.toHaveBeenCalled()
  })

  it('returns the cached projection without touching the generator', async () => {
    projectionServiceMocks.getExistingDashboardProjection.mockResolvedValue({
      projection: fakeProjection,
      version: { id: 'v1', citationRegistry: [{ marker: 'D01', documentId: 'doc-1' }] },
    })

    const res = await request(buildApp()).get('/api/matters/WS-1/dashboard')

    expect(res.status).toBe(200)
    expect(res.body.generated).toBe(true)
    expect(res.body.projection).toEqual(fakeProjection)
    expect(res.body.citationRegistry).toEqual([{ marker: 'D01', documentId: 'doc-1' }])
    expect(projectionServiceMocks.getOrCreateDashboardProjection).not.toHaveBeenCalled()
  })

  it('maps "no published Markdown yet" to 409', async () => {
    projectionServiceMocks.getExistingDashboardProjection.mockResolvedValue(undefined)
    knowledgeServiceMocks.getCurrentVersionOrThrow.mockRejectedValue(new MarkdownNotPublishedError())

    const res = await request(buildApp()).get('/api/matters/WS-1/dashboard')

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('markdown_not_published')
  })

  it('re-verifies live iManage access before returning anything', async () => {
    const { PermissionDeniedError } = await import('../mcp/errors.js')
    accessMocks.resolveAccessibleMatter.mockRejectedValue(new PermissionDeniedError())

    const res = await request(buildApp()).get('/api/matters/WS-1/dashboard')

    expect(res.status).toBe(403)
    expect(projectionServiceMocks.getExistingDashboardProjection).not.toHaveBeenCalled()
  })
})

describe('POST /api/matters/:workspaceId/dashboard/generate', () => {
  it('returns 201 when a new projection was generated', async () => {
    projectionServiceMocks.getOrCreateDashboardProjection.mockResolvedValue({
      projection: fakeProjection,
      version: { id: 'v1', citationRegistry: null },
      wasCached: false,
    })

    const res = await request(buildApp()).post('/api/matters/WS-1/dashboard/generate')

    expect(res.status).toBe(201)
    expect(res.body.wasCached).toBe(false)
    expect(projectionServiceMocks.getOrCreateDashboardProjection).toHaveBeenCalledWith('matter-1')
  })

  it('returns 200 when an already-cached projection was reused', async () => {
    projectionServiceMocks.getOrCreateDashboardProjection.mockResolvedValue({
      projection: fakeProjection,
      version: { id: 'v1', citationRegistry: null },
      wasCached: true,
    })

    const res = await request(buildApp()).post('/api/matters/WS-1/dashboard/generate')

    expect(res.status).toBe(200)
    expect(res.body.wasCached).toBe(true)
  })

  it('propagates an LLM/config error from generation', async () => {
    const { LlmRateLimitedError } = await import('../llm/errors.js')
    projectionServiceMocks.getOrCreateDashboardProjection.mockRejectedValue(new LlmRateLimitedError())

    const res = await request(buildApp()).post('/api/matters/WS-1/dashboard/generate')

    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('llm_rate_limited')
  })
})
