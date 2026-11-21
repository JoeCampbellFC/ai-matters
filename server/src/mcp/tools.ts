import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { UnsupportedSearchInputError } from './errors.js'

export const SEARCH_WORKSPACES_TOOL = 'search_workspaces'
export const GET_RECENT_WORKSPACES_TOOL = 'get_recent_workspaces'
export const GET_LIBRARIES_TOOL = 'get_libraries'
export const GET_WORKSPACE_PROFILE_TOOL = 'get_workspace_profile'
export const GET_CONTAINER_CHILDREN_TOOL = 'get_container_children'
export const SEARCH_TOOL = 'search'
export const SEARCH_FOLDERS_TOOL = 'search_folders'
export const GET_DOCUMENT_PROFILE_TOOL = 'get_document_profile'
export const FETCH_TOOL = 'fetch'

export const REQUIRED_WORKSPACE_TOOLS = [SEARCH_WORKSPACES_TOOL, GET_RECENT_WORKSPACES_TOOL] as const

export function findTool(tools: Tool[], name: string): Tool | undefined {
  return tools.find((tool) => tool.name === name)
}

interface JsonSchemaProperty {
  type?: string | string[]
  description?: string
  properties?: Record<string, JsonSchemaProperty>
}

function schemaProperties(tool: Tool): Record<string, JsonSchemaProperty> {
  return (tool.inputSchema.properties ?? {}) as Record<string, JsonSchemaProperty>
}

function isStringProperty(prop: JsonSchemaProperty | undefined): boolean {
  if (!prop || prop.type === undefined) return true // untyped/passthrough schema: assume compatible
  return prop.type === 'string' || (Array.isArray(prop.type) && prop.type.includes('string'))
}

function isObjectProperty(prop: JsonSchemaProperty | undefined): boolean {
  if (!prop || prop.type === undefined) return false
  return prop.type === 'object' || (Array.isArray(prop.type) && prop.type.includes('object'))
}

const QUERY_PARAM_CANDIDATES = ['query', 'criteria', 'search', 'anywhere', 'workspace_name', 'name', 'text']
const LIBRARY_PARAM_CANDIDATES = ['library_id', 'libraryId', 'library']

interface ResolvedParam {
  key: string
  /** Set when the key was found nested one level inside a required object parameter. */
  parent?: string
}

/**
 * Finds a candidate parameter name in a tool's schema, either as a top-level
 * property or nested one level inside a required object parameter (e.g.
 * iManage's `searchParams` wrapper). Never invents a name the schema doesn't
 * advertise -- returns undefined if nothing recognizable is found.
 */
function resolveParamKey(tool: Tool, candidates: string[]): ResolvedParam | undefined {
  const properties = schemaProperties(tool)
  const flat = candidates.find((candidate) => candidate in properties)
  if (flat) return { key: flat }

  for (const requiredName of tool.inputSchema.required ?? []) {
    const nestedProperties = properties[requiredName]?.properties
    if (!isObjectProperty(properties[requiredName]) || !nestedProperties) continue
    const nestedKey = candidates.find((candidate) => candidate in nestedProperties)
    if (nestedKey) return { key: nestedKey, parent: requiredName }
  }
  return undefined
}

/**
 * Maps a free-text search term (and optional library filter) onto whichever
 * input parameter the live MCP server's search_workspaces schema actually
 * declares. We never invent a parameter name the schema doesn't advertise.
 *
 * Some MCP servers (e.g. iManage) nest search fields inside a single required
 * object parameter (its `searchParams`) instead of exposing them flat, so a
 * nested required object is checked for a recognizable field too.
 */
export function buildSearchWorkspacesArgs(
  tool: Tool,
  input: { query: string; libraryId?: string },
): Record<string, unknown> {
  const properties = schemaProperties(tool)
  const resolved = resolveParamKey(tool, QUERY_PARAM_CANDIDATES)

  if (resolved) {
    if (resolved.parent) {
      const nestedProperties = properties[resolved.parent]?.properties ?? {}
      const nestedArgs: Record<string, unknown> = { [resolved.key]: input.query }
      const nestedLibraryKey = LIBRARY_PARAM_CANDIDATES.find((candidate) => candidate in nestedProperties)
      if (input.libraryId && nestedLibraryKey) {
        nestedArgs[nestedLibraryKey] = input.libraryId
      }
      return { [resolved.parent]: nestedArgs }
    }
    const args: Record<string, unknown> = { [resolved.key]: input.query }
    return applyLibraryFilter(args, properties, input.libraryId)
  }

  const required = tool.inputSchema.required ?? []
  const fallback = required.find((name) => isStringProperty(properties[name]))
  if (!fallback) {
    throw new UnsupportedSearchInputError(
      `The discovered "${tool.name}" schema does not expose a recognizable search parameter (looked for: ${QUERY_PARAM_CANDIDATES.join(', ')}).`,
    )
  }
  const args: Record<string, unknown> = { [fallback]: input.query }
  return applyLibraryFilter(args, properties, input.libraryId)
}

