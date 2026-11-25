import { describe, expect, it } from 'vitest'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  FETCH_CHAR_LIMIT,
  mapToolResultToContainerChildren,
  mapToolResultToDocumentProfile,
  mapToolResultToFetchedDocument,
  mapToolResultToSearchHits,
} from './matterMapper.js'

function structuredResult(structuredContent: Record<string, unknown>): CallToolResult {
  return { content: [], structuredContent }
}

describe('mapToolResultToContainerChildren', () => {
  it('maps mixed item types and skips records without an id', () => {
    const result = structuredResult({
      children: [
        { id: 'DOC-1', name: 'Engagement Letter.pdf', type: 'document' },
        { id: 'FOLDER-1', name: 'Correspondence', type: 'Folder' },
        { id: 'WS-2', name: 'Related Matter', type: 'workspace' },
        { id: 'TAB-1', name: 'Documents', type: 'tab' },
        { id: 'EMAIL-1', name: 'Re: Closing', type: 'email' },
        { id: 'SHORTCUT-1', name: 'Shortcut to X', type: 'shortcut' },
        { id: 'UNKNOWN-1', name: 'Mystery item', type: 'something_else' },
        { name: 'No id at all' },
      ],
    })

    const { children } = mapToolResultToContainerChildren(result)
    expect(children).toHaveLength(7)
    expect(children.map((c) => c.type)).toEqual([
      'document',
      'folder',
      'workspace',
      'tab',
      'email',
      'shortcut',
      'unknown',
    ])
  })

  it('extracts a pagination cursor when present', () => {
    const result = structuredResult({ children: [], next_cursor: 'abc123' })
    expect(mapToolResultToContainerChildren(result).nextCursor).toBe('abc123')
  })

  it('omits the cursor when the payload has none', () => {
    const result = structuredResult({ children: [] })
    expect(mapToolResultToContainerChildren(result).nextCursor).toBeUndefined()
  })

  it('extracts a numeric cursor', () => {
    const result = structuredResult({ children: [], next_cursor: 7 })
    expect(mapToolResultToContainerChildren(result).nextCursor).toBe('7')
  })

  it('treats a numeric cursor of 0 as "no more pages", not a real cursor', () => {
    const result = structuredResult({ children: [], next_cursor: 0 })
    expect(mapToolResultToContainerChildren(result).nextCursor).toBeUndefined()
  })

  it('treats a negative numeric cursor as "no more pages"', () => {
    const result = structuredResult({ children: [], next_cursor: -1 })
    expect(mapToolResultToContainerChildren(result).nextCursor).toBeUndefined()
  })
})

describe('mapToolResultToSearchHits', () => {
  it('unwraps common result wrapper keys', () => {
    for (const key of ['results', 'hits', 'items', 'data', 'documents', 'workspaces']) {
      const result = structuredResult({ [key]: [{ document_id: 'DOC-1', name: 'Hit' }] })
      expect(mapToolResultToSearchHits(result).hits).toHaveLength(1)
    }
  })

  it('leaves documentId undefined rather than inventing one', () => {
    const result = structuredResult({ results: [{ name: 'No id hit' }] })
    expect(mapToolResultToSearchHits(result).hits[0]).toMatchObject({ documentId: undefined, name: 'No id hit' })
  })
})

describe('mapToolResultToDocumentProfile', () => {
  it('maps common field aliases including workspace membership', () => {
    const result = structuredResult({
      document_id: 'DOC-1',
      document_name: 'Share Purchase Agreement.docx',
      workspace_id: 'WS-1',
      doc_type: 'Agreement',
      author_name: 'jdoe',
      edit_date: '2026-01-05',
      version_number: '3',
    })

    expect(mapToolResultToDocumentProfile(result)).toEqual({
      id: 'DOC-1',
      name: 'Share Purchase Agreement.docx',
      workspaceId: 'WS-1',
      docType: 'Agreement',
      author: 'jdoe',
      editDate: '2026-01-05',
      version: '3',
      raw: expect.any(Object),
    })
  })

  it('returns null when no document id can be determined', () => {
    expect(mapToolResultToDocumentProfile(structuredResult({ document_name: 'No id' }))).toBeNull()
  })
})

describe('mapToolResultToFetchedDocument', () => {
  it('reports no truncation for text under the limit', () => {
    const text = 'a'.repeat(FETCH_CHAR_LIMIT - 1)
    const doc = mapToolResultToFetchedDocument(structuredResult({ text }), 'DOC-1')
    expect(doc).toMatchObject({ id: 'DOC-1', charCount: FETCH_CHAR_LIMIT - 1, truncated: false })
  })

  it('flags truncation defensively at exactly the documented character limit', () => {
    const text = 'a'.repeat(FETCH_CHAR_LIMIT)
    const doc = mapToolResultToFetchedDocument(structuredResult({ text }), 'DOC-1')
    expect(doc).toMatchObject({ charCount: FETCH_CHAR_LIMIT, truncated: true })
  })

  it('accepts a bare text payload as well as a wrapped one', () => {
    const result: CallToolResult = { content: [{ type: 'text', text: 'plain body text' }] }
    const doc = mapToolResultToFetchedDocument(result, 'DOC-2')
    expect(doc).toMatchObject({ id: 'DOC-2', text: 'plain body text', truncated: false })
  })
})
