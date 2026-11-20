import { describe, expect, it, vi } from 'vitest'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { BudgetLimits } from '../budget.js'

const { invoke, getAzureChatModel } = vi.hoisted(() => {
  /**
   * A single mock response object satisfying every structured-output schema
   * the graph's nodes ask for at once -- each node only reads the keys it
   * cares about, so one shared fixture is enough and avoids coupling this
   * test to each node's internal (unexported) zod schema.
   */
  const allInOneResponse = {
    searches: [{ query: 'engagement letter', rationale: 'likely to establish matter scope' }],
    rankings: [] as Array<{ documentId: string; relevanceScore: number; rationale: string }>,
    claims: [] as Array<{ claim: string; quote?: string; topic: string; confidence: 'high' | 'medium' | 'low' }>,
    coveredTopics: [] as string[],
    gaps: [{ topic: 'current status and outcome', reason: 'no supporting evidence found yet' }],
    sections: [] as Array<{ heading: string; topics: string[]; evidenceIds: string[] }>,
    markdown: '## placeholder\n\nplaceholder',
    content: 'Placeholder narrative prose.',
  }
  const invoke = vi.fn().mockResolvedValue(allInOneResponse)
  const withStructuredOutput = vi.fn(() => ({ invoke }))
  const getAzureChatModel = vi.fn(() => ({ invoke, withStructuredOutput }))
  return { invoke, getAzureChatModel }
})

vi.mock('../../llm/azureOpenAI.js', () => ({ getAzureChatModel }))

const { buildMatterResearchGraph } = await import('./graph.js')

function tool(name: string, properties: Record<string, { type: string }>): Tool {
  return { name, inputSchema: { type: 'object', properties } } as Tool
}

const TOOLS: Tool[] = [
  tool('get_workspace_profile', { workspace_id: { type: 'string' } }),
  tool('get_container_children', {
    container_id: { type: 'string' },
    cursor: { type: 'string' },
    limit: { type: 'number' },
  }),
  tool('search', { query: { type: 'string' } }),
  tool('get_document_profile', { document_id: { type: 'string' } }),
  tool('fetch', { document_id: { type: 'string' } }),
]

function emptyResult(structuredContent: Record<string, unknown>): CallToolResult {
  return { content: [], structuredContent }
}

const GENEROUS_LIMITS: BudgetLimits = {
  maxIterations: 2,
  maxDocuments: 40,
  maxDurationMs: 60_000,
  maxLlmCalls: 60,
  maxMcpCalls: 300,
}

describe('buildMatterResearchGraph', () => {
  it('runs end to end, bounded by the iteration cap even though coverage always reports gaps', async () => {
    const callTool = vi.fn(async ({ name }: { name: string }) => {
      switch (name) {
        case 'get_workspace_profile':
          return emptyResult({ id: 'WS-1', name: 'Acme Matter' })
        case 'get_container_children':
          return emptyResult({ children: [] })
        case 'search':
          return emptyResult({ results: [] })
        default:
          return emptyResult({})
      }
    })
    const client = { callTool } as unknown as Client

    const graph = buildMatterResearchGraph()
    const finalState = await graph.invoke(
      { runId: 'run-1', sessionId: 'session-1', workspaceId: 'WS-1' },
      // The refine loop (3 passes at maxIterations=2) plus synthesis steps exceeds
      // LangGraph's default 25-step recursion limit, which is unrelated to our own
      // budget-based cap -- runManager.ts must set this generously in production too.
      { configurable: { client, tools: TOOLS, limits: GENEROUS_LIMITS }, recursionLimit: 100 },
    )

    expect(finalState.status).toBe('succeeded')
    expect(finalState.budget.iterationCount).toBe(GENEROUS_LIMITS.maxIterations)
    expect(typeof finalState.markdown).toBe('string')
    expect(finalState.markdown).toContain('Matter Knowledge File: Acme Matter')
    expect(finalState.markdown).toContain('## 14. Evidence and Source References')

    // Bounded, not runaway: planSearches + assessCoverage run once per pass (3
    // passes: iterations 0,1,2) = 6, plus buildOutline + one writeMarkdown call
    // per section (14) + at most 2 validateCitations repairs = at most 23.
    expect(invoke.mock.calls.length).toBeLessThanOrEqual(23)
  })
})