function applyLibraryFilter(
  args: Record<string, unknown>,
  properties: Record<string, JsonSchemaProperty>,
  libraryId: string | undefined,
): Record<string, unknown> {
  if (!libraryId) return args
  const propertyNames = Object.keys(properties)
  const libraryKey = LIBRARY_PARAM_CANDIDATES.find((candidate) => propertyNames.includes(candidate))
  if (libraryKey) {
    args[libraryKey] = libraryId
  }
  return args
}

/**
 * get_recent_workspaces is documented as taking no required parameters. If a
 * live schema ever requires something we don't understand, surface that
 * clearly instead of guessing a value.
 */
export function buildRecentWorkspacesArgs(tool: Tool, input: { libraryId?: string }): Record<string, unknown> {
  const required = tool.inputSchema.required ?? []
  const properties = schemaProperties(tool)
  const unsupportedRequired = required.filter((name) => !LIBRARY_PARAM_CANDIDATES.includes(name))
  if (unsupportedRequired.length > 0) {
    throw new UnsupportedSearchInputError(
      `The discovered "${tool.name}" schema requires parameters AI Matters does not yet support: ${unsupportedRequired.join(', ')}.`,
    )
  }
  return applyLibraryFilter({}, properties, input.libraryId)
}

const WORKSPACE_ID_CANDIDATES = ['workspace_id', 'workspaceId', 'id']
const CONTAINER_ID_CANDIDATES = ['container_id', 'containerId', 'workspace_id', 'folder_id']
const CONTAINER_TYPE_CANDIDATES = ['container_type', 'containerType']
const DOCUMENT_ID_CANDIDATES = ['document_id', 'documentId', 'id', 'doc_id']
const CURSOR_PARAM_CANDIDATES = ['cursor', 'page_cursor', 'next_cursor']
const LIMIT_PARAM_CANDIDATES = ['limit', 'page_size', 'pageSize']
const GLOBAL_SEARCH_QUERY_CANDIDATES = ['query', 'q', 'text', 'anywhere', 'criteria']
const FOLDER_PARENT_CANDIDATES = ['workspace_id', 'parent_id', 'container_id']
const FOLDER_QUERY_CANDIDATES = ['query', 'name', 'criteria']

/** iManage's documented hard cap on get_container_children results per call. */
const MAX_CONTAINER_PAGE_SIZE = 100

function buildSingleIdArgs(tool: Tool, candidates: string[], value: string, label: string): Record<string, unknown> {
  const resolved = resolveParamKey(tool, candidates)
  if (!resolved) {
    throw new UnsupportedSearchInputError(
      `The discovered "${tool.name}" schema does not expose a recognizable ${label} parameter (looked for: ${candidates.join(', ')}).`,
    )
  }
  return resolved.parent ? { [resolved.parent]: { [resolved.key]: value } } : { [resolved.key]: value }
}

function isNumericType(prop: JsonSchemaProperty | undefined): boolean {
  if (!prop || prop.type === undefined) return false
  const types = Array.isArray(prop.type) ? prop.type : [prop.type]
  return types.includes('number') || types.includes('integer')
}

/** Cursors are opaque per MCP server -- some encode them as strings, others (like iManage) as numbers. */
function coerceCursor(value: string, prop: JsonSchemaProperty | undefined): string | number {
  if (!isNumericType(prop)) return value
  const numeric = Number(value)
  return Number.isNaN(numeric) ? value : numeric
}

function addPaginationFields(
  target: Record<string, unknown>,
  scopeProperties: Record<string, JsonSchemaProperty>,
  input: { cursor?: string; limit?: number },
): void {
  const cursorKey = CURSOR_PARAM_CANDIDATES.find((candidate) => candidate in scopeProperties)
  if (cursorKey && input.cursor !== undefined) {
    target[cursorKey] = coerceCursor(input.cursor, scopeProperties[cursorKey])
  }
  const limitKey = LIMIT_PARAM_CANDIDATES.find((candidate) => candidate in scopeProperties)
  if (limitKey && input.limit !== undefined) target[limitKey] = Math.min(input.limit, MAX_CONTAINER_PAGE_SIZE)
}

