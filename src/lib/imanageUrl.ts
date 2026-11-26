/**
 * Builds a link to a workspace's page in iManage Work's own web UI --
 * distinct from the MCP endpoint this app talks to (same host, different
 * path). There's no separate "library id" field anywhere in this app's data
 * model: per this tenant's id convention, it's literally the part of the
 * workspace id before "!" (e.g. "ACTIVE!123772" -> library "ACTIVE").
 *
 * `mcpEndpointUrl` is the already-fetched MCP status's `environment` field
 * (e.g. "https://fireman.cloudimanage.com/mcp/work") -- only its origin is
 * used, so this works regardless of the MCP path.
 */
export function buildImanageWorkspaceUrl(mcpEndpointUrl: string | undefined, workspaceId: string): string | undefined {
  if (!mcpEndpointUrl) return undefined
  const library = workspaceId.split('!')[0]
  if (!library || library === workspaceId) return undefined

  try {
    const origin = new URL(mcpEndpointUrl).origin
    return `${origin}/work/web/r/libraries/${encodeURIComponent(library)}/workspaces/${encodeURIComponent(workspaceId)}`
  } catch {
    return undefined
  }
}
