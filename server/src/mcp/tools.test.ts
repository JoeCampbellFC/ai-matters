import { describe, expect, it } from 'vitest'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import {
  buildFetchArgs,
  buildGetContainerChildrenArgs,
  buildGetDocumentProfileArgs,
  buildGetWorkspaceProfileArgs,
  buildGlobalSearchArgs,
  buildRecentWorkspacesArgs,
  buildSearchFoldersArgs,
  buildSearchWorkspacesArgs,
  scopedSearchQuery,
} from './tools.js'
import { UnsupportedSearchInputError } from './errors.js'

function tool(overrides: Partial<Tool>): Tool {
  return {
    name: 'search_workspaces',
    inputSchema: { type: 'object', properties: {}, required: [] },
    ...overrides,
  } as Tool
}

describe('buildSearchWorkspacesArgs', () => {
  it('maps the query onto a "criteria" parameter when that is what the schema declares', () => {
    const t = tool({ inputSchema: { type: 'object', properties: { criteria: { type: 'string' } } } })
    expect(buildSearchWorkspacesArgs(t, { query: 'acme' })).toEqual({ criteria: 'acme' })
  })

  it('prefers "query" over other candidates when both are present', () => {
    const t = tool({
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, workspace_name: { type: 'string' } } },
    })
    expect(buildSearchWorkspacesArgs(t, { query: 'acme' })).toEqual({ query: 'acme' })
  })

  it('includes a library filter only when the schema exposes a library parameter', () => {
    const t = tool({
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, library_id: { type: 'string' } } },
    })
    expect(buildSearchWorkspacesArgs(t, { query: 'acme', libraryId: 'LIB1' })).toEqual({
      query: 'acme',
      library_id: 'LIB1',
    })
  })

  it('does not add a library filter the schema does not support', () => {
    const t = tool({ inputSchema: { type: 'object', properties: { query: { type: 'string' } } } })
    expect(buildSearchWorkspacesArgs(t, { query: 'acme', libraryId: 'LIB1' })).toEqual({ query: 'acme' })
  })

  it('falls back to a required string field when no recognizable name matches', () => {
    const t = tool({
      inputSchema: { type: 'object', properties: { term: { type: 'string' } }, required: ['term'] },
    })
    expect(buildSearchWorkspacesArgs(t, { query: 'acme' })).toEqual({ term: 'acme' })
  })

  it('throws a clear error instead of inventing a parameter name', () => {
    const t = tool({ inputSchema: { type: 'object', properties: { unrelated: { type: 'number' } } } })
    expect(() => buildSearchWorkspacesArgs(t, { query: 'acme' })).toThrow(UnsupportedSearchInputError)
  })

  it('maps onto a nested field inside a required object parameter (e.g. iManage searchParams)', () => {
    const t = tool({
      inputSchema: {
        type: 'object',
        properties: {
          searchParams: {
            type: 'object',
            properties: { name: { type: 'string' }, anywhere: { type: 'string' } },
          },
        },
        required: ['searchParams'],
      },
    })
    expect(buildSearchWorkspacesArgs(t, { query: 'acme' })).toEqual({ searchParams: { anywhere: 'acme' } })
  })

  it('includes a library filter nested inside the required object parameter when present', () => {
    const t = tool({
      inputSchema: {
        type: 'object',
        properties: {
          searchParams: {
            type: 'object',
            properties: { anywhere: { type: 'string' }, library_id: { type: 'string' } },
          },
        },
        required: ['searchParams'],
      },
    })
    expect(buildSearchWorkspacesArgs(t, { query: 'acme', libraryId: 'LIB1' })).toEqual({
      searchParams: { anywhere: 'acme', library_id: 'LIB1' },
    })
  })
})

describe('buildRecentWorkspacesArgs', () => {
  it('calls with no arguments when nothing is required', () => {
    const t = tool({ name: 'get_recent_workspaces', inputSchema: { type: 'object', properties: {} } })
    expect(buildRecentWorkspacesArgs(t, {})).toEqual({})
  })

  it('throws when the schema requires a parameter AI Matters does not support', () => {
    const t = tool({
      name: 'get_recent_workspaces',
      inputSchema: { type: 'object', properties: { activity_type: { type: 'string' } }, required: ['activity_type'] },
    })
    expect(() => buildRecentWorkspacesArgs(t, {})).toThrow(UnsupportedSearchInputError)
  })
})

describe('buildGetWorkspaceProfileArgs', () => {
  it('maps the workspace id onto the discovered parameter', () => {
    const t = tool({
      name: 'get_workspace_profile',
      inputSchema: { type: 'object', properties: { workspace_id: { type: 'string' } } },
    })
    expect(buildGetWorkspaceProfileArgs(t, { workspaceId: 'WS-1' })).toEqual({ workspace_id: 'WS-1' })
  })
})

