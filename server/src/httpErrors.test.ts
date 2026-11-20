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
import { LlmConfigError, LlmDeploymentUnavailableError, LlmRateLimitedError, LlmRequestError } from './llm/errors.js'
import { RunAlreadyInProgressError, RunNotFoundError, RunNotReadyError } from './matterResearch/errors.js'

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

  it('maps RunNotFoundError to 404', () => {
    expect(classifyError(new RunNotFoundError())).toMatchObject({ status: 404, code: 'not_found' })
  })

  it('maps RunAlreadyInProgressError to 409', () => {
    expect(classifyError(new RunAlreadyInProgressError('run-1'))).toMatchObject({
      status: 409,
      code: 'run_in_progress',
    })
  })

  it('maps RunNotReadyError to 409', () => {
    expect(classifyError(new RunNotReadyError())).toMatchObject({ status: 409, code: 'run_not_ready' })
  })

  it('maps LlmConfigError to 502', () => {
    expect(classifyError(new LlmConfigError())).toMatchObject({ status: 502, code: 'llm_config_error' })
  })

  it('maps LlmDeploymentUnavailableError to 503', () => {
    expect(classifyError(new LlmDeploymentUnavailableError())).toMatchObject({
      status: 503,
      code: 'llm_deployment_unavailable',
    })
  })

  it('maps LlmRateLimitedError to 429', () => {
    expect(classifyError(new LlmRateLimitedError())).toMatchObject({ status: 429, code: 'llm_rate_limited' })
  })

  it('maps LlmRequestError to 502', () => {
    expect(classifyError(new LlmRequestError())).toMatchObject({ status: 502, code: 'llm_request_error' })
  })

  it('falls back to 500 internal_error for unknown errors', () => {
    expect(classifyError(new Error('boom'))).toMatchObject({ status: 500, code: 'internal_error', message: 'boom' })
    expect(classifyError('not an Error')).toMatchObject({ status: 500, code: 'internal_error' })
  })
})
