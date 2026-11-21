import { describe, expect, it } from 'vitest'
import type { BudgetLimits } from '../../budget.js'
import { initialBudget } from '../../budget.js'
import type { ResearchState } from '../state.js'
import { routeAfterCoverage } from './routeAfterCoverage.js'
import type { NodeConfig } from './shared.js'

const GENEROUS_LIMITS: BudgetLimits = {
  maxIterations: 3,
  maxDocuments: 40,
  maxDurationMs: 1_000_000,
  maxLlmCalls: 60,
  maxMcpCalls: 300,
}

function state(overrides: Partial<ResearchState> = {}): ResearchState {
  return {
    runId: 'run-1',
    sessionId: 'session-1',
    workspaceId: 'WS-1',
    workspace: undefined,
    containerId: undefined,
    containerTraversalComplete: false,
    skill: undefined,
    searchPlans: [],
    candidates: {},
    selectedDocumentIds: [],
    evidence: [],
    coverage: undefined,
    outline: undefined,
    citationRegistry: [],
    sectionMarkdown: [],
    markdown: undefined,
    budget: initialBudget(),
    status: 'running',
    stage: 'assessing_coverage',
    warnings: [],
    ...overrides,
  }
}

function config(limits: BudgetLimits): NodeConfig {
  return { configurable: { client: {} as never, tools: [], limits } }
}

describe('routeAfterCoverage', () => {
  it('refines when gaps exist and the budget allows it', () => {
    const s = state({ coverage: { coveredTopics: [], gaps: [{ topic: 'outcome', reason: 'no evidence' }] } })
    expect(routeAfterCoverage(s, config(GENEROUS_LIMITS))).toBe('refine')
  })

  it('proceeds when coverage reports no gaps', () => {
    const s = state({ coverage: { coveredTopics: ['outcome'], gaps: [] } })
    expect(routeAfterCoverage(s, config(GENEROUS_LIMITS))).toBe('proceed')
  })

  it('proceeds once the iteration cap is reached, even though gaps still exist', () => {
    const s = state({
      coverage: { coveredTopics: [], gaps: [{ topic: 'outcome', reason: 'still missing' }] },
      budget: { ...initialBudget(), iterationCount: 3 },
    })
    expect(routeAfterCoverage(s, config(GENEROUS_LIMITS))).toBe('proceed')
  })

  it('proceeds when any other budget dimension is exhausted, even with gaps', () => {
    const s = state({
      coverage: { coveredTopics: [], gaps: [{ topic: 'outcome', reason: 'still missing' }] },
      budget: { ...initialBudget(), documentsFetched: 40 },
    })
    expect(routeAfterCoverage(s, config(GENEROUS_LIMITS))).toBe('proceed')
  })
})
