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
  if (error instanceof RunNotFoundError) {
    return { status: 404, code: 'not_found', message: error.message }
  }
  if (error instanceof RunAlreadyInProgressError) {
    return { status: 409, code: 'run_in_progress', message: error.message }
  }
  if (error instanceof RunNotReadyError) {
    return { status: 409, code: 'run_not_ready', message: error.message }
  }
  if (error instanceof LlmConfigError) {
    return { status: 502, code: 'llm_config_error', message: error.message }
  }
  if (error instanceof LlmDeploymentUnavailableError) {
    return { status: 503, code: 'llm_deployment_unavailable', message: error.message }
  }
  if (error instanceof LlmRateLimitedError) {
    return { status: 429, code: 'llm_rate_limited', message: error.message }
  }
  if (error instanceof LlmRequestError) {
    return { status: 502, code: 'llm_request_error', message: error.message }
  }
  return {
    status: 500,
    code: 'internal_error',
    message: error instanceof Error ? error.message : 'An unexpected error occurred.',
  }
}
