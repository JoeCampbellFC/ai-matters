import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { McpToolError } from './errors.js'

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  client: z.string().optional(),
  matter: z.string().optional(),
  owner: z.string().optional(),
  lastModified: z.string().optional(),
  raw: z.record(z.string(), z.unknown()),
})

export type Workspace = z.infer<typeof WorkspaceSchema>

/**
 * iManage tenants may return workspace records under slightly different key
 * names depending on tenant configuration and MCP server version. We try the
 * common aliases observed in the documented tool responses and otherwise
 * leave the field absent rather than inventing a value.
 */
const ID_KEYS = ['id', 'workspace_id', 'workspaceId', 'databaseid', 'database_id', 'matter_id']
const NAME_KEYS = ['name', 'workspace_name', 'workspaceName', 'title']
const CLIENT_KEYS = ['client_name', 'clientName', 'client']
const MATTER_KEYS = ['matter_name', 'matterName', 'matter', 'description']
const OWNER_KEYS = ['owner', 'owner_name', 'ownerName', 'author']
const LAST_MODIFIED_KEYS = ['last_modified', 'lastModified', 'edit_date', 'editDate', 'modified_date', 'modifiedDate']

function firstString(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim().length > 0) return value
    if (typeof value === 'number') return String(value)
  }
  return undefined
}

export function normalizeWorkspace(raw: unknown): Workspace | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const id = firstString(record, ID_KEYS)
  const name = firstString(record, NAME_KEYS)
  if (!id || !name) return null

  return {
    id,
    name,
    client: firstString(record, CLIENT_KEYS),
    matter: firstString(record, MATTER_KEYS),
    owner: firstString(record, OWNER_KEYS),
    lastModified: firstString(record, LAST_MODIFIED_KEYS),
    raw: record,
  }
}

/**
 * MCP tool payloads may be a bare array, or an object wrapping the array
 * under a conventional key (workspaces/results/items/data).
 */
function extractRecordList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    for (const key of ['workspaces', 'results', 'items', 'data', 'records']) {
      const value = record[key]
      if (Array.isArray(value)) return value
    }
  }
  return []
}

function textFromContent(content: CallToolResult['content']): string {
  return (content ?? [])
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}

/**
 * Parses a raw MCP tool call result into a JS value, handling both
 * structured content (preferred) and text-encoded JSON content.
 */
export function extractToolPayload(result: CallToolResult): unknown {
  if (result.isError) {
    const message = textFromContent(result.content) || 'The MCP tool reported an error.'
    throw new McpToolError(message)
  }

  if (result.structuredContent !== undefined) {
    return result.structuredContent
  }

  const text = textFromContent(result.content)
  if (!text) return undefined

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function mapToolResultToWorkspaces(result: CallToolResult): Workspace[] {
  const payload = extractToolPayload(result)
  const list = extractRecordList(payload)
  const workspaces: Workspace[] = []
  for (const item of list) {
    const workspace = normalizeWorkspace(item)
    if (workspace) workspaces.push(workspace)
  }
  return workspaces
}
