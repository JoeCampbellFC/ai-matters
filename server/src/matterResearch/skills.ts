import fs from 'node:fs'
import path from 'node:path'

export interface Skill {
  name: string
  description: string
  body: string
}

/** Always exists and is used whenever no more specific playbook matches. */
export const FALLBACK_SKILL_NAME = 'general-matter-research'

const SKILLS_DIR = path.join(import.meta.dirname, 'skills')
const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/

function parseSkillFile(raw: string, fileName: string): Skill {
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

let cachedSkills: Skill[] | undefined

/**
 * Skills are plain Markdown files (name + description frontmatter, then a
 * free-form body) living in matterResearch/skills/ -- intentionally not a
 * TypeScript module, so a legal engineer can author or edit domain
 * expertise (what documents/queries matter for a given matter type)
 * without touching any code. Loaded once and cached: the content is a
 * static project asset, not something that changes at runtime.
 */
function loadAllSkills(): Skill[] {
  if (cachedSkills) return cachedSkills
  const files = fs.readdirSync(SKILLS_DIR).filter((file) => file.endsWith('.md'))
  cachedSkills = files.map((file) => parseSkillFile(fs.readFileSync(path.join(SKILLS_DIR, file), 'utf-8'), file))
  return cachedSkills
}

/** Cheap, "stage 1" view: every skill's name/description, safe to put in every prompt. */
export function listSkillSummaries(): Array<{ name: string; description: string }> {
  return loadAllSkills().map(({ name, description }) => ({ name, description }))
}

/** Full body ("stage 2"): only loaded once a skill has actually been selected for the run. */
export function getSkill(name: string): Skill | undefined {
  return loadAllSkills().find((skill) => skill.name === name)
}

export function getFallbackSkill(): Skill {
  const skill = getSkill(FALLBACK_SKILL_NAME)
  if (!skill) {
    throw new Error(`Missing required fallback skill file for "${FALLBACK_SKILL_NAME}".`)
  }
  return skill
}
