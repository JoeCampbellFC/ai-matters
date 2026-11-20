import { describe, expect, it } from 'vitest'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { mapToolResultToLibraries } from './libraryMapper.js'

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
}

describe('mapToolResultToLibraries', () => {
  it('maps library records and skips malformed ones', () => {
    const result = textResult(
      JSON.stringify({
        libraries: [
          { library_id: 'LIB1', library_name: 'US Library' },
          { name: 'Missing id' },
        ],
      }),
    )
    expect(mapToolResultToLibraries(result)).toEqual([{ id: 'LIB1', name: 'US Library' }])
  })

  it('unwraps a bare array payload', () => {
    const result = textResult(JSON.stringify([{ id: 'LIB2', name: 'EU Library' }]))
    expect(mapToolResultToLibraries(result)).toEqual([{ id: 'LIB2', name: 'EU Library' }])
  })
})
