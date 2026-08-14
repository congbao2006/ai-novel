export class DataAccessError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "DataAccessError";
  }
}

export class NotFoundError extends DataAccessError {
  constructor(resource: string, cause?: unknown) {
    super(`${resource} was not found.`, cause);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DataAccessError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "ConflictError";
  }
}

export class StateVersionConflictError extends ConflictError {
  constructor(
    readonly sessionId: string,
    readonly expectedVersion: number
  ) {
    super(
      `Game state version conflict for session ${sessionId}; expected version ${expectedVersion}.`
    );
    this.name = "StateVersionConflictError";
  }
}

export class ValidationError extends DataAccessError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "ValidationError";
  }
}
