import { beforeEach, describe, expect, it, vi } from 'vitest'

const repoMocks = vi.hoisted(() => ({
  listSkills: vi.fn(),
  getSkillByName: vi.fn(),
}))
vi.mock('../database/repositories/skillsRepository.js', () => repoMocks)

const { FALLBACK_SKILL_NAME, getFallbackSkill, getSkill, listSkillSummaries } = await import('./skills.js')

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'skill-1',
    name: 'general-matter-research',
    description: 'Default research strategy.',
    body: '## Focus areas\n...',
    isSystemDefault: true,
    displayOrder: 0,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  repoMocks.listSkills.mockReset()
  repoMocks.getSkillByName.mockReset()
})

describe('listSkillSummaries', () => {
  it('maps every DB row to its name and description', async () => {
    repoMocks.listSkills.mockResolvedValue([row(), row({ name: 'ma-matter-research', description: 'M&A playbook' })])
    const summaries = await listSkillSummaries()
    expect(summaries).toEqual([
      { name: 'general-matter-research', description: 'Default research strategy.' },
      { name: 'ma-matter-research', description: 'M&A playbook' },
    ])
  })
})

describe('getSkill', () => {
  it('resolves a known skill by name', async () => {
    repoMocks.getSkillByName.mockResolvedValue(row({ name: 'ma-matter-research' }))
    const skill = await getSkill('ma-matter-research')
    expect(skill?.name).toBe('ma-matter-research')
    expect(repoMocks.getSkillByName).toHaveBeenCalledWith('ma-matter-research')
  })

  it('returns undefined for an unknown skill name', async () => {
    repoMocks.getSkillByName.mockResolvedValue(undefined)
    expect(await getSkill('not-a-real-skill')).toBeUndefined()
  })
})

describe('getFallbackSkill', () => {
  it('always resolves to the general-matter-research skill', async () => {
    repoMocks.getSkillByName.mockResolvedValue(row())
    expect((await getFallbackSkill()).name).toBe(FALLBACK_SKILL_NAME)
  })

  it('throws if the fallback has not been seeded', async () => {
    repoMocks.getSkillByName.mockResolvedValue(undefined)
    await expect(getFallbackSkill()).rejects.toThrow(/seedDefaultSkills/)
  })
})
