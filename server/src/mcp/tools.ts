import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { UnsupportedSearchInputError } from './errors.js'

export const SEARCH_WORKSPACES_TOOL = 'search_workspaces'
export const GET_RECENT_WORKSPACES_TOOL = 'get_recent_workspaces'
export const GET_LIBRARIES_TOOL = 'get_libraries'

export const REQUIRED_WORKSPACE_TOOLS = [SEARCH_WORKSPACES_TOOL, GET_RECENT_WORKSPACES_TOOL] as const

export function findTool(tools: Tool[], name: string): Tool | undefined {
  return tools.find((tool) => tool.name === name)
}

interface JsonSchemaProperty {
  type?: string | string[]
  description?: string
}

function schemaProperties(tool: Tool): Record<string, JsonSchemaProperty> {
  return (tool.inputSchema.properties ?? {}) as Record<string, JsonSchemaProperty>
}

function isStringProperty(prop: JsonSchemaProperty | undefined): boolean {
  if (!prop || prop.type === undefined) return true // untyped/passthrough schema: assume compatible
  return prop.type === 'string' || (Array.isArray(prop.type) && prop.type.includes('string'))
}

const QUERY_PARAM_CANDIDATES = ['query', 'criteria', 'search', 'workspace_name', 'name', 'text']
const LIBRARY_PARAM_CANDIDATES = ['library_id', 'libraryId', 'library']

/**
 * Maps a free-text search term (and optional library filter) onto whichever
 * input parameter the live MCP server's search_workspaces schema actually
 * declares. We never invent a parameter name the schema doesn't advertise.
 */
export function buildSearchWorkspacesArgs(
  tool: Tool,
  input: { query: string; libraryId?: string },
): Record<string, unknown> {
  const properties = schemaProperties(tool)
  const propertyNames = Object.keys(properties)

  const queryKey = QUERY_PARAM_CANDIDATES.find((candidate) => propertyNames.includes(candidate))

  if (!queryKey) {
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

  const args: Record<string, unknown> = { [queryKey]: input.query }
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
