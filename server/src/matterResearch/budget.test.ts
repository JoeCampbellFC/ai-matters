import { describe, expect, it } from 'vitest'
import { checkBudget, initialBudget, type BudgetLimits } from './budget.js'
import type { BudgetCounters } from './types.js'

const GENEROUS_LIMITS: BudgetLimits = {
  maxIterations: 100,
  maxDocuments: 100,
  maxDurationMs: 1_000_000,
  maxLlmCalls: 100,
  maxMcpCalls: 100,
}

function budget(overrides: Partial<BudgetCounters> = {}): BudgetCounters {
  return { ...initialBudget(), ...overrides }
}

describe('checkBudget', () => {
  it('reports no limit exceeded for a fresh budget under generous limits', () => {
    expect(checkBudget(budget(), GENEROUS_LIMITS)).toBeUndefined()
  })

  it('flags max_iterations independently', () => {
    expect(checkBudget(budget({ iterationCount: 3 }), { ...GENEROUS_LIMITS, maxIterations: 3 })).toBe(
      'max_iterations',
    )
  })

  it('flags max_documents independently', () => {
    expect(checkBudget(budget({ documentsFetched: 40 }), { ...GENEROUS_LIMITS, maxDocuments: 40 })).toBe(
      'max_documents',
    )
  })

  it('flags max_llm_calls independently', () => {
    expect(checkBudget(budget({ llmCalls: 60 }), { ...GENEROUS_LIMITS, maxLlmCalls: 60 })).toBe('max_llm_calls')
  })

  it('flags max_mcp_calls independently', () => {
    expect(checkBudget(budget({ mcpCalls: 300 }), { ...GENEROUS_LIMITS, maxMcpCalls: 300 })).toBe('max_mcp_calls')
  })

  it('flags max_duration independently', () => {
    const started = budget({ startedAt: new Date(Date.now() - 1_000).toISOString() })
    expect(checkBudget(started, { ...GENEROUS_LIMITS, maxDurationMs: 500 })).toBe('max_duration')
  })
})
