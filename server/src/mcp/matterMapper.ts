import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { extractToolPayload } from './workspaceMapper.js'

export type ContainerItemType = 'document' | 'folder' | 'workspace' | 'tab' | 'email' | 'shortcut' | 'unknown'

/** The container_type values get_container_children actually accepts, per the live MCP schema. */
export type ContainerType = 'workspace' | 'tab' | 'folder'

export interface ContainerChild {
  id: string
  name?: string
  type: ContainerItemType
  raw: Record<string, unknown>
}

export interface SearchHit {
  documentId?: string
  name?: string
  snippet?: string
  raw: Record<string, unknown>
}

export const DocumentProfileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  workspaceId: z.string().optional(),
  docType: z.string().optional(),
  author: z.string().optional(),
  editDate: z.string().optional(),
  version: z.string().optional(),
  raw: z.record(z.string(), z.unknown()),
})
export type DocumentProfile = z.infer<typeof DocumentProfileSchema>

export interface FetchedDocument {
  id: string
  text: string
  charCount: number
  truncated: boolean
}

/** iManage's documented hard character limit for the `fetch` tool, per document/email. */
export const FETCH_CHAR_LIMIT = 1_000_000

const CHILD_ID_KEYS = ['id', 'document_id', 'documentId', 'container_id', 'containerId', 'workspace_id']
const CHILD_NAME_KEYS = ['name', 'title', 'document_name', 'documentName']
const CHILD_TYPE_KEYS = ['type', 'item_type', 'itemType', 'object_type', 'objectType']

const DOCUMENT_ID_KEYS = ['id', 'document_id', 'documentId', 'doc_id']
const DOCUMENT_NAME_KEYS = ['name', 'document_name', 'documentName', 'title']
const WORKSPACE_ID_KEYS = ['workspace_id', 'workspaceId', 'database_id', 'databaseId', 'matter_id', 'container_id']
const DOC_TYPE_KEYS = ['doc_type', 'docType', 'document_class', 'documentClass', 'class']
const AUTHOR_KEYS = ['author', 'author_name', 'authorName']
const EDIT_DATE_KEYS = ['edit_date', 'editDate', 'last_modified', 'lastModified']
const VERSION_KEYS = ['version', 'version_number', 'versionNumber']
const SNIPPET_KEYS = ['snippet', 'summary', 'description', 'excerpt']
const TEXT_KEYS = ['text', 'content', 'body']
const CURSOR_KEYS = ['next_cursor', 'nextCursor', 'cursor']

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) return value
    if (typeof value === 'number') return String(value)
  }
  return undefined
}

function normalizeItemType(value: string | undefined): ContainerItemType {
  switch (value?.toLowerCase()) {
    case 'document':
    case 'folder':
    case 'workspace':
    case 'tab':
    case 'email':
    case 'shortcut':
      return value.toLowerCase() as ContainerItemType
    default:
      return 'unknown'
  }
}

function extractRecordList(payload: unknown, listKeys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    for (const key of listKeys) {
      const value = record[key]
      if (Array.isArray(value)) return value
    }
  }
  return []
}

/**
 * Deliberately NOT built on the shared firstString() helper: a numeric
 * cursor of 0 (or negative) is the conventional "no more pages" sentinel for
 * at least one live MCP server (iManage encodes cursors as numbers, per
 * tools.ts), but firstString() treats any number, including 0, as a valid
 * value. Reusing it here made every "last page" response still look like
 * "there's more" -- get_container_children would re-fetch the same handful
 * of containers forever instead of stopping, since the value we kept
 * extracting and sending back as the next cursor was always 0.
 */
function extractCursor(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const record = payload as Record<string, unknown>
  for (const key of CURSOR_KEYS) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) return value
    if (typeof value === 'number' && value > 0) return String(value)
  }
  return undefined
}

export function mapToolResultToContainerChildren(
  result: CallToolResult,
): { children: ContainerChild[]; nextCursor?: string } {
  const payload = extractToolPayload(result)
  const list = extractRecordList(payload, ['children', 'items', 'results', 'data'])
  const children: ContainerChild[] = []
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const id = firstString(record, CHILD_ID_KEYS)
    if (!id) continue
    children.push({
      id,
      name: firstString(record, CHILD_NAME_KEYS),
      type: normalizeItemType(firstString(record, CHILD_TYPE_KEYS)),
      raw: record,
    })
  }
  return { children, nextCursor: extractCursor(payload) }
}

export function mapToolResultToSearchHits(result: CallToolResult): { hits: SearchHit[]; nextCursor?: string } {
  const payload = extractToolPayload(result)
  const list = extractRecordList(payload, ['results', 'hits', 'items', 'data', 'documents', 'workspaces'])
  const hits: SearchHit[] = []
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    hits.push({
      documentId: firstString(record, DOCUMENT_ID_KEYS),
      name: firstString(record, DOCUMENT_NAME_KEYS),
      snippet: firstString(record, SNIPPET_KEYS),
      raw: record,
    })
  }
  return { hits, nextCursor: extractCursor(payload) }
}

export function mapToolResultToDocumentProfile(result: CallToolResult): DocumentProfile | null {
  const payload = extractToolPayload(result)
  if (typeof payload !== 'object' || payload === null) return null
  const record = payload as Record<string, unknown>
  const id = firstString(record, DOCUMENT_ID_KEYS)
  if (!id) return null
  return {
    id,
    name: firstString(record, DOCUMENT_NAME_KEYS),
    workspaceId: firstString(record, WORKSPACE_ID_KEYS),
    docType: firstString(record, DOC_TYPE_KEYS),
    author: firstString(record, AUTHOR_KEYS),
    editDate: firstString(record, EDIT_DATE_KEYS),
    version: firstString(record, VERSION_KEYS),
    raw: record,
  }
}

/**
 * `truncated` is flagged defensively at >= FETCH_CHAR_LIMIT (not only above it)
 * since a response landing exactly on iManage's documented limit cannot be
 * distinguished from one that was cut off there.
 */
export function mapToolResultToFetchedDocument(result: CallToolResult, documentId: string): FetchedDocument {
  const payload = extractToolPayload(result)
  let text: string
  if (typeof payload === 'string') {
    text = payload
  } else if (typeof payload === 'object' && payload !== null) {
    text = firstString(payload as Record<string, unknown>, TEXT_KEYS) ?? ''
  } else {
    text = ''
  }
  return {
    id: documentId,
    text,
    charCount: text.length,
    truncated: text.length >= FETCH_CHAR_LIMIT,
  }
}
