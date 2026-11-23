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

/** No completed, successful Matter Knowledge Markdown exists yet for this workspace. */
export class MarkdownNotReadyError extends Error {
  constructor(message = 'Classification requires a successfully completed Matter Knowledge File; none exists yet for this workspace.') {
    super(message)
    this.name = 'MarkdownNotReadyError'
  }
}

/** No Matter Profile has been classified for this workspace yet. */
export class MatterProfileNotFoundError extends Error {
  constructor(message = 'No Matter Profile exists yet for this workspace.') {
    super(message)
    this.name = 'MatterProfileNotFoundError'
  }
}

/** A classification job for this exact markdown artifact is already in flight. */
export class ClassificationInProgressError extends Error {
  constructor(message = 'Classification is already in progress for this Matter Knowledge File.') {
    super(message)
    this.name = 'ClassificationInProgressError'
  }
}
