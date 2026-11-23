import { integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { matters } from './matters.js'

/**
 * Immutable Markdown snapshots -- editing never overwrites a row, it inserts
 * a new one and repoints matters.currentMarkdownVersionId at it. Previous
 * versions stay forever (version history / restore / classification
 * provenance all depend on this).
 */
export const matterKnowledgeVersions = pgTable(
  'matter_knowledge_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matterId: uuid('matter_id')
      .notNull()
      .references(() => matters.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    source: text('source').notNull(), // 'ai_generated' | 'user_edited'
    researchRunId: text('research_run_id'),
    status: text('status').notNull().default('published'), // 'draft' | 'published' | 'superseded'
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    parentVersionId: uuid('parent_version_id'),
    changeSummary: text('change_summary'),
  },
  (table) => [unique('matter_knowledge_versions_matter_version_key').on(table.matterId, table.versionNumber)],
)
