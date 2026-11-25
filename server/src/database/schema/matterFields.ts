import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { matters } from './matters.js'

/**
 * Configuration for every Matter Profile field -- both the 16 existing
 * Phase 3 AI-classified dimensions (seeded from classification/
 * classificationFields.ts, system_field=true) and the Phase 4 pure-profile
 * fields that have no AI classifier (Matter Name, Client Name, etc). This is
 * NOT a second taxonomy: a classified field's allowedValues here is a
 * snapshot of the same choices classificationFields.ts already defines, used
 * only for rendering the correction Select -- classificationFields.ts stays
 * the source of truth for Decisions API prompt content.
 */
export const matterFieldDefinitions = pgTable('matter_field_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldKey: text('field_key').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description').notNull().default(''),
  dataType: text('data_type').notNull(), // text|multiline_text|number|decimal|date|boolean|single_select|multi_select
  allowedValues: jsonb('allowed_values').$type<Array<{ id: string; label: string }> | null>(),
  required: boolean('required').notNull().default(false),
  editable: boolean('editable').notNull().default(true),
  systemField: boolean('system_field').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * The single current value per (matter, field) -- for the 16 AI fields this
 * row only exists once a user has overridden the AI result (valueSource
 * 'user'); the effective value otherwise comes from the latest
 * matterClassifications row. For the pure-profile fields this is the only
 * value store. `version` backs optimistic concurrency on profile edits.
 */
export const matterFieldValues = pgTable(
  'matter_field_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matterId: uuid('matter_id')
      .notNull()
      .references(() => matters.id, { onDelete: 'cascade' }),
    fieldDefinitionId: uuid('field_definition_id')
      .notNull()
      .references(() => matterFieldDefinitions.id, { onDelete: 'cascade' }),
    value: jsonb('value'),
    valueSource: text('value_source').notNull(), // 'iManage' | 'ai' | 'user' | 'system'
    confidence: numeric('confidence'),
    sourceReference: text('source_reference'),
    updatedBy: text('updated_by').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
  },
  (table) => [unique('matter_field_values_matter_field_key').on(table.matterId, table.fieldDefinitionId)],
)
