import { sql } from 'drizzle-orm'
import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

/**
 * A tenant-wide, shared record for one iManage workspace -- not scoped to a
 * browser session. Two users looking at the same workspace see the same
 * Matter; access is re-checked live against iManage on every request (see
 * services/matterAccessService.ts), never cached as a standing grant here.
 */
export const matters = pgTable(
  'matters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    workspaceId: text('workspace_id').notNull(),
    libraryId: text('library_id'),
    /**
     * iManage workspace responses don't reliably carry a library id
     * (mcp/workspaceMapper.ts has no such field), so libraryId is null for
     * most matters. Postgres unique constraints treat every NULL as
     * distinct, so a plain unique(tenantId, libraryId, workspaceId) would
     * silently allow duplicate matters whenever libraryId is null -- this
     * generated, never-null column coalesces it so the unique index below
     * actually enforces one matter per (tenant, library-or-none, workspace).
     */
    libraryIdKey: text('library_id_key').generatedAlwaysAs(sql`coalesce(library_id, '')`),
    workspaceName: text('workspace_name'),
    clientName: text('client_name'),
    status: text('status').notNull().default('active'),
    currentMarkdownVersionId: uuid('current_markdown_version_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by').notNull(),
  },
  (table) => [
    unique('matters_tenant_library_workspace_key').on(table.tenantId, table.libraryIdKey, table.workspaceId),
    index('matters_workspace_id_idx').on(table.workspaceId),
  ],
)
