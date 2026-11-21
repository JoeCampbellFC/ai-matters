import { GET_WORKSPACE_PROFILE_TOOL, buildGetWorkspaceProfileArgs } from '../../../mcp/tools.js'
import { extractToolPayload, normalizeWorkspace } from '../../../mcp/workspaceMapper.js'
import { incrementBudget } from '../../budget.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { callTool, emit, emitStage, type NodeConfig } from './shared.js'

/** get_workspace_profile may return the profile bare or wrapped under a conventional key. */
function unwrapProfilePayload(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) return payload
  const record = payload as Record<string, unknown>
  for (const key of ['workspace', 'profile', 'data']) {
    if (typeof record[key] === 'object' && record[key] !== null) return record[key]
  }
  return payload
}

export async function loadWorkspaceContext(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  emitStage(config, state, 'initializing')
  emit(config, { type: 'activity', stage: 'initializing', message: 'Connecting to workspace…' })

  const result = await callTool(config, GET_WORKSPACE_PROFILE_TOOL, (tool) =>
    buildGetWorkspaceProfileArgs(tool, { workspaceId: state.workspaceId }),
  )
  const payload = unwrapProfilePayload(extractToolPayload(result))
  const workspace = normalizeWorkspace(payload)

  emit(config, {
    type: 'activity',
    stage: 'initializing',
    message: workspace ? `Retrieved workspace profile for "${workspace.name}"` : 'Retrieved workspace profile',
  })

  const rawContainerId = workspace?.raw.container_id
  const containerId = (typeof rawContainerId === 'string' && rawContainerId) || state.workspaceId

  return {
    workspace: workspace ?? undefined,
    containerId,
    budget: incrementBudget(state.budget, { mcpCalls: 1 }),
  }
}
