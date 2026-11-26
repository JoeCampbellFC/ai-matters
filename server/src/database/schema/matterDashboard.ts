import { jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { matterKnowledgeVersions } from './matterKnowledge.js'
import { matters } from './matters.js'

/**
 * A cached, structured "projection" of one Matter Knowledge Markdown version
 * into dashboard widgets (see server/src/dashboard/dashboardProjectionService.ts).
 * Never regenerates research or re-runs classification -- purely a read-side
 * transformation of already-published Markdown, cached per (matter, exact
 * markdown version, schema version) so the same version is never re-sent to
 * the LLM twice. `projectionJson`'s shape is validated against
 * server/src/dashboard/projectionSchemas.ts at write time, not enforced by
 * Postgres itself.
 */
export const matterDashboardProjections = pgTable(
  'matter_dashboard_projections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matterId: uuid('matter_id')
      .notNull()
      .references(() => matters.id, { onDelete: 'cascade' }),
    markdownVersionId: uuid('markdown_version_id')
      .notNull()
      .references(() => matterKnowledgeVersions.id, { onDelete: 'cascade' }),
    markdownHash: text('markdown_hash').notNull(),
    projectionSchemaVersion: text('projection_schema_version').notNull(),
    projectionJson: jsonb('projection_json'),
    status: text('status').notNull().default('pending'), // 'pending' | 'generating' | 'ready' | 'failed'
    errorMessage: text('error_message'),
    generatedAt: timestamp('generated_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One row per (matter, exact markdown version, schema version) -- the
    // idempotency guard a concurrent "View Dashboard" double-click relies on.
    unique('matter_dashboard_projections_version_schema_key').on(table.matterId, table.markdownVersionId, table.projectionSchemaVersion),
  ],
)
