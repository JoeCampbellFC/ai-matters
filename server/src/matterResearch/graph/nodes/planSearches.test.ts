import { describe, expect, it, vi } from 'vitest'
import { initialBudget } from '../../budget.js'
import type { BudgetCounters, SelectedSkill } from '../../types.js'
import type { ResearchState } from '../state.js'
import type { NodeConfig } from './shared.js'

const { invoke, getAzureChatModel } = vi.hoisted(() => {
  const invoke = vi.fn()
  const withStructuredOutput = vi.fn(() => ({ invoke }))
  const getAzureChatModel = vi.fn(() => ({ invoke, withStructuredOutput }))
  return { invoke, getAzureChatModel }
})

vi.mock('../../../llm/azureOpenAI.js', () => ({ getAzureChatModel }))

const SKILLS: Record<string, { name: string; description: string; body: string }> = {
  'general-matter-research': { name: 'general-matter-research', description: 'Default strategy.', body: 'General guidance.' },
  'ma-matter-research': { name: 'ma-matter-research', description: 'M&A playbook.', body: 'M&A guidance.' },
}

vi.mock('../../skills.js', () => ({
  FALLBACK_SKILL_NAME: 'general-matter-research',
  listSkillSummaries: vi.fn(async () => Object.values(SKILLS).map(({ name, description }) => ({ name, description }))),
  getSkill: vi.fn(async (name: string) => SKILLS[name]),
  getFallbackSkill: vi.fn(async () => SKILLS['general-matter-research']),
}))

const { planSearches } = await import('./planSearches.js')

function state(overrides: Partial<ResearchState> = {}): ResearchState {
  return {
    runId: 'run-1',
    sessionId: 'session-1',
    workspaceId: 'WS-1',
    workspace: { id: 'WS-1', name: 'Acme Share Purchase', raw: {} },
    workspaceDocumentIds: new Set(),
    workspaceDocumentIdsComplete: false,
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
    stage: 'planning_searches',
    warnings: [],
    ...overrides,
  }
}

function config(): NodeConfig {
  const written: unknown[] = []
  return { configurable: { client: {} as never, tools: [], limits: {} as never }, writer: (chunk) => written.push(chunk) }
}

describe('planSearches', () => {
  it('selects a skill once (emitting skill_selected) and reuses it on later calls', async () => {
    invoke
      .mockResolvedValueOnce({ skillName: 'ma-matter-research', rationale: 'Looks like a share purchase.' })
      .mockResolvedValueOnce({ searches: [{ query: 'share purchase agreement', rationale: 'core deal document' }] })

    const events: unknown[] = []
    const cfg = { ...config(), writer: (chunk: unknown) => events.push(chunk) }

    const update = await planSearches(state(), cfg)

    expect(update.skill).toEqual({
      name: 'ma-matter-research',
      description: expect.any(String),
      rationale: 'Looks like a share purchase.',
    })
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'skill_selected', skillName: 'ma-matter-research' }),
    )
    expect((update.budget as BudgetCounters).llmCalls).toBe(2)
    expect(invoke).toHaveBeenCalledTimes(2)

    invoke.mockReset()
    invoke.mockResolvedValueOnce({ searches: [{ query: 'closing checklist', rationale: 'confirms completion' }] })

    const secondState = state({
      skill: update.skill as SelectedSkill,
      coverage: { coveredTopics: [], gaps: [{ topic: 'x', reason: 'y' }] },
    })
    const secondEvents: unknown[] = []
    const secondUpdate = await planSearches(secondState, { ...config(), writer: (chunk) => secondEvents.push(chunk) })

    // Re-affirms the already-selected skill (idempotent) rather than clearing it, but does not re-select it.
    expect(secondUpdate.skill).toEqual(update.skill)
    expect(secondEvents).not.toContainEqual(expect.objectContaining({ type: 'skill_selected' }))
    expect(invoke).toHaveBeenCalledTimes(1)
    expect((secondUpdate.budget as BudgetCounters).llmCalls).toBe(1)
  })
})
