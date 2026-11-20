import { describe, expect, it } from 'vitest'
import { classifyError } from './httpErrors.js'
import {
  AuthRequiredError,
  McpToolError,
  NotConnectedError,
  PermissionDeniedError,
  ToolUnavailableError,
  UnsupportedSearchInputError,
} from './mcp/errors.js'

describe('classifyError', () => {
  it('maps NotConnectedError to 401 not_connected', () => {
    expect(classifyError(new NotConnectedError())).toMatchObject({ status: 401, code: 'not_connected' })
  })

  it('maps AuthRequiredError to 401 auth_required', () => {
    expect(classifyError(new AuthRequiredError())).toMatchObject({ status: 401, code: 'auth_required' })
  })

  it('maps PermissionDeniedError to 403 permission_denied', () => {
    expect(classifyError(new PermissionDeniedError())).toMatchObject({ status: 403, code: 'permission_denied' })
  })

  it('maps ToolUnavailableError to 503 tool_unavailable', () => {
    expect(classifyError(new ToolUnavailableError('search_workspaces'))).toMatchObject({
      status: 503,
      code: 'tool_unavailable',
    })
  })

  it('maps UnsupportedSearchInputError to 422', () => {
    expect(classifyError(new UnsupportedSearchInputError('nope'))).toMatchObject({
      status: 422,
      code: 'unsupported_search_input',
    })
  })

  it('maps McpToolError to 502', () => {
    expect(classifyError(new McpToolError('boom'))).toMatchObject({ status: 502, code: 'mcp_tool_error' })
  })

  it('falls back to 500 internal_error for unknown errors', () => {
    expect(classifyError(new Error('boom'))).toMatchObject({ status: 500, code: 'internal_error', message: 'boom' })
    expect(classifyError('not an Error')).toMatchObject({ status: 500, code: 'internal_error' })
  })
})