export function buildGetWorkspaceProfileArgs(tool: Tool, input: { workspaceId: string }): Record<string, unknown> {
  return buildSingleIdArgs(tool, WORKSPACE_ID_CANDIDATES, input.workspaceId, 'workspace_id')
}

export function buildGetDocumentProfileArgs(tool: Tool, input: { documentId: string }): Record<string, unknown> {
  return buildSingleIdArgs(tool, DOCUMENT_ID_CANDIDATES, input.documentId, 'document_id')
}

export function buildFetchArgs(tool: Tool, input: { documentId: string }): Record<string, unknown> {
  return buildSingleIdArgs(tool, DOCUMENT_ID_CANDIDATES, input.documentId, 'document_id')
}

export function buildGetContainerChildrenArgs(
  tool: Tool,
  input: { containerId: string; containerType: 'workspace' | 'tab' | 'folder'; cursor?: string; limit?: number },
): Record<string, unknown> {
  const resolved = resolveParamKey(tool, CONTAINER_ID_CANDIDATES)
  if (!resolved) {
    throw new UnsupportedSearchInputError(
      `The discovered "${tool.name}" schema does not expose a recognizable container_id parameter (looked for: ${CONTAINER_ID_CANDIDATES.join(', ')}).`,
    )
  }
  const properties = schemaProperties(tool)
  const scopeProperties = resolved.parent ? (properties[resolved.parent]?.properties ?? {}) : properties
  const target: Record<string, unknown> = { [resolved.key]: input.containerId }

  const typeKey = CONTAINER_TYPE_CANDIDATES.find((candidate) => candidate in scopeProperties)
  if (!typeKey) {
    throw new UnsupportedSearchInputError(
      `The discovered "${tool.name}" schema does not expose a recognizable container_type parameter (looked for: ${CONTAINER_TYPE_CANDIDATES.join(', ')}).`,
    )
  }
  target[typeKey] = input.containerType

  addPaginationFields(target, scopeProperties, input)
  return resolved.parent ? { [resolved.parent]: target } : target
}

/**
 * `search` is documented as searching broadly across all of iManage Work with
 * no workspace/container scoping parameter -- results from this tool are
 * unverified leads only (see matterResearch/membership.ts), never trusted as
 * workspace members by construction.
 */
export function buildGlobalSearchArgs(
  tool: Tool,
  input: { query: string; cursor?: string; limit?: number },
): Record<string, unknown> {
  const resolved = resolveParamKey(tool, GLOBAL_SEARCH_QUERY_CANDIDATES)
  if (!resolved) {
    throw new UnsupportedSearchInputError(
      `The discovered "${tool.name}" schema does not expose a recognizable query parameter (looked for: ${GLOBAL_SEARCH_QUERY_CANDIDATES.join(', ')}).`,
    )
  }
  const properties = schemaProperties(tool)
  if (resolved.parent) {
    const scopeProperties = properties[resolved.parent]?.properties ?? {}
    const nested: Record<string, unknown> = { [resolved.key]: input.query }
    addPaginationFields(nested, scopeProperties, input)
    return { [resolved.parent]: nested }
  }
  const args: Record<string, unknown> = { [resolved.key]: input.query }
  addPaginationFields(args, properties, input)
  return args
}

/**
 * search_folders is documented as scoped to a workspace/parent-folder context,
 * unlike the unscoped `search` tool -- both a parent-scope and a query
 * parameter are required for this call to be meaningful.
 */
export function buildSearchFoldersArgs(tool: Tool, input: { workspaceId: string; query: string }): Record<string, unknown> {
  const parentResolved = resolveParamKey(tool, FOLDER_PARENT_CANDIDATES)
  const queryResolved = resolveParamKey(tool, FOLDER_QUERY_CANDIDATES)
  if (!parentResolved || !queryResolved) {
    throw new UnsupportedSearchInputError(
      `The discovered "${tool.name}" schema does not expose recognizable workspace-scope and query parameters.`,
    )
  }

  const args: Record<string, unknown> = {}
  const assign = (resolved: ResolvedParam, value: string) => {
    if (resolved.parent) {
      const existing = (args[resolved.parent] as Record<string, unknown> | undefined) ?? {}
      existing[resolved.key] = value
      args[resolved.parent] = existing
    } else {
      args[resolved.key] = value
    }
  }
  assign(parentResolved, input.workspaceId)
  assign(queryResolved, input.query)
  return args
}
