import { describe, expect, it } from 'vitest'
import { loadAllSkillsFromMarkdown } from './skillsMarkdownLoader.js'

describe('loadAllSkillsFromMarkdown', () => {
  it('loads every bundled playbook, including the fallback', () => {
    const skills = loadAllSkillsFromMarkdown()
    expect(skills.length).toBeGreaterThanOrEqual(4)
    expect(skills.map((s) => s.name)).toContain('general-matter-research')
    for (const skill of skills) {
      expect(skill.name.length).toBeGreaterThan(0)
      expect(skill.description.length).toBeGreaterThan(0)
      expect(skill.body.length).toBeGreaterThan(0)
    }
  })

  it('loads the full body for a known playbook', () => {
    const skill = loadAllSkillsFromMarkdown().find((s) => s.name === 'ma-matter-research')
    expect(skill?.body).toContain('Focus areas')
  })
})
