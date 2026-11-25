import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyError } from '../httpErrors.js'

const serviceMocks = vi.hoisted(() => ({
  listFieldDefinitionsForAdmin: vi.fn(),
  createCustomFieldDefinition: vi.fn(),
  updateFieldDefinition: vi.fn(),
  deleteFieldDefinition: vi.fn(),
}))
vi.mock('../services/fieldDefinitionService.js', () => serviceMocks)

const { fieldDefinitionsRouter } = await import('./fieldDefinitions.js')
const { FieldDefinitionNotFoundError, SystemDefaultImmutableError, ValidationError } = await import('../database/errors.js')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/field-definitions', fieldDefinitionsRouter)
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const { status, code, message } = classifyError(error)
    res.status(status).json({ error: { code, message } })
  })
  return app
}

beforeEach(() => {
  for (const mockFn of Object.values(serviceMocks)) mockFn.mockReset()
})

describe('GET /api/field-definitions', () => {
  it('lists every field definition (regression guard for the pre-existing route)', async () => {
    serviceMocks.listFieldDefinitionsForAdmin.mockResolvedValue([{ id: 'fd-1', fieldKey: 'matter_name', isAiClassified: false }])
    const res = await request(buildApp()).get('/api/field-definitions')
    expect(res.status).toBe(200)
    expect(res.body.fieldDefinitions).toHaveLength(1)
  })
})

describe('POST /api/field-definitions', () => {
  it('rejects an invalid field key', async () => {
    const res = await request(buildApp()).post('/api/field-definitions').send({ fieldKey: 'Bad Key!', displayName: 'x', dataType: 'text' })
    expect(res.status).toBe(400)
    expect(serviceMocks.createCustomFieldDefinition).not.toHaveBeenCalled()
  })

  it('surfaces a reserved-key rejection from the service as 400', async () => {
    serviceMocks.createCustomFieldDefinition.mockRejectedValue(new ValidationError('reserved'))
    const res = await request(buildApp()).post('/api/field-definitions').send({ fieldKey: 'matter_type', displayName: 'x', dataType: 'text' })
    expect(res.status).toBe(400)
  })

  it('creates a well-formed custom field', async () => {
    serviceMocks.createCustomFieldDefinition.mockResolvedValue({ id: 'fd-2', fieldKey: 'referral_source' })
    const res = await request(buildApp()).post('/api/field-definitions').send({ fieldKey: 'referral_source', displayName: 'Referral Source', dataType: 'text' })
    expect(res.status).toBe(201)
    expect(res.body.fieldDefinition.fieldKey).toBe('referral_source')
  })
})

describe('PATCH /api/field-definitions/:id', () => {
  it('returns 404 for an unknown field', async () => {
    serviceMocks.updateFieldDefinition.mockRejectedValue(new FieldDefinitionNotFoundError())
    const res = await request(buildApp()).patch('/api/field-definitions/missing').send({ expectedVersion: 1 })
    expect(res.status).toBe(404)
  })

  it('updates displayName', async () => {
    serviceMocks.updateFieldDefinition.mockResolvedValue({ id: 'fd-1', displayName: 'New Label' })
    const res = await request(buildApp()).patch('/api/field-definitions/fd-1').send({ displayName: 'New Label', expectedVersion: 1 })
    expect(res.status).toBe(200)
    expect(serviceMocks.updateFieldDefinition).toHaveBeenCalledWith('fd-1', { displayName: 'New Label', expectedVersion: 1 })
  })
})

describe('DELETE /api/field-definitions/:id', () => {
  it('returns 403 for a system field', async () => {
    serviceMocks.deleteFieldDefinition.mockRejectedValue(new SystemDefaultImmutableError())
    const res = await request(buildApp()).delete('/api/field-definitions/fd-1')
    expect(res.status).toBe(403)
  })

  it('deletes a custom field', async () => {
    serviceMocks.deleteFieldDefinition.mockResolvedValue(undefined)
    const res = await request(buildApp()).delete('/api/field-definitions/fd-2')
    expect(res.status).toBe(204)
  })
})
