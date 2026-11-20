import {
  AuthRequiredError,
  McpToolError,
  NotConnectedError,
  PermissionDeniedError,
  ToolUnavailableError,
  UnsupportedSearchInputError,
} from './mcp/errors.js'

export interface ErrorResponseBody {
  error: {
    code: string
    message: string
  }
}

export function classifyError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof NotConnectedError) {
    return { status: 401, code: 'not_connected', message: error.message }
  }
  if (error instanceof AuthRequiredError) {
    return { status: 401, code: 'auth_required', message: error.message }
  }
  if (error instanceof PermissionDeniedError) {
    return { status: 403, code: 'permission_denied', message: error.message }
  }
  if (error instanceof ToolUnavailableError) {
    return { status: 503, code: 'tool_unavailable', message: error.message }
  }
  if (error instanceof UnsupportedSearchInputError) {
    return { status: 422, code: 'unsupported_search_input', message: error.message }
  }
  if (error instanceof McpToolError) {
    return { status: 502, code: 'mcp_tool_error', message: error.message }
  }
  return {
    status: 500,
    code: 'internal_error',
    message: error instanceof Error ? error.message : 'An unexpected error occurred.',
  }
}
