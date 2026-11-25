import { describe, expect, it, vi } from 'vitest'
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { BudgetLimits } from '../../budget.js'
import { initialBudget } from '../../budget.js'
import type { ResearchState } from '../state.js'
import { loadWorkspaceDocumentIds } from './loadWorkspaceDocumentIds.js'
import type { NodeConfig } from './shared.js'

const CONTAINER_CHILDREN_TOOL: Tool = {
  name: 'get_container_children',
  inputSchema: {
    type: 'object',
    properties: {
      container_id: { type: 'string' },
      container_type: { type: 'string' },
      cursor: { type: 'string' },
      limit: { type: 'number' },
    },
  },
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
    stage: 'initializing',
    warnings: [],
    ...overrides,
  }
}

function config(
  callTool: (args: { name: string; arguments: Record<string, unknown> }) => Promise<CallToolResult>,
  limits: BudgetLimits = GENEROUS_LIMITS,
  events: unknown[] = [],
): NodeConfig {
  const client = { callTool } as unknown as Client
  return {
    configurable: { client, tools: [CONTAINER_CHILDREN_TOOL], limits },
    writer: (chunk) => events.push(chunk),
  }
}

function result(payload: Record<string, unknown>): CallToolResult {
  return { content: [], structuredContent: payload }
}

