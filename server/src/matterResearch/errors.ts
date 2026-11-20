export class RunNotFoundError extends Error {
  constructor(message = 'Research run not found.') {
    super(message)
    this.name = 'RunNotFoundError'
  }
}

export class RunAlreadyInProgressError extends Error {
  constructor(
    public readonly runId: string,
    message = 'A research run is already in progress for this workspace.',
  ) {
    super(message)
    this.name = 'RunAlreadyInProgressError'
  }
}

export class RunNotReadyError extends Error {
  constructor(message = 'This research run has not produced a result yet.') {
    super(message)
    this.name = 'RunNotReadyError'
  }
}
