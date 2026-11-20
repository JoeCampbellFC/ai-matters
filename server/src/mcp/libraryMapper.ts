import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { extractToolPayload } from './workspaceMapper.js'

export const LibrarySchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type Library = z.infer<typeof LibrarySchema>

const ID_KEYS = ['id', 'library_id', 'libraryId', 'database_id']
const NAME_KEYS = ['name', 'library_name', 'libraryName', 'title']

function firstString(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return undefined
}

function extractRecordList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    for (const key of ['libraries', 'results', 'items', 'data']) {
      const value = record[key]
      if (Array.isArray(value)) return value
    }
  }
  return []
}

export function mapToolResultToLibraries(result: CallToolResult): Library[] {
  const payload = extractToolPayload(result)
  const list = extractRecordList(payload)
  const libraries: Library[] = []
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const id = firstString(record, ID_KEYS)
    const name = firstString(record, NAME_KEYS)
    if (id && name) libraries.push({ id, name })
  }
  return libraries
}
