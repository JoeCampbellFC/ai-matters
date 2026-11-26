import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyError } from '../httpErrors.js'

const accessMocks = vi.hoisted(() => ({
  resolveAccessibleMatter: vi.fn(),
}))
vi.mock('../services/matterAccessService.js', () => accessMocks)

const documentsServiceMocks = vi.hoisted(() => ({
  listContainerChildren: vi.fn(),
  searchWorkspaceDocuments: vi.fn(),
}))
vi.mock('../services/matterDocumentsService.js', () => documentsServiceMocks)

const { matterDocumentsRouter } = await import('./matterDocuments.js')

function buildApp() {
  const app = express()
  app.use('/api/matters', matterDocumentsRouter)
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const { status, code, message } = classifyError(error)
    res.status(status).json({ error: { code, message } })
  })
  return app
}

beforeEach(() => {
  for (const mockFn of Object.values(accessMocks)) mockFn.mockReset()
  for (const mockFn of Object.values(documentsServiceMocks)) mockFn.mockReset()
  accessMocks.resolveAccessibleMatter.mockResolvedValue({ matter: { id: 'matter-1' }, workspace: { id: 'WS-1', name: 'Acme', raw: {} } })
})

describe('GET /api/matters/:workspaceId/documents/children', () => {
  it('defaults to the workspace root when no containerId/containerType is given', async () => {
    documentsServiceMocks.listContainerChildren.mockResolvedValue({ children: [], nextCursor: undefined })

    const res = await request(buildApp()).get('/api/matters/WS-1/documents/children')

    expect(res.status).toBe(200)
    expect(documentsServiceMocks.listContainerChildren).toHaveBeenCalledWith(expect.anything(), {
      containerId: 'WS-1',
      containerType: 'workspace',
      cursor: undefined,
    })
  })

  it('passes through a requested folder and cursor', async () => {
    documentsServiceMocks.listContainerChildren.mockResolvedValue({
      children: [{ id: 'doc-1', name: 'Agreement.pdf', type: 'document', raw: {} }],
      nextCursor: 'next-page',
    })

    const res = await request(buildApp())
      .get('/api/matters/WS-1/documents/children')
      .query({ containerId: 'folder-1', containerType: 'folder', cursor: 'page-1' })

    expect(res.status).toBe(200)
    expect(res.body.children).toHaveLength(1)
    expect(res.body.nextCursor).toBe('next-page')
    expect(documentsServiceMocks.listContainerChildren).toHaveBeenCalledWith(expect.anything(), {
      containerId: 'folder-1',
      containerType: 'folder',
      cursor: 'page-1',
    })
  })

  it('rejects an unrecognized containerType', async () => {
    const res = await request(buildApp()).get('/api/matters/WS-1/documents/children').query({ containerType: 'bogus' })
    expect(res.status).toBe(400)
    expect(documentsServiceMocks.listContainerChildren).not.toHaveBeenCalled()
  })

  it('re-verifies live iManage access before listing anything', async () => {
    const { PermissionDeniedError } = await import('../mcp/errors.js')
    accessMocks.resolveAccessibleMatter.mockRejectedValue(new PermissionDeniedError())

    const res = await request(buildApp()).get('/api/matters/WS-1/documents/children')

    expect(res.status).toBe(403)
    expect(documentsServiceMocks.listContainerChildren).not.toHaveBeenCalled()
  })
})

describe('GET /api/matters/:workspaceId/documents/search', () => {
  it('requires a non-empty query', async () => {
    const res = await request(buildApp()).get('/api/matters/WS-1/documents/search').query({ query: '' })
    expect(res.status).toBe(400)
    expect(documentsServiceMocks.searchWorkspaceDocuments).not.toHaveBeenCalled()
  })

  it('returns only membership-verified hits', async () => {
    documentsServiceMocks.searchWorkspaceDocuments.mockResolvedValue({
      hits: [{ documentId: 'doc-1', name: 'Agreement.pdf', raw: {}, verifiedBy: 'workspace_listing' }],
      excludedCount: 2,
    })

    const res = await request(buildApp()).get('/api/matters/WS-1/documents/search').query({ query: 'arbitration' })

    expect(res.status).toBe(200)
    expect(res.body.hits).toHaveLength(1)
    expect(res.body.excludedCount).toBe(2)
    expect(documentsServiceMocks.searchWorkspaceDocuments).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: 'WS-1',
      workspace: { id: 'WS-1', name: 'Acme', raw: {} },
      query: 'arbitration',
    })
  })
})
