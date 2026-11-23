import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { matters } from './matters.js'

export const matterAuditEvents = pgTable(
  'matter_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matterId: uuid('matter_id')
      .notNull()
      .references(() => matters.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    fieldKey: text('field_key'),
    previousValue: jsonb('previous_value'),
    newValue: jsonb('new_value'),
    changedBy: text('changed_by').notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('matter_audit_events_matter_idx').on(table.matterId, table.changedAt)],
)
