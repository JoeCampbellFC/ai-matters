import type { Request } from 'express'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { getConnection } from '../mcp/connection.js'
import { ToolUnavailableError } from '../mcp/errors.js'
import {
  GET_CONTAINER_CHILDREN_TOOL,
  GET_DOCUMENT_PROFILE_TOOL,
  SEARCH_TOOL,
  buildGetContainerChildrenArgs,
  buildGetDocumentProfileArgs,
  buildGlobalSearchArgs,
  scopedSearchQuery,
} from '../mcp/tools.js'
import {
  type ContainerChild,
  type ContainerType,
  type DocumentProfile,
  type SearchHit,
  mapToolResultToContainerChildren,
  mapToolResultToDocumentProfile,
  mapToolResultToSearchHits,
} from '../mcp/matterMapper.js'
import type { Workspace } from '../mcp/workspaceMapper.js'
import { verifyWorkspaceMembership } from '../matterResearch/membership.js'

/** One page per request, never the whole tree -- the Documents panel's Browse tab expands folders on demand as the user clicks into them. */
const CHILDREN_PAGE_SIZE = 50
const SEARCH_PAGE_SIZE = 25
/** Caps the number of get_document_profile verification calls a single interactive search can trigger (one per unverified raw hit). */
const MAX_VERIFIED_SEARCH_RESULTS = 25

export interface DocumentChildrenPage {
  children: ContainerChild[]
  nextCursor?: string
}

/**
 * Lazily lists one container's immediate children -- used by the Documents
 * panel's Browse tab to expand a folder on demand. Deliberately does not
 * walk the tree (unlike graph/nodes/loadWorkspaceDocumentIds.ts, which
 * indexes an entire workspace up front for membership verification during a
 * research run): a live UI panel only ever needs the folder the user just
 * opened.
 */
export async function listContainerChildren(
  req: Request,
  input: { containerId: string; containerType: ContainerType; cursor?: string },
): Promise<DocumentChildrenPage> {
  const { client, tools } = await getConnection(req)
  const tool = tools.find((t) => t.name === GET_CONTAINER_CHILDREN_TOOL)
  if (!tool) throw new ToolUnavailableError(GET_CONTAINER_CHILDREN_TOOL)

  const result = (await client.callTool({
    name: tool.name,
    arguments: buildGetContainerChildrenArgs(tool, {
      containerId: input.containerId,
      containerType: input.containerType,
      cursor: input.cursor,
      limit: CHILDREN_PAGE_SIZE,
    }),
  })) as CallToolResult
  return mapToolResultToContainerChildren(result)
}

export interface VerifiedSearchHit extends SearchHit {
  verifiedBy: 'profile_match' | 'workspace_listing'
}

export interface DocumentSearchResult {
  hits: VerifiedSearchHit[]
  excludedCount: number
}

/**
 * Workspace-scoped document search for the Documents panel's Search tab.
 * `search` has no structured workspace filter of its own (see
 * scopedSearchQuery) -- so every raw hit is independently verified as a true
 * workspace member via the same membership module the research pipeline
 * uses before it is returned. A title/query match is never treated as proof
 * of membership: unverified hits are dropped entirely rather than shown
 * with a caveat, since this list feeds citation linking and must stay
 * trustworthy.
 */
export async function searchWorkspaceDocuments(
  req: Request,
  input: { workspaceId: string; workspace: Workspace; query: string },
): Promise<DocumentSearchResult> {
  const { client, tools } = await getConnection(req)
  const searchTool = tools.find((t) => t.name === SEARCH_TOOL)
  if (!searchTool) throw new ToolUnavailableError(SEARCH_TOOL)

  const result = (await client.callTool({
    name: searchTool.name,
    arguments: buildGlobalSearchArgs(searchTool, {
      query: scopedSearchQuery(input.workspace, input.query),
      limit: SEARCH_PAGE_SIZE,
    }),
  })) as CallToolResult
  const { hits } = mapToolResultToSearchHits(result)

  const candidateIds = [...new Set(hits.map((hit) => hit.documentId).filter((id): id is string => Boolean(id)))]

  const profileTool = tools.find((t) => t.name === GET_DOCUMENT_PROFILE_TOOL)
  const getDocumentProfile = async (documentId: string): Promise<DocumentProfile | null> => {
    if (!profileTool) return null
    const profileResult = (await client.callTool({
      name: profileTool.name,
      arguments: buildGetDocumentProfileArgs(profileTool, { documentId }),
    })) as CallToolResult
    return mapToolResultToDocumentProfile(profileResult)
  }

  const verification = await verifyWorkspaceMembership({ getDocumentProfile }, { workspaceId: input.workspaceId, candidateIds })
  const verifiedBy = new Map(verification.verified.map((v) => [v.documentId, v.verifiedBy]))

  const verifiedHits: VerifiedSearchHit[] = hits
    .filter((hit) => hit.documentId && verifiedBy.has(hit.documentId))
    .map((hit) => ({ ...hit, verifiedBy: verifiedBy.get(hit.documentId!)! }))
    .slice(0, MAX_VERIFIED_SEARCH_RESULTS)

  return { hits: verifiedHits, excludedCount: verification.excluded.length }
}
