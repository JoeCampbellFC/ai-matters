import { checkBudget } from '../../budget.js'
import type { ResearchState } from '../state.js'
import { requireContext, type NodeConfig } from './shared.js'

export type CoverageRoute = 'refine' | 'proceed'

/**
 * Bounds the refine loop: only continues when there are real evidence gaps
 * AND every budget dimension (including max iterations) is still within
 * limits. This is the single most important safety net in the graph --
 * coverage reporting a gap can never loop forever.
 */
export function routeAfterCoverage(state: ResearchState, config: NodeConfig): CoverageRoute {
  const { limits } = requireContext(config)
  const hasGaps = (state.coverage?.gaps.length ?? 0) > 0
  const withinBudget = checkBudget(state.budget, limits) === undefined
  return hasGaps && withinBudget ? 'refine' : 'proceed'
}
