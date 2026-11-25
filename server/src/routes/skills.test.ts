import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyError } from '../httpErrors.js'

const serviceMocks = vi.hoisted(() => ({
  listSkillsForAdmin: vi.fn(),
  createCustomSkill: vi.fn(),
  updateSkill: vi.fn(),
  deleteSkill: vi.fn(),
}))
vi.mock('../services/skillsService.js', () => serviceMocks)

const { skillsRouter } = await import('./skills.js')
const { SkillNotFoundError, SystemDefaultImmutableError } = await import('../database/errors.js')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/skills', skillsRouter)
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const { status, code, message } = classifyError(error)
    res.status(status).json({ error: { code, message } })
  })
  return app
}

beforeEach(() => {
  for (const mockFn of Object.values(serviceMocks)) mockFn.mockReset()
})

describe('GET /api/skills', () => {
  it('lists every skill', async () => {
    serviceMocks.listSkillsForAdmin.mockResolvedValue([{ id: 's1', name: 'general-matter-research' }])
    const res = await request(buildApp()).get('/api/skills')
    expect(res.status).toBe(200)
    expect(res.body.skills).toHaveLength(1)
  })
})

describe('POST /api/skills', () => {
  it('rejects a name with uppercase letters', async () => {
    const res = await request(buildApp()).post('/api/skills').send({ name: 'Bad Name', description: 'd', body: 'b' })
    expect(res.status).toBe(400)
    expect(serviceMocks.createCustomSkill).not.toHaveBeenCalled()
  })

  it('creates a skill with a valid slug name', async () => {
    serviceMocks.createCustomSkill.mockResolvedValue({ id: 's2', name: 'real-estate-matter-research' })
    const res = await request(buildApp()).post('/api/skills').send({ name: 'real-estate-matter-research', description: 'd', body: 'b' })
    expect(res.status).toBe(201)
    expect(res.body.skill.name).toBe('real-estate-matter-research')
  })
})

describe('PATCH /api/skills/:id', () => {
  it('returns 404 for an unknown skill', async () => {
    serviceMocks.updateSkill.mockRejectedValue(new SkillNotFoundError())
    const res = await request(buildApp()).patch('/api/skills/missing').send({ expectedVersion: 1 })
    expect(res.status).toBe(404)
  })

  it('updates body/description', async () => {
    serviceMocks.updateSkill.mockResolvedValue({ id: 's1', body: 'new' })
    const res = await request(buildApp()).patch('/api/skills/s1').send({ body: 'new', expectedVersion: 1 })
    expect(res.status).toBe(200)
    expect(serviceMocks.updateSkill).toHaveBeenCalledWith('s1', { body: 'new', expectedVersion: 1 })
  })
})

describe('DELETE /api/skills/:id', () => {
  it('returns 403 for a built-in playbook', async () => {
    serviceMocks.deleteSkill.mockRejectedValue(new SystemDefaultImmutableError())
    const res = await request(buildApp()).delete('/api/skills/s1')
    expect(res.status).toBe(403)
  })

  it('deletes a custom playbook', async () => {
    serviceMocks.deleteSkill.mockResolvedValue(undefined)
    const res = await request(buildApp()).delete('/api/skills/s2')
    expect(res.status).toBe(204)
  })
})
