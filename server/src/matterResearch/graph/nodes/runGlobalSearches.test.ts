import { describe, expect, it, vi } from 'vitest'
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { BudgetLimits } from '../../budget.js'
import { initialBudget } from '../../budget.js'
import type { ResearchState } from '../state.js'
import { runGlobalSearches } from './runGlobalSearches.js'
import type { NodeConfig } from './shared.js'

const SEARCH_TOOL_SCHEMA: Tool = {
  name: 'search',
  inputSchema: { type: 'object', properties: { query: { type: 'string' }, cursor: { type: 'string' }, limit: { type: 'number' } } },
}

const GENEROUS_LIMITS: BudgetLimits = {
  maxIterations: 3,
  maxDocuments: 40,
  maxDurationMs: 60_000,
  maxLlmCalls: 60,
  maxMcpCalls: 300,
}

function state(overrides: Partial<ResearchState> = {}): ResearchState {
  return {
    runId: 'run-1',
    sessionId: 'session-1',
    workspaceId: 'WS-1',
    workspace: undefined,
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
    stage: 'searching',
    warnings: [],
    ...overrides,
  }
}

function config(
  callTool: (args: { name: string; arguments: Record<string, unknown> }) => Promise<CallToolResult>,
  events: unknown[] = [],
): NodeConfig {
  const client = { callTool } as unknown as Client
  return {
    configurable: { client, tools: [SEARCH_TOOL_SCHEMA], limits: GENEROUS_LIMITS },
    writer: (chunk) => events.push(chunk),
  }
}

function result(payload: Record<string, unknown>): CallToolResult {
  return { content: [], structuredContent: payload }
}

describe('runGlobalSearches', () => {
  it('skips a query whose search call fails, instead of failing the whole run', async () => {
    const callTool = vi.fn(async ({ arguments: args }: { name: string; arguments: Record<string, unknown> }) => {
      if (args.query === 'bad query') {
        // Mirrors a real failure observed live: the SDK/server rejects with a
        // JSON-serialized Zod-style issues array as the error message.
        throw new Error(
          JSON.stringify([
            { expected: 'string', code: 'invalid_type', path: ['results', 34, 'title'], message: 'Invalid input: expected string, received undefined' },
          ]),
        )
      }
      return result({ results: [{ id: 'DOC-1', title: 'Engagement Letter' }] })
    })

    const events: unknown[] = []
    const update = await runGlobalSearches(
      state({
        searchPlans: [
          { query: 'bad query', rationale: 'r1', iteration: 0 },
          { query: 'good query', rationale: 'r2', iteration: 0 },
        ],
      }),
      config(callTool, events),
    )

    expect(callTool).toHaveBeenCalledTimes(2)
    expect(update.candidates).toEqual({ 'DOC-1': expect.objectContaining({ documentId: 'DOC-1' }) })
    expect((update.budget as { mcpCalls: number }).mcpCalls).toBe(2)

    const activityMessages = events.filter(
      (e): e is { type: string; message: string } => typeof e === 'object' && e !== null && (e as { type?: string }).type === 'activity',
    )
    expect(activityMessages.some((e) => e.message.includes('Search for "bad query" failed and was skipped'))).toBe(true)
    expect(activityMessages.some((e) => e.message.includes('Invalid input: expected string, received undefined'))).toBe(true)

    const completedEvents = events.filter(
      (e): e is { type: string; query: string; resultCount: number } =>
        typeof e === 'object' && e !== null && (e as { type?: string }).type === 'search_completed',
    )
    expect(completedEvents).toEqual(
      expect.arrayContaining([
        { type: 'search_completed', query: 'bad query', resultCount: 0 },
        { type: 'search_completed', query: 'good query', resultCount: 1 },
      ]),
    )
  })
})
