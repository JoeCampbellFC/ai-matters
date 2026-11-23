import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyError } from '../httpErrors.js'

const accessMocks = vi.hoisted(() => ({
  resolveAccessibleMatter: vi.fn(),
  actorFor: vi.fn().mockReturnValue('test-actor'),
}))
vi.mock('../services/matterAccessService.js', () => accessMocks)

const profileServiceMocks = vi.hoisted(() => ({
  getMatterProfile: vi.fn(),
  reclassifyCurrentVersion: vi.fn(),
  updateProfileFields: vi.fn(),
}))
vi.mock('../services/matterProfileService.js', () => profileServiceMocks)

const knowledgeServiceMocks = vi.hoisted(() => ({
  editMarkdown: vi.fn(),
  restoreVersion: vi.fn(),
}))
vi.mock('../services/matterKnowledgeService.js', () => knowledgeServiceMocks)

const repoMocks = vi.hoisted(() => ({
  listMattersByWorkspaceIds: vi.fn(),
  listVersions: vi.fn(),
  getVersion: vi.fn(),
  listAuditEvents: vi.fn(),
}))
vi.mock('../database/repositories/matterRepository.js', () => ({ listMattersByWorkspaceIds: repoMocks.listMattersByWorkspaceIds }))
vi.mock('../database/repositories/knowledgeRepository.js', () => ({
  listVersions: repoMocks.listVersions,
  getVersion: repoMocks.getVersion,
}))
vi.mock('../database/repositories/auditRepository.js', () => ({ listAuditEvents: repoMocks.listAuditEvents }))

const { matterProfileRouter } = await import('./matterProfile.js')
const { MarkdownNotPublishedError } = await import('../database/errors.js')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    ;(req as unknown as { sessionID: string }).sessionID = 'test-session'
    next()
  })
  app.use('/api/matters', matterProfileRouter)
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const { status, code, message } = classifyError(error)
    res.status(status).json({ error: { code, message } })
  })
  return app
}

function fakeField(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    fieldId: 'matter_type',
    fieldLabel: 'Matter Type',
    valueId: 'mergers_acquisitions',
    label: 'Mergers & Acquisitions',
    confidence: 0.9,
    status: 'classified',
    probabilities: [],
    version: 0,
    ...overrides,
  }
}

function fakeProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    matterId: 'matter-1',
    workspaceId: 'WS-1',
    workspaceName: 'Acme Matter',
    outdated: false,
    fields: [fakeField()],
    profileFields: [],
    ...overrides,
  }
}

beforeEach(() => {
  for (const mockFn of Object.values(accessMocks)) mockFn.mockReset()
  for (const mockFn of Object.values(profileServiceMocks)) mockFn.mockReset()
  for (const mockFn of Object.values(knowledgeServiceMocks)) mockFn.mockReset()
  for (const mockFn of Object.values(repoMocks)) mockFn.mockReset()
  accessMocks.resolveAccessibleMatter.mockResolvedValue({ matter: { id: 'matter-1', workspaceId: 'WS-1' }, workspace: { id: 'WS-1', name: 'Acme Matter' } })
  accessMocks.actorFor.mockReturnValue('test-actor')
})

describe('GET /api/matters/classification-fields', () => {
  it('returns all 16 classification fields (id/label choices only)', async () => {
    const res = await request(buildApp()).get('/api/matters/classification-fields')
    expect(res.status).toBe(200)
    expect(res.body.fields).toHaveLength(16)
    expect(res.body.fields[0]).toHaveProperty('fieldId')
    expect(res.body.fields[0].choices[0]).not.toHaveProperty('description')
  })
})

describe('GET /api/matters', () => {
  it('batch-looks-up matters for the given workspace ids', async () => {
    repoMocks.listMattersByWorkspaceIds.mockResolvedValue([
      { workspaceId: 'WS-1', workspaceName: 'Acme', status: 'active', currentMarkdownVersionId: 'v1', updatedAt: new Date('2026-01-01') },
    ])
    const res = await request(buildApp()).get('/api/matters').query({ workspaceIds: 'WS-1,WS-2' })
    expect(res.status).toBe(200)
    expect(res.body.matters).toEqual([
      { workspaceId: 'WS-1', workspaceName: 'Acme', status: 'active', hasKnowledge: true, updatedAt: '2026-01-01T00:00:00.000Z' },
    ])
  })
})

