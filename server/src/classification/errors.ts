export class DecisionsConfigError extends Error {
  constructor(message = 'The Azure OpenAI Decisions API is not configured (missing endpoint, API key, or gpt-6-luna deployment name).') {
    super(message)
    this.name = 'DecisionsConfigError'
  }
}

export class DecisionsDeploymentUnavailableError extends Error {
  constructor(message = 'The configured gpt-6-luna Decisions deployment was not found.') {
    super(message)
    this.name = 'DecisionsDeploymentUnavailableError'
  }
}

export class DecisionsRateLimitedError extends Error {
  constructor(message = 'Azure OpenAI Decisions API rate limit exceeded.') {
    super(message)
    this.name = 'DecisionsRateLimitedError'
  }
}

export class DecisionsRequestError extends Error {
  constructor(message = 'Azure OpenAI Decisions API request failed.') {
    super(message)
    this.name = 'DecisionsRequestError'
  }
}

/** A classification job for this exact Matter is already in flight. */
export class ClassificationInProgressError extends Error {
  constructor(message = 'Classification is already in progress for this Matter Knowledge File.') {
    super(message)
    this.name = 'ClassificationInProgressError'
  }
}
