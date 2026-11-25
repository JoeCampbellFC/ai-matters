import { SEARCH_TOOL, buildGlobalSearchArgs } from '../../../mcp/tools.js'
import { type SearchHit, mapToolResultToSearchHits } from '../../../mcp/matterMapper.js'
import { incrementBudget } from '../../budget.js'
import type { CandidateDocument, DiscoverySource } from '../../types.js'
import type { ResearchState, ResearchStateUpdate } from '../state.js'
import { callTool, emit, emitStage, requireContext, summarizeToolError, type NodeConfig } from './shared.js'

const MAX_RESULTS_PER_QUERY = 25

function rawString(raw: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = raw?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

/**
 * The `search` tool (iManage's Search connector) takes a single free-text
 * natural-language query with no structured workspace/client/matter filter
 * -- so client (custom1) and matter (custom2) identifiers are embedded
 * directly in the query text, the way iManage's own docs phrase it (e.g.
 * "Search client 3456, matter 7659 for arbitration-related documents").
 * This scopes results toward the right matter but is still a best-effort
 * text match, not a guarantee -- every hit still goes through
 * verifyMembership before anything is fetched.
 */
function scopedQuery(workspace: { raw: Record<string, unknown> } | undefined, query: string): string {
  const client = rawString(workspace?.raw, 'custom1')
  const matter = rawString(workspace?.raw, 'custom2')
  if (client && matter) return `Search client ${client}, matter ${matter} for ${query}`
  if (client) return `Search client ${client} for ${query}`
  if (matter) return `Search matter ${matter} for ${query}`
  return query
}

/**
 * Executes this iteration's planned searches via the unscoped `search` tool.
 * Results are unverified leads only -- they're tagged 'global_search' and
 * must pass verifyMembership before anything can be fetched.
 */
export async function runGlobalSearches(state: ResearchState, config: NodeConfig): Promise<ResearchStateUpdate> {
  emitStage(config, state, 'searching')

  const plansThisIteration = state.searchPlans.filter((plan) => plan.iteration === state.budget.iterationCount)
  if (plansThisIteration.length === 0) {
    return {}
  }

  const isRefinement = state.coverage !== undefined
  emit(config, {
    type: 'activity',
    stage: 'searching',
    message: isRefinement ? 'Running new searches to close evidence gaps…' : 'Searching matter documents…',
  })

  const { limits } = requireContext(config)
  const candidates: Record<string, CandidateDocument> = {}
  let mcpCalls = 0
  let totalHits = 0

  for (const plan of plansThisIteration) {
    if (state.budget.mcpCalls + mcpCalls >= limits.maxMcpCalls) break

    emit(config, { type: 'search_started', query: plan.query })

    let hits: SearchHit[]
    try {
      const result = await callTool(config, SEARCH_TOOL, (tool) =>
        buildGlobalSearchArgs(tool, { query: scopedQuery(state.workspace, plan.query), limit: MAX_RESULTS_PER_QUERY }),
      )
      mcpCalls += 1
      hits = mapToolResultToSearchHits(result).hits
    } catch (error) {
      // A single malformed/oversized result set (e.g. the live server returning an
      // item missing a field its own schema requires) must not fail the whole run --
      // skip this query's results and keep going with the rest.
      mcpCalls += 1
      emit(config, {
        type: 'activity',
        stage: 'searching',
        message: `Search for "${plan.query}" failed and was skipped: ${summarizeToolError(error)}`,
      })
      emit(config, { type: 'search_completed', query: plan.query, resultCount: 0 })
      continue
    }
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