describe('GET /api/matters/:workspaceId/profile', () => {
  it('re-verifies live iManage access before returning any persisted profile', async () => {
    profileServiceMocks.getMatterProfile.mockResolvedValue(fakeProfile())
    const res = await request(buildApp()).get('/api/matters/WS-1/profile')
    expect(res.status).toBe(200)
    expect(accessMocks.resolveAccessibleMatter).toHaveBeenCalledWith(expect.anything(), 'WS-1')
    expect(profileServiceMocks.getMatterProfile).toHaveBeenCalledWith('matter-1')
  })

  it('propagates an access-denied error from the live iManage check without ever calling the profile service', async () => {
    const { PermissionDeniedError } = await import('../mcp/errors.js')
    accessMocks.resolveAccessibleMatter.mockRejectedValue(new PermissionDeniedError())
    const res = await request(buildApp()).get('/api/matters/WS-1/profile')
    expect(res.status).toBe(403)
    expect(profileServiceMocks.getMatterProfile).not.toHaveBeenCalled()
  })
})

describe('POST /api/matters/:workspaceId/classify and /reclassify', () => {
  it('classify: returns 202 and the resulting profile on success', async () => {
    profileServiceMocks.reclassifyCurrentVersion.mockResolvedValue(fakeProfile())
    const res = await request(buildApp()).post('/api/matters/WS-1/classify')
    expect(res.status).toBe(202)
    expect(res.body.fields[0].valueId).toBe('mergers_acquisitions')
    expect(profileServiceMocks.reclassifyCurrentVersion).toHaveBeenCalledWith('matter-1', 'test-actor')
  })

  it('classify: maps "no published Markdown yet" to 409', async () => {
    profileServiceMocks.reclassifyCurrentVersion.mockRejectedValue(new MarkdownNotPublishedError())
    const res = await request(buildApp()).post('/api/matters/WS-1/classify')
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('markdown_not_published')
  })

  it('reclassify: reruns against the existing Markdown, never Phase 2 research, and returns 202', async () => {
    profileServiceMocks.reclassifyCurrentVersion.mockResolvedValue(fakeProfile({ fields: [fakeField({ valueId: 'tax', label: 'Tax' })] }))
    const res = await request(buildApp()).post('/api/matters/WS-1/reclassify')
    expect(res.status).toBe(202)
    expect(res.body.fields[0].valueId).toBe('tax')
  })
})

describe('PATCH /api/matters/:workspaceId/profile', () => {
  it('applies a batch of field updates and returns the refreshed profile', async () => {
    profileServiceMocks.updateProfileFields.mockResolvedValue(fakeProfile({ fields: [fakeField({ valueId: 'tax', label: 'Tax' })] }))
    const res = await request(buildApp())
      .patch('/api/matters/WS-1/profile')
      .send({ updates: [{ fieldKey: 'matter_type', value: 'tax', expectedVersion: 0 }] })
    expect(res.status).toBe(200)
    expect(res.body.fields[0].valueId).toBe('tax')
    expect(profileServiceMocks.updateProfileFields).toHaveBeenCalledWith('matter-1', [{ fieldKey: 'matter_type', value: 'tax', expectedVersion: 0 }], 'test-actor')
  })

  it('returns 409 on a concurrency conflict', async () => {
    const { ConcurrencyConflictError } = await import('../database/errors.js')
    profileServiceMocks.updateProfileFields.mockRejectedValue(new ConcurrencyConflictError())
    const res = await request(buildApp())
      .patch('/api/matters/WS-1/profile')
      .send({ updates: [{ fieldKey: 'matter_name', value: 'New Name', expectedVersion: 3 }] })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('concurrency_conflict')
  })

  it('returns 400 when the request body is malformed', async () => {
    const res = await request(buildApp()).patch('/api/matters/WS-1/profile').send({ updates: [] })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/matters/:workspaceId/knowledge', () => {
  it('saves an edit as a new version', async () => {
    knowledgeServiceMocks.editMarkdown.mockResolvedValue({ id: 'v2', versionNumber: 2 })
    const res = await request(buildApp())
      .put('/api/matters/WS-1/knowledge')
      .send({ content: '# Updated', basedOnVersionId: 'v1' })
    expect(res.status).toBe(200)
    expect(res.body.version.versionNumber).toBe(2)
  })

  it('returns 409 when the edit was based on a stale version', async () => {
    const { StaleMarkdownVersionError } = await import('../database/errors.js')
    knowledgeServiceMocks.editMarkdown.mockRejectedValue(new StaleMarkdownVersionError())
    const res = await request(buildApp())
      .put('/api/matters/WS-1/knowledge')
      .send({ content: '# Updated', basedOnVersionId: 'stale' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('stale_markdown_version')
  })
})

describe('GET /api/matters/:workspaceId/audit', () => {
  it('returns the matter audit log', async () => {
    repoMocks.listAuditEvents.mockResolvedValue([{ id: 'a1', action: 'edited' }])
    const res = await request(buildApp()).get('/api/matters/WS-1/audit')
    expect(res.status).toBe(200)
    expect(res.body.events).toEqual([{ id: 'a1', action: 'edited' }])
  })
})
