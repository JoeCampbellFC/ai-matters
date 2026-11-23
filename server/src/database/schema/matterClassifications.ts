import { index, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { matterKnowledgeVersions } from './matterKnowledge.js'
import { matters } from './matters.js'

/**
 * Insert-only, immutable classification log -- one row per Decisions API
 * call (fieldId), never updated or deleted. "Current" for a field is the
 * latest row (by classifiedAt) whose markdownVersionId matches the matter's
 * currentMarkdownVersionId -- this is what guarantees an older-Markdown-
 * version classification can never override a newer one, without needing a
 * mutable "is current" flag anywhere.
 */
export const matterClassifications = pgTable(
  'matter_classifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matterId: uuid('matter_id')
      .notNull()
      .references(() => matters.id, { onDelete: 'cascade' }),
    fieldId: text('field_id').notNull(),
    markdownVersionId: uuid('markdown_version_id')
      .notNull()
      .references(() => matterKnowledgeVersions.id, { onDelete: 'cascade' }),
    taxonomyVersion: text('taxonomy_version').notNull(),
    selectedValueId: text('selected_value_id'),
    label: text('label'),
    confidence: numeric('confidence'),
    probabilities: jsonb('probabilities').$type<Array<{ id: string; label: string; probability: number }>>().notNull(),
    classificationStatus: text('classification_status').notNull(),
    modelDeployment: text('model_deployment').notNull(),
    classifiedAt: timestamp('classified_at', { withTimezone: true }).notNull(),
    classificationSource: text('classification_source').notNull().default('decisions_api'),
    /** Set only when classificationStatus === 'failed' -- selectedValueId/label/probabilities stay null/empty. */
    error: jsonb('error').$type<{ code: string; message: string } | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('matter_classifications_matter_field_idx').on(table.matterId, table.fieldId, table.classifiedAt)],
)
