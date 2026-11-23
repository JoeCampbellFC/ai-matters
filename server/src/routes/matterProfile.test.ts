import express from 'express'
import request from 'supertest'
import { z } from 'zod'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyError } from '../httpErrors.js'

const serviceMocks = vi.hoisted(() => ({
  toMatterProfile: vi.fn(),
  reclassifyLatestArtifact: vi.fn(),
  recordManualClassificationCorrection: vi.fn(),
}))
vi.mock('../classification/matterClassificationService.js', () => serviceMocks)

const { matterProfileRouter } = await import('./matterProfile.js')
const { MarkdownNotReadyError, MatterProfileNotFoundError } = await import('../classification/errors.js')

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
    ...overrides,
  }
}

function fakeProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    workspaceId: 'WS-1',
    workspaceName: 'Acme Matter',
    outdated: false,
    fields: [fakeField()],
    ...overrides,
  }
}

beforeEach(() => {
  for (const mockFn of Object.values(serviceMocks)) mockFn.mockReset()
})

describe('GET /api/matters/classification-fields', () => {
  it('returns all 16 classification fields (id/label choices only)', async () => {
    const res = await request(buildApp()).get('/api/matters/classification-fields')
    expect(res.status).toBe(200)
    expect(res.body.fields).toHaveLength(16)
    expect(res.body.fields[0]).toHaveProperty('fieldId')
    expect(res.body.fields[0]).toHaveProperty('label')
    expect(res.body.fields[0].choices[0]).toHaveProperty('id')
    expect(res.body.fields[0].choices[0]).toHaveProperty('label')
    expect(res.body.fields[0].choices[0]).not.toHaveProperty('description')
  })
})

describe('GET /api/matters/:workspaceId/profile', () => {
  it('returns 404 when no profile exists yet for this workspace', async () => {
    serviceMocks.toMatterProfile.mockReturnValue(undefined)
    const res = await request(buildApp()).get('/api/matters/WS-1/profile')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('matter_profile_not_found')
  })

  it('returns the profile scoped to the request session', async () => {
    serviceMocks.toMatterProfile.mockReturnValue(fakeProfile())
    const res = await request(buildApp()).get('/api/matters/WS-1/profile')
    expect(res.status).toBe(200)
    expect(res.body.fields[0].valueId).toBe('mergers_acquisitions')
    expect(serviceMocks.toMatterProfile).toHaveBeenCalledWith('test-session', 'WS-1')
  })
})

describe('POST /api/matters/:workspaceId/classify and /reclassify', () => {
  it('classify: returns 202 and the resulting profile on success', async () => {
    serviceMocks.reclassifyLatestArtifact.mockResolvedValue(fakeProfile())
    const res = await request(buildApp()).post('/api/matters/WS-1/classify')
    expect(res.status).toBe(202)
    expect(res.body.fields[0].valueId).toBe('mergers_acquisitions')
  })

  it('classify: maps "no completed Markdown yet" to 409', async () => {
    serviceMocks.reclassifyLatestArtifact.mockRejectedValue(new MarkdownNotReadyError())
    const res = await request(buildApp()).post('/api/matters/WS-1/classify')
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('markdown_not_ready')
  })

  it('reclassify: reruns against the existing Markdown, never Phase 2 research, and returns 202', async () => {
    serviceMocks.reclassifyLatestArtifact.mockResolvedValue(fakeProfile({ fields: [fakeField({ valueId: 'tax', label: 'Tax' })] }))
    const res = await request(buildApp()).post('/api/matters/WS-1/reclassify')
    expect(res.status).toBe(202)
    expect(res.body.fields[0].valueId).toBe('tax')
    expect(serviceMocks.reclassifyLatestArtifact).toHaveBeenCalledWith('test-session', 'WS-1')
  })
})

describe('PATCH /api/matters/:workspaceId/profile', () => {
  it('records a manual correction and returns the updated profile', async () => {
    serviceMocks.recordManualClassificationCorrection.mockReturnValue(
      fakeProfile({ fields: [fakeField({ valueId: 'corporate_advisory', label: 'Corporate Advisory' })] }),
    )
    const res = await request(buildApp())
      .patch('/api/matters/WS-1/profile')
      .send({ fieldId: 'matter_type', valueId: 'corporate_advisory', correctedBy: 'alice' })
    expect(res.status).toBe(200)
    expect(res.body.fields[0].valueId).toBe('corporate_advisory')
    expect(serviceMocks.recordManualClassificationCorrection).toHaveBeenCalledWith('test-session', 'WS-1', {
      fieldId: 'matter_type',
      valueId: 'corporate_advisory',
      correctedBy: 'alice',
    })
  })

  it('returns 404 when no profile exists yet to correct', async () => {
    serviceMocks.recordManualClassificationCorrection.mockImplementation(() => {
      throw new MatterProfileNotFoundError()
    })
    const res = await request(buildApp()).patch('/api/matters/WS-1/profile').send({ fieldId: 'matter_type', valueId: 'tax', correctedBy: 'alice' })
    expect(res.status).toBe(404)
  })

  it('returns 400 when the value id is invalid', async () => {
    serviceMocks.recordManualClassificationCorrection.mockImplementation(() => {
      throw new z.ZodError([{ code: 'custom', message: 'Unrecognized value for this classification field.', path: ['valueId'] }])
    })
    const res = await request(buildApp())
      .patch('/api/matters/WS-1/profile')
      .send({ fieldId: 'matter_type', valueId: 'not_real', correctedBy: 'alice' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('invalid_request')
  })

  it('defaults correctedBy to a generic label when not supplied', async () => {
    serviceMocks.recordManualClassificationCorrection.mockReturnValue(fakeProfile())
    await request(buildApp()).patch('/api/matters/WS-1/profile').send({ fieldId: 'matter_type', valueId: 'tax' })
    expect(serviceMocks.recordManualClassificationCorrection).toHaveBeenCalledWith('test-session', 'WS-1', {
      fieldId: 'matter_type',
      valueId: 'tax',
      correctedBy: 'current user',
    })
  })
})
