import { describe, expect, it } from 'vitest'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { buildRecentWorkspacesArgs, buildSearchWorkspacesArgs } from './tools.js'
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
