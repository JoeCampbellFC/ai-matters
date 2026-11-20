export class LlmConfigError extends Error {
  constructor(message = 'Azure OpenAI is not configured (missing endpoint, API key, or deployment name).') {
    super(message)
    this.name = 'LlmConfigError'
  }
}

export class LlmDeploymentUnavailableError extends Error {
  constructor(message = 'The configured Azure OpenAI deployment was not found.') {
    super(message)
    this.name = 'LlmDeploymentUnavailableError'
  }
}

export class LlmRateLimitedError extends Error {
  constructor(message = 'Azure OpenAI rate limit exceeded.') {
    super(message)
    this.name = 'LlmRateLimitedError'
  }
}

export class LlmRequestError extends Error {
  constructor(message = 'Azure OpenAI request failed.') {
    super(message)
    this.name = 'LlmRequestError'
  }
}
