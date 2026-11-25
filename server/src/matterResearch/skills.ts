import { getSkillByName, listSkills } from '../database/repositories/skillsRepository.js'

export interface Skill {
  name: string
  description: string
  body: string
}

/** Always exists and is used whenever no more specific playbook matches. */
export const FALLBACK_SKILL_NAME = 'general-matter-research'

/**
 * Cheap, "stage 1" view: every skill's name/description, safe to put in
 * every prompt. Backed by Postgres (research_skills, see
 * database/repositories/skillsRepository.ts) rather than the old
 * filesystem loader, so playbooks are editable from the UI. No
 * module-level cache: these calls aren't a hot loop (at most a few per
 * research-run node, dwarfed by the LLM-call latency in the same
 * functions), and caching would need invalidation-on-write from a
 * separate admin tab for no real benefit.
 */
export async function listSkillSummaries(): Promise<Array<{ name: string; description: string }>> {
  const skills = await listSkills()
  return skills.map(({ name, description }) => ({ name, description }))
}

/** Full body ("stage 2"): only loaded once a skill has actually been selected for the run. */
export async function getSkill(name: string): Promise<Skill | undefined> {
  return getSkillByName(name)
}

export async function getFallbackSkill(): Promise<Skill> {
  const skill = await getSkillByName(FALLBACK_SKILL_NAME)
  if (!skill) {
    throw new Error(`Missing required fallback skill "${FALLBACK_SKILL_NAME}" -- seedDefaultSkills() may not have run.`)
  }
  return skill
}
