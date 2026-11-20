import { config } from '../config.js'
import type { BudgetCounters, BudgetLimitReason } from './types.js'

export interface BudgetLimits {
  maxIterations: number
  maxDocuments: number
  maxDurationMs: number
  maxLlmCalls: number
  maxMcpCalls: number
}

export function budgetLimitsFromConfig(): BudgetLimits {
  return {
    maxIterations: config.researchMaxIterations,
    maxDocuments: config.researchMaxDocuments,
    maxDurationMs: config.researchMaxDurationMs,
    maxLlmCalls: config.researchMaxLlmCalls,
    maxMcpCalls: config.researchMaxMcpCalls,
  }
}

export function initialBudget(): BudgetCounters {
  return {
    startedAt: new Date().toISOString(),
    iterationCount: 0,
    documentsFetched: 0,
    llmCalls: 0,
    mcpCalls: 0,
  }
}

/**
 * Checks each budget dimension independently and returns the first one
 * exceeded, or undefined if the run is still within every limit. Order
 * matters only for which reason is reported when several are exceeded at
 * once; callers should treat budget exhaustion as a graceful stop, not a
 * failure.
 */
export function checkBudget(budget: BudgetCounters, limits: BudgetLimits): BudgetLimitReason | undefined {
  if (budget.iterationCount >= limits.maxIterations) return 'max_iterations'
  if (budget.documentsFetched >= limits.maxDocuments) return 'max_documents'
  if (budget.llmCalls >= limits.maxLlmCalls) return 'max_llm_calls'
  if (budget.mcpCalls >= limits.maxMcpCalls) return 'max_mcp_calls'
  const elapsedMs = Date.now() - new Date(budget.startedAt).getTime()
  if (elapsedMs >= limits.maxDurationMs) return 'max_duration'
  return undefined
}

export function isBudgetExceeded(budget: BudgetCounters, limits: BudgetLimits): boolean {
  return checkBudget(budget, limits) !== undefined
}

type BudgetCounterDeltas = Partial<Pick<BudgetCounters, 'mcpCalls' | 'llmCalls' | 'documentsFetched' | 'iterationCount'>>

/** Returns a full BudgetCounters with the given counters incremented -- the graph state's reducer overwrites whatever keys a node returns, so nodes must compute the new totals themselves. */
export function incrementBudget(current: BudgetCounters, delta: BudgetCounterDeltas): BudgetCounters {
  return {
    ...current,
    mcpCalls: current.mcpCalls + (delta.mcpCalls ?? 0),
    llmCalls: current.llmCalls + (delta.llmCalls ?? 0),
    documentsFetched: current.documentsFetched + (delta.documentsFetched ?? 0),
    iterationCount: current.iterationCount + (delta.iterationCount ?? 0),
  }
}
