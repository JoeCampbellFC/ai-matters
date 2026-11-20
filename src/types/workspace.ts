/**
 * Mirrors server/src/mcp/workspaceMapper.ts — only fields the MCP tool
 * actually returned are populated; everything else is left undefined rather
 * than inferred or fabricated.
 */
export interface Workspace {
  id: string
  name: string
  client?: string
  matter?: string
  owner?: string
  lastModified?: string
  raw: Record<string, unknown>
}

export type McpConnectionState =
  | 'not_connected'
  | 'connecting'
  | 'connected'
  | 'auth_required'
  | 'permission_denied'
  | 'tool_unavailable'
  | 'error'

export interface McpStatus {
  state: McpConnectionState
  environment: string
  authenticatedUser?: {
    sub?: string
    name?: string
    email?: string
  }
  tools?: {
    searchWorkspaces: boolean
    getRecentWorkspaces: boolean
    getLibraries: boolean
  }
  error?: string
}

export interface McpToolSummary {
  name: string
  description?: string
  inputSchema: unknown
}

export interface Library {
  id: string
  name: string
}
