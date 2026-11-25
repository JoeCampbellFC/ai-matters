import { beforeEach, describe, expect, it, vi } from 'vitest'

const repoMocks = vi.hoisted(() => ({
  listSkills: vi.fn(),
  getSkillByName: vi.fn(),
  getSkillById: vi.fn(),
  createSkill: vi.fn(),
  updateSkillWithConcurrencyCheck: vi.fn(),
  deleteSkill: vi.fn(),
}))
vi.mock('../database/repositories/skillsRepository.js', () => repoMocks)

const { createCustomSkill, deleteSkill, updateSkill } = await import('./skillsService.js')
const { SkillNotFoundError, SystemDefaultImmutableError, ValidationError } = await import('../database/errors.js')

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'skill-1', name: 'custom-playbook', description: 'd', body: 'b', isSystemDefault: false, displayOrder: 0, version: 1, ...overrides }
}

beforeEach(() => {
  for (const mockFn of Object.values(repoMocks)) mockFn.mockReset()
})

describe('createCustomSkill', () => {
  it('rejects a name already in use', async () => {
    repoMocks.getSkillByName.mockResolvedValue(row())
    await expect(createCustomSkill({ name: 'custom-playbook', description: 'd', body: 'b' })).rejects.toThrow(ValidationError)
    expect(repoMocks.createSkill).not.toHaveBeenCalled()
  })

  it('creates the skill when the name is free', async () => {
    repoMocks.getSkillByName.mockResolvedValue(undefined)
    repoMocks.createSkill.mockResolvedValue(row())
    await createCustomSkill({ name: 'custom-playbook', description: 'd', body: 'b' })
    expect(repoMocks.createSkill).toHaveBeenCalledWith({ name: 'custom-playbook', description: 'd', body: 'b' })
  })
})

describe('updateSkill', () => {
  it('throws SkillNotFoundError for an unknown id', async () => {
    repoMocks.getSkillById.mockResolvedValue(undefined)
    await expect(updateSkill('missing', { expectedVersion: 1 })).rejects.toThrow(SkillNotFoundError)
  })

  it('allows editing a system-default row', async () => {
    repoMocks.getSkillById.mockResolvedValue(row({ isSystemDefault: true }))
    repoMocks.updateSkillWithConcurrencyCheck.mockResolvedValue(row({ isSystemDefault: true, body: 'new body' }))
    const result = await updateSkill('skill-1', { body: 'new body', expectedVersion: 1 })
    expect(result.body).toBe('new body')
  })
})

describe('deleteSkill', () => {
  it('throws SystemDefaultImmutableError for a built-in playbook', async () => {
    repoMocks.getSkillById.mockResolvedValue(row({ isSystemDefault: true }))
    await expect(deleteSkill('skill-1')).rejects.toThrow(SystemDefaultImmutableError)
    expect(repoMocks.deleteSkill).not.toHaveBeenCalled()
  })

  it('deletes a custom playbook', async () => {
    repoMocks.getSkillById.mockResolvedValue(row({ isSystemDefault: false }))
    await deleteSkill('skill-1')
    expect(repoMocks.deleteSkill).toHaveBeenCalledWith('skill-1')
  })
})
