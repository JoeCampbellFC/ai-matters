import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { matterKnowledgeVersions } from './matterKnowledge.js'
import { matters } from './matters.js'

/**
 * Durable record of a Phase 2 research run, keyed by the same runId
 * runManager.ts already generates. Primary key on id makes retried
 * completion events a no-op insert conflict rather than a duplicate matter
 * or Markdown version -- see services/matterKnowledgeService.ts.
 */
export const matterResearchRuns = pgTable('matter_research_runs', {
  id: text('id').primaryKey(),
  matterId: uuid('matter_id').references(() => matters.id, { onDelete: 'set null' }),
  researchStatus: text('research_status').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  generatedMarkdownVersionId: uuid('generated_markdown_version_id').references(() => matterKnowledgeVersions.id, {
    onDelete: 'set null',
  }),
  discoveredDocumentCount: integer('discovered_document_count').notNull().default(0),
  reviewedDocumentCount: integer('reviewed_document_count').notNull().default(0),
  errorSummary: text('error_summary'),
  modelDeployment: text('model_deployment'),
})
