import type { Request } from 'express'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const connectionMocks = vi.hoisted(() => ({ getConnection: vi.fn() }))
vi.mock('../mcp/connection.js', () => connectionMocks)

const { listContainerChildren, searchWorkspaceDocuments } = await import('./matterDocumentsService.js')

const CHILDREN_TOOL: Tool = {
  name: 'get_container_children',
  inputSchema: { type: 'object', properties: { container_id: { type: 'string' }, container_type: { type: 'string' }, cursor: { type: 'string' }, limit: { type: 'number' } }, required: ['container_id', 'container_type'] },
}
const SEARCH_TOOL: Tool = {
  name: 'search',
  inputSchema: { type: 'object', properties: { query: { type: 'string' }, cursor: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
}
const PROFILE_TOOL: Tool = {
  name: 'get_document_profile',
  inputSchema: { type: 'object', properties: { document_id: { type: 'string' } }, required: ['document_id'] },
}

function fakeReq(): Request {
  return {} as Request
}

function result(structuredContent: unknown): CallToolResult {
  return { content: [], structuredContent } as unknown as CallToolResult
}

beforeEach(() => {
  connectionMocks.getConnection.mockReset()
})

describe('listContainerChildren', () => {
  it('requests a single page of a container and maps the result', async () => {
    const callTool = vi.fn().mockResolvedValue(
      result({ children: [{ id: 'doc-1', name: 'Agreement.pdf', type: 'document' }], next_cursor: 'page-2' }),
    )
    connectionMocks.getConnection.mockResolvedValue({ client: { callTool }, tools: [CHILDREN_TOOL] })

    const page = await listContainerChildren(fakeReq(), { containerId: 'WS-1', containerType: 'workspace' })

    expect(page.children).toEqual([{ id: 'doc-1', name: 'Agreement.pdf', type: 'document', raw: { id: 'doc-1', name: 'Agreement.pdf', type: 'document' } }])
    expect(page.nextCursor).toBe('page-2')
    expect(callTool).toHaveBeenCalledWith({
      name: 'get_container_children',
      arguments: { container_id: 'WS-1', container_type: 'workspace', limit: 50 },
    })
  })

  it('throws ToolUnavailableError when get_container_children is not exposed', async () => {
    connectionMocks.getConnection.mockResolvedValue({ client: { callTool: vi.fn() }, tools: [] })
    const { ToolUnavailableError } = await import('../mcp/errors.js')

    await expect(listContainerChildren(fakeReq(), { containerId: 'WS-1', containerType: 'workspace' })).rejects.toThrow(ToolUnavailableError)
  })
})

describe('searchWorkspaceDocuments', () => {
  it('scopes the query and drops hits that fail membership verification', async () => {
    const callTool = vi.fn(async (call: { name: string; arguments: Record<string, unknown> }) => {
      if (call.name === 'search') {
        expect(call.arguments.query).toBe('Search client C1, matter M1 for arbitration')
        return result({ results: [{ document_id: 'doc-1', name: 'In scope.pdf' }, { document_id: 'doc-2', name: 'Out of scope.pdf' }] })
      }
      if (call.name === 'get_document_profile') {
        const documentId = call.arguments.document_id
        return result({ id: documentId, workspace_id: documentId === 'doc-1' ? 'WS-1' : 'WS-OTHER' })
      }
      throw new Error(`unexpected tool ${call.name}`)
    })
    connectionMocks.getConnection.mockResolvedValue({ client: { callTool }, tools: [SEARCH_TOOL, PROFILE_TOOL] })

    const workspace = { id: 'WS-1', name: 'Acme', raw: { custom1: 'C1', custom2: 'M1' } }
    const out = await searchWorkspaceDocuments(fakeReq(), { workspaceId: 'WS-1', workspace, query: 'arbitration' })

    expect(out.hits).toEqual([{ documentId: 'doc-1', name: 'In scope.pdf', raw: { document_id: 'doc-1', name: 'In scope.pdf' }, verifiedBy: 'profile_match' }])
    expect(out.excludedCount).toBe(1)
  })

  it('excludes every hit (fails closed) when get_document_profile is unavailable', async () => {
    const callTool = vi.fn().mockResolvedValue(result({ results: [{ document_id: 'doc-1', name: 'Doc.pdf' }] }))
    connectionMocks.getConnection.mockResolvedValue({ client: { callTool }, tools: [SEARCH_TOOL] })

    const workspace = { id: 'WS-1', name: 'Acme', raw: {} }
    const out = await searchWorkspaceDocuments(fakeReq(), { workspaceId: 'WS-1', workspace, query: 'q' })

    expect(out.hits).toEqual([])
    expect(out.excludedCount).toBe(1)
  })

  it('throws ToolUnavailableError when search is not exposed', async () => {
    connectionMocks.getConnection.mockResolvedValue({ client: { callTool: vi.fn() }, tools: [] })
    const { ToolUnavailableError } = await import('../mcp/errors.js')
    const workspace = { id: 'WS-1', name: 'Acme', raw: {} }

    await expect(searchWorkspaceDocuments(fakeReq(), { workspaceId: 'WS-1', workspace, query: 'q' })).rejects.toThrow(ToolUnavailableError)
  })
})
