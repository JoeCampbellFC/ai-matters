import type { Request } from 'express'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { decodeIdTokenClaims } from '../auth/jwt.js'
import { config } from '../config.js'
import { getFieldDefinitionsByKeys } from '../database/repositories/fieldDefinitionRepository.js'
import { type Matter, type MatterIdentity, resolveOrCreateMatter } from '../database/repositories/matterRepository.js'
import { getFieldValue, upsertFieldValue } from '../database/repositories/profileRepository.js'
import { getConnection } from '../mcp/connection.js'
import { McpToolError, ToolUnavailableError } from '../mcp/errors.js'
import { GET_WORKSPACE_PROFILE_TOOL, buildGetWorkspaceProfileArgs } from '../mcp/tools.js'
import { extractToolPayload, normalizeWorkspace, type Workspace } from '../mcp/workspaceMapper.js'

/** get_workspace_profile may return the profile bare or wrapped under a conventional key -- mirrors matterResearch/graph/nodes/loadWorkspaceContext.ts exactly. */
function unwrapProfilePayload(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) return payload
  const record = payload as Record<string, unknown>
  for (const key of ['workspace', 'profile', 'data']) {
    if (typeof record[key] === 'object' && record[key] !== null) return record[key]
  }
  return payload
}

/**
 * Live access check, never cached: re-verifies (via the session's own MCP
 * connection, same as Phase 1/2 already do) that the current user can
 * actually see this workspace in iManage right now, before any Postgres-
 * stored Matter data is returned or mutated. A workspace whose access was
 * revoked since the Matter was first created fails here even though the row
 * still exists -- the existence of persisted data never bypasses iManage's
 * own access control.
 */
export async function fetchLiveWorkspace(req: Request, workspaceId: string): Promise<Workspace> {
  const { client, tools } = await getConnection(req)
  const tool = tools.find((t) => t.name === GET_WORKSPACE_PROFILE_TOOL)
  if (!tool) throw new ToolUnavailableError(GET_WORKSPACE_PROFILE_TOOL)

  const result = (await client.callTool({
    name: tool.name,
    arguments: buildGetWorkspaceProfileArgs(tool, { workspaceId }),
  })) as CallToolResult
  const payload = unwrapProfilePayload(extractToolPayload(result))
  const workspace = normalizeWorkspace(payload)
  if (!workspace) {
    throw new McpToolError(`Could not resolve workspace "${workspaceId}" from the iManage MCP response.`)
  }
  return workspace
}

/**
 * Attribution label for created_by/updated_by/changed_by columns -- display
 * only, same as the rest of the app (auth/jwt.ts): never used to make an
 * authorization decision, which stays entirely in fetchLiveWorkspace above.
 */
export function actorFor(req: Request): string {
  const claims = decodeIdTokenClaims(req.session.imanage?.tokens?.id_token)
  return claims?.sub ?? claims?.email ?? req.sessionID
}

/**
 * Keeps the handful of iManage-sourced profile fields in sync with the live
 * workspace -- but only while they're still iManage-sourced or unset. Once a
 * user edits one of these (valueSource becomes 'user'), this never
 * overwrites it again, same provenance rule as AI classifications never
 * silently overriding a manual correction.
 */
async function syncImanageSourcedFields(matterId: string, workspaceId: string, workspace: Workspace): Promise<void> {
  const values: Record<string, unknown> = {
    workspace_id: workspaceId,
    matter_name: workspace.name,
    client_name: workspace.client ?? null,
  }
  const definitions = await getFieldDefinitionsByKeys(Object.keys(values))
  await Promise.all(
    definitions.map(async (definition) => {
      const value = values[definition.fieldKey]
      if (value === undefined) return
      const existing = await getFieldValue(matterId, definition.id)
      if (existing && existing.valueSource === 'user') return
      if (existing && existing.value === value) return
      await upsertFieldValue({ matterId, fieldDefinitionId: definition.id, value, valueSource: 'iManage', updatedBy: 'system:imanage-sync' })
    }),
  )
}

/** The single chokepoint every Phase 4 route calls first: resolves (creating if needed) the shared Matter row for a workspace, having just proven live iManage access to it. */
export async function resolveAccessibleMatter(req: Request, workspaceId: string): Promise<{ matter: Matter; workspace: Workspace }> {
  const workspace = await fetchLiveWorkspace(req, workspaceId)
  const identity: MatterIdentity = { tenantId: config.tenantId, libraryId: null, workspaceId }
  const matter = await resolveOrCreateMatter(identity, { workspaceName: workspace.name, createdBy: actorFor(req) })
  await syncImanageSourcedFields(matter.id, workspaceId, workspace)
  return { matter, workspace }
}
