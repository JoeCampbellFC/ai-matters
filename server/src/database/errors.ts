/** No persisted Matter exists for this workspace yet (and the caller required one to already exist). */
export class MatterNotFoundError extends Error {
  constructor(message = 'No Matter record exists yet for this workspace.') {
    super(message)
    this.name = 'MatterNotFoundError'
  }
}

/** Optimistic-concurrency conflict: the caller's expected `version` no longer matches the current row. */
export class ConcurrencyConflictError extends Error {
  constructor(message = 'This field was changed by someone else since you loaded it. Reload and try again.') {
    super(message)
    this.name = 'ConcurrencyConflictError'
  }
}

/** The Markdown version a save/reclassify was based on is no longer the matter's current version. */
export class StaleMarkdownVersionError extends Error {
  constructor(message = 'This Matter Knowledge File was updated by someone else since you loaded it. Reload and try again.') {
    super(message)
    this.name = 'StaleMarkdownVersionError'
  }
}

/** No Markdown has ever been published for this matter -- classification/edit/restore all require one. */
export class MarkdownNotPublishedError extends Error {
  constructor(message = 'No Matter Knowledge File has been published yet for this workspace.') {
    super(message)
    this.name = 'MarkdownNotPublishedError'
  }
}