describe('buildGetContainerChildrenArgs', () => {
  it('maps container id and type onto the discovered flat parameters', () => {
    const t = tool({
      name: 'get_container_children',
      inputSchema: {
        type: 'object',
        properties: { container_id: { type: 'string' }, container_type: { type: 'string' } },
      },
    })
    expect(buildGetContainerChildrenArgs(t, { containerId: 'WS-1', containerType: 'workspace' })).toEqual({
      container_id: 'WS-1',
      container_type: 'workspace',
    })
  })

  it('throws when the schema has no recognizable container_type parameter', () => {
    const t = tool({
      name: 'get_container_children',
      inputSchema: { type: 'object', properties: { container_id: { type: 'string' } } },
    })
    expect(() => buildGetContainerChildrenArgs(t, { containerId: 'WS-1', containerType: 'workspace' })).toThrow(
      UnsupportedSearchInputError,
    )
  })

  it('includes cursor and a capped limit when the schema supports pagination', () => {
    const t = tool({
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
    })
    expect(
      buildGetContainerChildrenArgs(t, { containerId: 'FOLDER-1', containerType: 'folder', cursor: 'abc', limit: 500 }),
    ).toEqual({ container_id: 'FOLDER-1', container_type: 'folder', cursor: 'abc', limit: 100 })
  })

  it('coerces the cursor to a number when the schema declares a numeric cursor (e.g. iManage)', () => {
    const t = tool({
      name: 'get_container_children',
      inputSchema: {
        type: 'object',
        properties: {
          container_id: { type: 'string' },
          container_type: { type: 'string' },
          cursor: { type: 'number' },
        },
      },
    })
    expect(buildGetContainerChildrenArgs(t, { containerId: 'FOLDER-1', containerType: 'folder', cursor: '2' })).toEqual(
      { container_id: 'FOLDER-1', container_type: 'folder', cursor: 2 },
    )
  })
})

describe('buildGlobalSearchArgs', () => {
  it('maps the query onto the discovered parameter', () => {
    const t = tool({ name: 'search', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } })
    expect(buildGlobalSearchArgs(t, { query: 'engagement letter' })).toEqual({ query: 'engagement letter' })
  })

  it('throws when the schema has no recognizable query parameter', () => {
    const t = tool({ name: 'search', inputSchema: { type: 'object', properties: {} } })
    expect(() => buildGlobalSearchArgs(t, { query: 'x' })).toThrow(UnsupportedSearchInputError)
  })
})

describe('buildSearchFoldersArgs', () => {
  it('maps workspace scope and query onto the discovered flat parameters', () => {
    const t = tool({
      name: 'search_folders',
      inputSchema: { type: 'object', properties: { workspace_id: { type: 'string' }, name: { type: 'string' } } },
    })
    expect(buildSearchFoldersArgs(t, { workspaceId: 'WS-1', query: 'Correspondence' })).toEqual({
      workspace_id: 'WS-1',
      name: 'Correspondence',
    })
  })
})

describe('buildGetDocumentProfileArgs / buildFetchArgs', () => {
  it('map the document id onto the discovered parameter', () => {
    const t = tool({
      name: 'get_document_profile',
      inputSchema: { type: 'object', properties: { document_id: { type: 'string' } } },
    })
    expect(buildGetDocumentProfileArgs(t, { documentId: 'DOC-1' })).toEqual({ document_id: 'DOC-1' })
    expect(buildFetchArgs(t, { documentId: 'DOC-1' })).toEqual({ document_id: 'DOC-1' })
  })
})

describe('scopedSearchQuery', () => {
  it('embeds both client and matter identifiers when both are present', () => {
    const workspace = { raw: { custom1: '3456', custom2: '7659' } }
    expect(scopedSearchQuery(workspace, 'arbitration-related documents')).toBe(
      'Search client 3456, matter 7659 for arbitration-related documents',
    )
  })

  it('embeds only the client identifier when matter is absent', () => {
    const workspace = { raw: { custom1: '3456' } }
    expect(scopedSearchQuery(workspace, 'q')).toBe('Search client 3456 for q')
  })

  it('embeds only the matter identifier when client is absent', () => {
    const workspace = { raw: { custom2: '7659' } }
    expect(scopedSearchQuery(workspace, 'q')).toBe('Search matter 7659 for q')
  })

  it('returns the query unchanged when neither identifier nor a workspace is present', () => {
    expect(scopedSearchQuery({ raw: {} }, 'q')).toBe('q')
    expect(scopedSearchQuery(undefined, 'q')).toBe('q')
  })

  it('ignores blank/whitespace-only raw fields', () => {
    const workspace = { raw: { custom1: '   ', custom2: 7659 } }
    expect(scopedSearchQuery(workspace, 'q')).toBe('q')
  })
})
