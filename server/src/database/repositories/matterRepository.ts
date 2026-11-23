import { and, eq, inArray } from 'drizzle-orm'
import { type Db, getDb } from '../connection.js'
import { matters } from '../schema/matters.js'

export type Matter = typeof matters.$inferSelect

export interface MatterIdentity {
  tenantId: string
  libraryId: string | null
  workspaceId: string
}

function identityWhere(identity: MatterIdentity) {
  return and(
    eq(matters.tenantId, identity.tenantId),
    eq(matters.workspaceId, identity.workspaceId),
    eq(matters.libraryIdKey, identity.libraryId ?? ''),
  )
}

export async function findMatter(identity: MatterIdentity, db: Db = getDb()): Promise<Matter | undefined> {
  const [row] = await db.select().from(matters).where(identityWhere(identity)).limit(1)
  return row
}

export async function getMatterById(matterId: string, db: Db = getDb()): Promise<Matter | undefined> {
  const [row] = await db.select().from(matters).where(eq(matters.id, matterId)).limit(1)
  return row
}

/**
 * Idempotent: a second call for the same (tenant, library, workspace) never
 * creates a duplicate row (enforced by the DB's unique index, not just this
 * check-then-insert, which would otherwise race) -- on conflict it just
 * refreshes workspaceName and returns the existing row.
 */
export async function resolveOrCreateMatter(
  identity: MatterIdentity,
  input: { workspaceName?: string; createdBy: string },
  db: Db = getDb(),
): Promise<Matter> {
  const [row] = await db
    .insert(matters)
    .values({
      tenantId: identity.tenantId,
      workspaceId: identity.workspaceId,
      libraryId: identity.libraryId,
      workspaceName: input.workspaceName,
      createdBy: input.createdBy,
    })
    .onConflictDoUpdate({
      target: [matters.tenantId, matters.libraryIdKey, matters.workspaceId],
      set: {
        workspaceName: input.workspaceName,
        updatedAt: new Date(),
      },
    })
    .returning()
  return row!
}

export async function setCurrentMarkdownVersion(matterId: string, versionId: string, db: Db = getDb()): Promise<void> {
  await db.update(matters).set({ currentMarkdownVersionId: versionId, updatedAt: new Date() }).where(eq(matters.id, matterId))
}

export async function updateMatterMetadata(
  matterId: string,
  updates: Partial<Pick<Matter, 'clientName' | 'status'>>,
  db: Db = getDb(),
): Promise<void> {
  await db
    .update(matters)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(matters.id, matterId))
}

/** Batch lookup for the Workspaces list's "already analysed" badges -- one query, not one per row. */
export async function listMattersByWorkspaceIds(tenantId: string, workspaceIds: string[], db: Db = getDb()): Promise<Matter[]> {
  if (workspaceIds.length === 0) return []
  return db.select().from(matters).where(and(eq(matters.tenantId, tenantId), inArray(matters.workspaceId, workspaceIds)))
}
