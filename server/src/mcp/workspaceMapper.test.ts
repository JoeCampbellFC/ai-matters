import { describe, expect, it } from 'vitest'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { extractToolPayload, mapToolResultToWorkspaces, normalizeWorkspace } from './workspaceMapper.js'
import { McpToolError } from './errors.js'

function textResult(text: string, overrides: Partial<CallToolResult> = {}): CallToolResult {
  return { content: [{ type: 'text', text }], ...overrides }
}

describe('normalizeWorkspace', () => {
  it('maps common field name variants', () => {
    const workspace = normalizeWorkspace({
      workspace_id: 'WS-1',
      workspace_name: 'Acme v. Globex',
      client_name: 'Acme Corp',
      matter_name: 'General Litigation',
      owner: 'jdoe',
      last_modified: '2026-10-01',
    })

    expect(workspace).toEqual({
      id: 'WS-1',
      name: 'Acme v. Globex',
      client: 'Acme Corp',
      matter: 'General Litigation',
      owner: 'jdoe',
      lastModified: '2026-10-01',
      raw: expect.any(Object),
    })
  })

  it('accepts the alternate id/name aliases', () => {
    const workspace = normalizeWorkspace({ id: 'WS-2', name: 'Beta Matter' })
    expect(workspace?.id).toBe('WS-2')
    expect(workspace?.name).toBe('Beta Matter')
  })

  it('does not invent an id or name when neither is present', () => {
    expect(normalizeWorkspace({ client_name: 'Acme Corp' })).toBeNull()
  })

  it('omits optional fields rather than fabricating values', () => {
    const workspace = normalizeWorkspace({ id: 'WS-3', name: 'No Metadata Matter' })
    expect(workspace).toEqual({
      id: 'WS-3',
      name: 'No Metadata Matter',
      client: undefined,
      matter: undefined,
      owner: undefined,
      lastModified: undefined,
      raw: expect.any(Object),
    })
  })

  it('rejects non-object input', () => {
    expect(normalizeWorkspace('not an object')).toBeNull()
    expect(normalizeWorkspace(null)).toBeNull()
  })
})

describe('extractToolPayload', () => {
  it('prefers structuredContent when present', () => {
    const result: CallToolResult = {
      content: [{ type: 'text', text: 'ignored' }],
      structuredContent: { workspaces: [{ id: '1', name: 'A' }] },
    }
    expect(extractToolPayload(result)).toEqual({ workspaces: [{ id: '1', name: 'A' }] })
  })

  it('parses JSON encoded in a text content block', () => {
    const result = textResult(JSON.stringify({ workspaces: [{ id: '1', name: 'A' }] }))
    expect(extractToolPayload(result)).toEqual({ workspaces: [{ id: '1', name: 'A' }] })
  })

  it('returns raw text when it is not JSON', () => {
    const result = textResult('plain text response')
    expect(extractToolPayload(result)).toBe('plain text response')
  })

  it('throws McpToolError when the tool reports isError', () => {
    const result = textResult('Access denied: tool not enabled for this client', { isError: true })
    expect(() => extractToolPayload(result)).toThrow(McpToolError)
  })
})

describe('mapToolResultToWorkspaces', () => {
  it('unwraps a bare array payload', () => {
    const result: CallToolResult = { content: [], structuredContent: undefined }
    // structuredContent undefined falls back to text parsing; simulate bare array via text
    const arrayResult = textResult(JSON.stringify([{ id: 'WS-1', name: 'One' }]))
    expect(mapToolResultToWorkspaces(arrayResult)).toHaveLength(1)
    expect(mapToolResultToWorkspaces(result)).toHaveLength(0)
  })

  it('unwraps common wrapper keys (workspaces/results/items/data)', () => {
    for (const key of ['workspaces', 'results', 'items', 'data', 'records']) {
      const result: CallToolResult = {
        content: [],
        structuredContent: { [key]: [{ id: 'WS-1', name: 'One' }] },
      }
      expect(mapToolResultToWorkspaces(result)).toHaveLength(1)
    }
  })

  it('silently skips malformed records instead of throwing', () => {
    const result: CallToolResult = {
      content: [],
      structuredContent: { workspaces: [{ id: 'WS-1', name: 'One' }, { client_name: 'No id or name' }] },
    }
    expect(mapToolResultToWorkspaces(result)).toHaveLength(1)
  })
})
