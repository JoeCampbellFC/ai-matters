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

/** A seeded/built-in row (a default playbook, or a system matter field) cannot be deleted or renamed. */
export class SystemDefaultImmutableError extends Error {
  constructor(message = 'This is a built-in default and cannot be deleted or renamed.') {
    super(message)
    this.name = 'SystemDefaultImmutableError'
  }
}

/** No research skill/playbook exists with the given id or name. */
export class SkillNotFoundError extends Error {
  constructor(message = 'No research playbook exists with that id.') {
    super(message)
    this.name = 'SkillNotFoundError'
  }
}

/** No matter field definition exists with the given id. */
export class FieldDefinitionNotFoundError extends Error {
  constructor(message = 'No matter field definition exists with that id.') {
    super(message)
    this.name = 'FieldDefinitionNotFoundError'
  }
}

/** A business-rule violation on an otherwise well-formed request (e.g. a name/key that's already in use). */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
