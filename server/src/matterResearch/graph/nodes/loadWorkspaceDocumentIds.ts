import { GET_CONTAINER_CHILDREN_TOOL, buildGetContainerChildrenArgs, findTool } from '../../../mcp/tools.js'
import { mapToolResultToContainerChildren, type ContainerType } from '../../../mcp/matterMapper.js'
import { incrementBudget } from '../../budget.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { callTool, emit, emitStage, requireContext, type NodeConfig } from './shared.js'

const PAGE_SIZE = 100
/**
 * Independent of the run's overall mcpCalls budget (which is operator-
 * configurable, see RESEARCH_MAX_MCP_CALLS, and can be set far higher than
 * this) -- bounds a single indexing pass so it can never quietly consume an
 * entire run. 300 pages * 100 items/page = up to 30,000 items, far beyond
 * any real matter; hitting this cap points at a live schema mismatch (e.g.
 * container_type not actually narrowing results, or items being
 * misclassified) rather than a genuinely huge workspace.
 */
const MAX_CONTAINER_CALLS = 300

/**
 * Walks the workspace's full container tree (workspace -> folders/tabs ->
 * documents) once per run via get_container_children, so verifyMembership
 * can check candidates with a Set lookup instead of a get_document_profile
 * call per candidate -- the dominant MCP cost of a run otherwise (one call
 * per search hit, every refine pass). Runs once, before the refine loop
 * (see graph.ts), unlike verifyMembership which re-runs every pass.
 *
 * Bounded by the same mcpCalls budget as every other node: if the tree is
 * larger than the remaining budget allows, the walk stops early and reports
 * itself incomplete (`workspaceDocumentIdsComplete: false`) rather than
 * silently returning a partial listing as if it were exhaustive --
 * verifyMembership falls back to per-candidate verification for anything
 * not found in an incomplete listing.
 */
export async function loadWorkspaceDocumentIds(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  emitStage(config, state, 'initializing')

  const { tools, limits } = requireContext(config)
  if (!findTool(tools, GET_CONTAINER_CHILDREN_TOOL)) {
    emit(config, {
      type: 'activity',
      stage: 'initializing',
      message: 'This MCP server does not expose document listing -- membership will be verified per document instead.',
    })
    return { workspaceDocumentIdsComplete: false }
  }

  emit(config, { type: 'activity', stage: 'initializing', message: 'Indexing workspace documents…' })

  const documentIds = new Set<string>()
  const visited = new Set<string>()
  const queue: Array<{ containerId: string; containerType: ContainerType; name?: string }> = [
    { containerId: state.workspaceId, containerType: 'workspace' },
  ]
  let mcpCalls = 0
  let containersVisited = 0
  let complete = true

  const withinBudget = () => state.budget.mcpCalls + mcpCalls < limits.maxMcpCalls && mcpCalls < MAX_CONTAINER_CALLS

  outer: while (queue.length > 0) {
    const container = queue.shift()!
    if (visited.has(container.containerId)) continue
    visited.add(container.containerId)
    containersVisited += 1

    emit(config, {
      type: 'workspace_folder_scanning',
      folderName:
        container.name ??
        (container.containerType === 'workspace' ? (state.workspace?.name ?? state.workspaceId) : container.containerId),
    })

    let cursor: string | undefined
    do {
      if (!withinBudget()) {
        complete = false
        break outer
      }
      const result = await callTool(config, GET_CONTAINER_CHILDREN_TOOL, (tool) =>
        buildGetContainerChildrenArgs(tool, { containerId: container.containerId, containerType: container.containerType, cursor, limit: PAGE_SIZE }),
      )
      mcpCalls += 1
      const { children, nextCursor } = mapToolResultToContainerChildren(result)

      for (const child of children) {
        if (child.type === 'document' || child.type === 'email') {
          documentIds.add(child.id)
        } else if ((child.type === 'folder' || child.type === 'tab') && !visited.has(child.id)) {
          queue.push({ containerId: child.id, containerType: child.type, name: child.name })
        }
      }

      // An empty page means nothing more to find here, regardless of whatever
      // cursor the server hands back -- observed live against a real tenant,
      // a later page can come back empty while still claiming a "next" cursor,
      // which would otherwise loop forever re-requesting the same exhausted
      // container. Likewise stop if the cursor didn't actually advance.
      cursor = children.length > 0 && nextCursor !== cursor ? nextCursor : undefined

      emit(config, {
        type: 'activity',
        stage: 'initializing',
        message:
          `Indexing${container.name ? ` "${container.name}"` : ''}: ${documentIds.size} ${documentIds.size === 1 ? 'document' : 'documents'} found so far ` +
          `(${mcpCalls} ${mcpCalls === 1 ? 'call' : 'calls'}, ${containersVisited} ${containersVisited === 1 ? 'folder' : 'folders'} scanned, ${queue.length} queued)…`,
      })
    } while (cursor)
  }

  emit(config, {
    type: 'activity',
    stage: 'initializing',
    message:
      `Indexed ${documentIds.size} ${documentIds.size === 1 ? 'document' : 'documents'} in this workspace` +
      (complete
        ? ''
        : ` (stopped early after ${mcpCalls} calls across ${containersVisited} folders -- falling back to per-document checks for the rest)`),
  })

  return {
    workspaceDocumentIds: documentIds,
    workspaceDocumentIdsComplete: complete,
    budget: incrementBudget(state.budget, { mcpCalls }),
  }
}
