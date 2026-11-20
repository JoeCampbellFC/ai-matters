export class NotConnectedError extends Error {
  constructor(message = 'Not connected to iManage Work.') {
    super(message)
    this.name = 'NotConnectedError'
  }
}

export class AuthRequiredError extends Error {
  constructor(message = 'iManage authentication is required.') {
    super(message)
    this.name = 'AuthRequiredError'
  }
}

export class PermissionDeniedError extends Error {
  constructor(message = 'The authenticated user or client is not permitted to use this tool.') {
    super(message)
    this.name = 'PermissionDeniedError'
  }
}

export class ToolUnavailableError extends Error {
  constructor(toolName: string) {
    super(
      `The "${toolName}" tool is not available for this MCP connection. An administrator may need to enable it in iManage Control Center.`,
    )
    this.name = 'ToolUnavailableError'
  }
}

export class UnsupportedSearchInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedSearchInputError'
  }
}

export class McpToolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'McpToolError'
  }
}
