import fs from 'node:fs'
import path from 'node:path'

export interface MarkdownSkill {
  name: string
  description: string
  body: string
}

const SKILLS_DIR = path.join(import.meta.dirname, 'skills')
const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/

function parseSkillFile(raw: string, fileName: string): MarkdownSkill {
  const match = FRONTMATTER_PATTERN.exec(raw)
  if (!match) {
    throw new Error(`Skill file "${fileName}" is missing the required --- frontmatter block.`)
  }
  const [, frontmatter, body] = match
  const name = /^name:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim()
  const description = /^description:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim()
  if (!name || !description) {
    throw new Error(`Skill file "${fileName}" must declare both "name" and "description" in its frontmatter.`)
  }
  return { name, description, body: body.trim() }
}

/**
 * Reads the bundled .md playbooks (name + description frontmatter, then a
 * free-form body) -- used only to seed research_skills on first boot (see
 * database/repositories/skillsRepository.ts). The DB is the source of truth
 * for every run thereafter; this loader is never consulted again once a
 * skill has been seeded.
 */
export function loadAllSkillsFromMarkdown(): MarkdownSkill[] {
  const files = fs.readdirSync(SKILLS_DIR).filter((file) => file.endsWith('.md'))
  return files.map((file) => parseSkillFile(fs.readFileSync(path.join(SKILLS_DIR, file), 'utf-8'), file))
}
