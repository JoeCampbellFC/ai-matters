import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Research playbooks selectable by planSearches.ts's per-run skill-selection
 * LLM call. Replaces the filesystem-backed matterResearch/skills/*.md files
 * -- seeded once from their content so existing search-planning behavior is
 * unchanged, then editable here. `name` is immutable after creation:
 * planSearches.ts resolves a skill by this string.
 */
export const researchSkills = pgTable('research_skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  body: text('body').notNull(),
  isSystemDefault: boolean('is_system_default').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
