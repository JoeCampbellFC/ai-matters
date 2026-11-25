import { SkillNotFoundError, SystemDefaultImmutableError, ValidationError } from '../database/errors.js'
import {
  type ResearchSkill,
  createSkill,
  deleteSkill as deleteSkillRow,
  getSkillById,
  getSkillByName,
  listSkills,
  updateSkillWithConcurrencyCheck,
} from '../database/repositories/skillsRepository.js'

export async function listSkillsForAdmin(): Promise<ResearchSkill[]> {
  return listSkills()
}

export interface CreateCustomSkillInput {
  name: string
  description: string
  body: string
}

/** `name`'s slug format is validated by the route's Zod schema; this only checks the business rule a DB lookup requires -- uniqueness. */
export async function createCustomSkill(input: CreateCustomSkillInput): Promise<ResearchSkill> {
  const existing = await getSkillByName(input.name)
  if (existing) {
    throw new ValidationError(`A playbook named "${input.name}" already exists.`)
  }
  return createSkill(input)
}

export interface UpdateSkillInput {
  description?: string
  body?: string
  expectedVersion: number
}

/**
 * Description/body are editable on every row, including the seeded defaults
 * -- that's the actual point of this feature (tune the built-in playbooks
 * without a code deploy). `name` is never accepted here: planSearches.ts
 * resolves a skill by name, so renaming would silently orphan it.
 */
export async function updateSkill(id: string, input: UpdateSkillInput): Promise<ResearchSkill> {
  const existing = await getSkillById(id)
  if (!existing) throw new SkillNotFoundError()
  return updateSkillWithConcurrencyCheck(id, input)
}

export async function deleteSkill(id: string): Promise<void> {
  const existing = await getSkillById(id)
  if (!existing) throw new SkillNotFoundError()
  if (existing.isSystemDefault) throw new SystemDefaultImmutableError('Built-in playbooks cannot be deleted.')
  await deleteSkillRow(id)
}
