import { GET_CONTAINER_CHILDREN_TOOL, buildGetContainerChildrenArgs } from '../../../mcp/tools.js'
import { mapToolResultToContainerChildren } from '../../../mcp/matterMapper.js'
import { incrementBudget } from '../../budget.js'
import type { CandidateDocument } from '../../types.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { callTool, emit, requireContext, type NodeConfig } from './shared.js'

const MAX_ITEMS = 500
const MAX_DEPTH = 4
const PAGE_SIZE = 100

/**
 * Recursively walks the workspace's own container tree via
 * get_container_children. Every document found this way is a workspace
 * member by construction -- no later verification call is needed for it.
 * Folder children are recursed into (bounded by depth/count); workspace and
 * shortcut children are intentionally not traversed into, since they belong
 * to (or point outside) a different container.
 */
export async function traverseContainer(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  if (state.containerTraversalComplete || !state.containerId) {
    return { containerTraversalComplete: true }
  }

  emit(config, { type: 'activity', stage: 'traversing_workspace', message: 'Examining workspace structure…' })

  const { limits } = requireContext(config)
  const candidates: Record<string, CandidateDocument> = {}
  let mcpCalls = 0
  let folderCount = 0

  const queue: Array<{ containerId: string; depth: number }> = [{ containerId: state.containerId, depth: 0 }]
  const visitedContainers = new Set<string>()

  while (queue.length > 0 && Object.keys(candidates).length < MAX_ITEMS) {
    if (state.budget.mcpCalls + mcpCalls >= limits.maxMcpCalls) break
    const next = queue.shift()
    if (!next || visitedContainers.has(next.containerId)) continue
    visitedContainers.add(next.containerId)

    let cursor: string | undefined
    do {
      const result = await callTool(config, GET_CONTAINER_CHILDREN_TOOL, (tool) =>
        buildGetContainerChildrenArgs(tool, { containerId: next.containerId, cursor, limit: PAGE_SIZE }),
      )
      mcpCalls += 1
      const { children, nextCursor } = mapToolResultToContainerChildren(result)

      for (const child of children) {
        if (child.type === 'document' || child.type === 'email') {
          candidates[child.id] = {
            documentId: child.id,
            name: child.name,
            discoveredVia: ['container_traversal'],
            status: 'candidate',
          }
        } else if (child.type === 'folder' && next.depth < MAX_DEPTH) {
          folderCount += 1
          queue.push({ containerId: child.id, depth: next.depth + 1 })
        }
      }

      cursor = nextCursor
    } while (cursor && Object.keys(candidates).length < MAX_ITEMS && state.budget.mcpCalls + mcpCalls < limits.maxMcpCalls)
  }

  for (const candidate of Object.values(candidates)) {
    emit(config, {
      type: 'document_discovered',
      document: {
        documentId: candidate.documentId,
        name: candidate.name,
        status: 'candidate',
        discoveredVia: candidate.discoveredVia,
      },
    })
  }

  const count = Object.keys(candidates).length
  emit(config, {
    type: 'activity',
    stage: 'traversing_workspace',
    message: `Identified ${folderCount} ${folderCount === 1 ? 'folder' : 'folders'} and ${count} candidate ${count === 1 ? 'document' : 'documents'}`,
  })

  return {
    candidates,
    containerTraversalComplete: true,
    budget: incrementBudget(state.budget, { mcpCalls }),
  }
}
