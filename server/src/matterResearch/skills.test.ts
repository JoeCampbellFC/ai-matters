import { describe, expect, it } from 'vitest'
import { FALLBACK_SKILL_NAME, getFallbackSkill, getSkill, listSkillSummaries } from './skills.js'

describe('listSkillSummaries', () => {
  it('returns a name and description for every bundled skill, including the fallback', () => {
    const summaries = listSkillSummaries()
    expect(summaries.length).toBeGreaterThanOrEqual(4)
    expect(summaries.map((s) => s.name)).toContain(FALLBACK_SKILL_NAME)
    for (const summary of summaries) {
      expect(summary.name.length).toBeGreaterThan(0)
      expect(summary.description.length).toBeGreaterThan(0)
    }
  })
})

describe('getSkill', () => {
  it('loads the full body for a known skill', () => {
    const skill = getSkill('ma-matter-research')
    expect(skill?.name).toBe('ma-matter-research')
    expect(skill?.body).toContain('Focus areas')
  })

  it('returns undefined for an unknown skill name', () => {
    expect(getSkill('not-a-real-skill')).toBeUndefined()
  })
})

describe('getFallbackSkill', () => {
  it('always resolves to the general-matter-research skill', () => {
    expect(getFallbackSkill().name).toBe(FALLBACK_SKILL_NAME)
  })
})
