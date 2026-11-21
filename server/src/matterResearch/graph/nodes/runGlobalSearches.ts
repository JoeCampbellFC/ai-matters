import { SEARCH_TOOL, buildGlobalSearchArgs } from '../../../mcp/tools.js'
import { mapToolResultToSearchHits } from '../../../mcp/matterMapper.js'
import { incrementBudget } from '../../budget.js'
import type { CandidateDocument, DiscoverySource } from '../../types.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { callTool, emit, requireContext, type NodeConfig } from './shared.js'

const MAX_RESULTS_PER_QUERY = 25

/**
 * Executes this iteration's planned searches via the unscoped `search` tool.
 * Results are unverified leads only -- they're tagged 'global_search' and
 * must pass verifyMembership before anything can be fetched.
 */
export async function runGlobalSearches(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  const plansThisIteration = state.searchPlans.filter((plan) => plan.iteration === state.budget.iterationCount)
  if (plansThisIteration.length === 0) {
    return {}
  }

  emit(config, { type: 'activity', stage: 'searching', message: 'Searching matter documents…' })

  const { limits } = requireContext(config)
  const candidates: Record<string, CandidateDocument> = {}
  let mcpCalls = 0
  let totalHits = 0

  for (const plan of plansThisIteration) {
    if (state.budget.mcpCalls + mcpCalls >= limits.maxMcpCalls) break

    emit(config, { type: 'search_started', query: plan.query })

    const result = await callTool(config, SEARCH_TOOL, (tool) =>
      buildGlobalSearchArgs(tool, { query: plan.query, limit: MAX_RESULTS_PER_QUERY }),
    )
    mcpCalls += 1
    const { hits } = mapToolResultToSearchHits(result)
    totalHits += hits.length

    emit(config, { type: 'search_completed', query: plan.query, resultCount: hits.length })

    for (const hit of hits) {
      if (!hit.documentId) continue
      const existing = state.candidates[hit.documentId] ?? candidates[hit.documentId]
      const discoveredVia: DiscoverySource[] = existing
        ? Array.from(new Set([...existing.discoveredVia, 'global_search']))
        : ['global_search']
      candidates[hit.documentId] = {
        ...existing,
        documentId: hit.documentId,
        name: hit.name ?? existing?.name,
        description: hit.snippet ?? existing?.description,
        discoveredVia,
        status: existing?.status ?? 'candidate',
      }
    }
  }

  let newCount = 0
  for (const [id, candidate] of Object.entries(candidates)) {
    if (state.candidates[id]) continue
    newCount += 1
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

  emit(config, {
    type: 'activity',
    stage: 'searching',
    message: `Found ${totalHits} search ${totalHits === 1 ? 'result' : 'results'} across ${plansThisIteration.length} ${plansThisIteration.length === 1 ? 'query' : 'queries'} (${newCount} new)`,
  })

  return {
    candidates,
    budget: incrementBudget(state.budget, { mcpCalls }),
  }
}
