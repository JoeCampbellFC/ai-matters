import { desc, eq } from 'drizzle-orm'
import { type Db, getDb } from '../connection.js'
import { matterAuditEvents } from '../schema/auditEvents.js'

export type MatterAuditEvent = typeof matterAuditEvents.$inferSelect

export interface RecordEventInput {
  matterId: string
  entityType: 'matter' | 'matter_knowledge_version' | 'matter_field_value' | 'matter_classification'
  entityId: string
  action: string
  fieldKey?: string
  previousValue?: unknown
  newValue?: unknown
  changedBy: string
}

export async function recordAuditEvent(input: RecordEventInput, db: Db = getDb()): Promise<void> {
  await db.insert(matterAuditEvents).values({
    matterId: input.matterId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    fieldKey: input.fieldKey,
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    changedBy: input.changedBy,
  })
}

export async function listAuditEvents(matterId: string, limit = 100): Promise<MatterAuditEvent[]> {
  return getDb()
    .select()
    .from(matterAuditEvents)
    .where(eq(matterAuditEvents.matterId, matterId))
    .orderBy(desc(matterAuditEvents.changedAt))
    .limit(limit)
}
