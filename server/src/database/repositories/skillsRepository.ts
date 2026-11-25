import { and, asc, eq, sql } from 'drizzle-orm'
import { type Db, getDb } from '../connection.js'
import { ConcurrencyConflictError } from '../errors.js'
import { researchSkills } from '../schema/skills.js'
import { loadAllSkillsFromMarkdown } from '../../matterResearch/skillsMarkdownLoader.js'

export type ResearchSkill = typeof researchSkills.$inferSelect

/** Idempotent: safe to call on every server startup -- inserts only names that don't already exist, never overwrites a hand-edited row. */
export async function seedDefaultSkills(db: Db = getDb()): Promise<void> {
  const seeds = loadAllSkillsFromMarkdown().map((skill, index) => ({
    name: skill.name,
    description: skill.description,
    body: skill.body,
    isSystemDefault: true,
    displayOrder: index,
  }))
  await db.insert(researchSkills).values(seeds).onConflictDoNothing({ target: researchSkills.name })
}

export async function listSkills(db: Db = getDb()): Promise<ResearchSkill[]> {
  return db.select().from(researchSkills).orderBy(asc(researchSkills.displayOrder))
}

export async function getSkillByName(name: string, db: Db = getDb()): Promise<ResearchSkill | undefined> {
  const [row] = await db.select().from(researchSkills).where(eq(researchSkills.name, name)).limit(1)
  return row
}

export async function getSkillById(id: string, db: Db = getDb()): Promise<ResearchSkill | undefined> {
  const [row] = await db.select().from(researchSkills).where(eq(researchSkills.id, id)).limit(1)
  return row
}

export interface CreateSkillInput {
  name: string
  description: string
  body: string
  displayOrder?: number
}

export async function createSkill(input: CreateSkillInput, db: Db = getDb()): Promise<ResearchSkill> {
  const [row] = await db
    .insert(researchSkills)
    .values({
      name: input.name,
      description: input.description,
      body: input.body,
      isSystemDefault: false,
      displayOrder: input.displayOrder ?? 0,
    })
    .returning()
  return row!
}

export interface UpdateSkillInput {
  description?: string
  body?: string
  displayOrder?: number
  expectedVersion: number
}

/** Same `WHERE id=... AND version=expectedVersion` idiom as profileRepository.updateFieldValueWithConcurrencyCheck -- never accepts `name`, which is immutable after creation. */
export async function updateSkillWithConcurrencyCheck(id: string, input: UpdateSkillInput, db: Db = getDb()): Promise<ResearchSkill> {
  const [row] = await db
    .update(researchSkills)
    .set({
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      updatedAt: new Date(),
      version: sql`${researchSkills.version} + 1`,
    })
    .where(and(eq(researchSkills.id, id), eq(researchSkills.version, input.expectedVersion)))
    .returning()

  if (!row) throw new ConcurrencyConflictError()
  return row
}

export async function deleteSkill(id: string, db: Db = getDb()): Promise<void> {
  await db.delete(researchSkills).where(eq(researchSkills.id, id))
}