describe('loadWorkspaceDocumentIds', () => {
  it('collects documents and emails, recurses into folders and tabs, skips everything else', async () => {
    const callTool = vi.fn(async ({ arguments: args }: { name: string; arguments: Record<string, unknown> }) => {
      if (args.container_id === 'WS-1') {
        return result({
          children: [
            { id: 'DOC-1', type: 'document' },
            { id: 'EMAIL-1', type: 'email' },
            { id: 'FOLDER-1', name: 'Correspondence', type: 'folder' },
            { id: 'TAB-1', name: 'Documents', type: 'tab' },
            { id: 'WS-1', type: 'workspace' },
            { id: 'SHORTCUT-1', type: 'shortcut' },
            { id: 'UNKNOWN-1', type: 'mystery' },
          ],
        })
      }
      if (args.container_id === 'FOLDER-1') {
        return result({ children: [{ id: 'DOC-2', type: 'document' }] })
      }
      if (args.container_id === 'TAB-1') {
        return result({ children: [{ id: 'DOC-3', type: 'document' }] })
      }
      throw new Error(`unexpected container ${args.container_id as string}`)
    })

    const events: unknown[] = []
    const update = await loadWorkspaceDocumentIds(state(), config(callTool, GENEROUS_LIMITS, events))

    expect(update.workspaceDocumentIds).toEqual(new Set(['DOC-1', 'EMAIL-1', 'DOC-2', 'DOC-3']))
    expect(update.workspaceDocumentIdsComplete).toBe(true)
    expect(callTool).toHaveBeenCalledTimes(3)

    // One progress line per MCP call, visible live rather than only before/after the whole walk.
    const progressMessages = events.filter(
      (e): e is { type: string; message: string } => typeof e === 'object' && e !== null && (e as { type?: string }).type === 'activity',
    )
    expect(progressMessages.filter((e) => e.message.includes('found so far')).length).toBe(3)

    // One structured event per container (not per page), driving the UI's single-line "currently scanning" indicator.
    const folderEvents = events.filter(
      (e): e is { type: string; folderName: string } => typeof e === 'object' && e !== null && (e as { type?: string }).type === 'workspace_folder_scanning',
    )
    expect(folderEvents.map((e) => e.folderName)).toEqual(['WS-1', 'Correspondence', 'Documents'])
  })

  it('follows cursor-based pagination within a single container', async () => {
    const callTool = vi.fn(async ({ arguments: args }: { name: string; arguments: Record<string, unknown> }) => {
      if (args.cursor === undefined) {
        return result({ children: [{ id: 'DOC-1', type: 'document' }], next_cursor: 'page-2' })
      }
      expect(args.cursor).toBe('page-2')
      return result({ children: [{ id: 'DOC-2', type: 'document' }] })
    })

    const update = await loadWorkspaceDocumentIds(state(), config(callTool))

    expect(update.workspaceDocumentIds).toEqual(new Set(['DOC-1', 'DOC-2']))
    expect(update.workspaceDocumentIdsComplete).toBe(true)
    expect(callTool).toHaveBeenCalledTimes(2)
  })

  it('stops paginating a container once a page comes back empty, even if the server still claims a next cursor', async () => {
    // Observed live: a real tenant's get_container_children kept returning an empty
    // children array alongside a seemingly-valid next_cursor forever once a
    // container was actually exhausted -- this must not loop until the budget cap.
    const callTool = vi.fn(async ({ arguments: args }: { name: string; arguments: Record<string, unknown> }) => {
      if (args.cursor === undefined) {
        return result({ children: [{ id: 'DOC-1', type: 'document' }], next_cursor: 'page-2' })
      }
      return result({ children: [], next_cursor: 'page-3' })
    })

    const update = await loadWorkspaceDocumentIds(state(), config(callTool))

    expect(update.workspaceDocumentIds).toEqual(new Set(['DOC-1']))
    expect(update.workspaceDocumentIdsComplete).toBe(true)
    expect(callTool).toHaveBeenCalledTimes(2)
  })

  it('stops paginating a container once the returned cursor repeats the one just requested', async () => {
    // First response legitimately advances (undefined -> 'same-cursor'); the second
    // response echoing that same value back is the non-advancing signal to catch.
    const callTool = vi.fn(async () => result({ children: [{ id: 'DOC-1', type: 'document' }], next_cursor: 'same-cursor' }))

    const update = await loadWorkspaceDocumentIds(state(), config(callTool))

    expect(update.workspaceDocumentIdsComplete).toBe(true)
    expect(callTool).toHaveBeenCalledTimes(2)
  })

  it('does not revisit the same container twice', async () => {
    const callTool = vi.fn(async ({ arguments: args }: { name: string; arguments: Record<string, unknown> }) => {
      if (args.container_id === 'WS-1') {
        return result({
          children: [
            { id: 'FOLDER-1', type: 'folder' },
            { id: 'FOLDER-1', type: 'folder' },
          ],
        })
      }
      return result({ children: [{ id: 'DOC-1', type: 'document' }] })
    })

    await loadWorkspaceDocumentIds(state(), config(callTool))

    expect(callTool).toHaveBeenCalledTimes(2) // workspace + FOLDER-1 once, not twice
  })

  it('stops early and reports incomplete when the mcp call budget runs out', async () => {
    const callTool = vi.fn(async ({ arguments: args }: { name: string; arguments: Record<string, unknown> }) => {
      if (args.container_id === 'WS-1') {
        return result({ children: [{ id: 'FOLDER-1', type: 'folder' }, { id: 'FOLDER-2', type: 'folder' }] })
      }
      return result({ children: [{ id: `DOC-${args.container_id as string}`, type: 'document' }] })
    })

    const tightLimits: BudgetLimits = { ...GENEROUS_LIMITS, maxMcpCalls: 1 }
    const update = await loadWorkspaceDocumentIds(state({ budget: { ...initialBudget(), mcpCalls: 0 } }), config(callTool, tightLimits))

    expect(update.workspaceDocumentIdsComplete).toBe(false)
    expect(callTool).toHaveBeenCalledTimes(1)
  })

  it('reports incomplete and makes no calls when the MCP server does not expose the tool', async () => {
    const callTool = vi.fn()
    const cfg: NodeConfig = {
      configurable: { client: { callTool } as unknown as Client, tools: [], limits: GENEROUS_LIMITS },
      writer: () => undefined,
    }

    const update = await loadWorkspaceDocumentIds(state(), cfg)

    expect(update.workspaceDocumentIdsComplete).toBe(false)
    expect(update.workspaceDocumentIds).toBeUndefined()
    expect(callTool).not.toHaveBeenCalled()
  })
})
