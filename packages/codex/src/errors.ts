/** Base class for typed Codex errors. */
export class CodexError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class CodexConnectionError extends CodexError {
  public constructor(
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message, "CODEX_CONNECTION_ERROR", details);
  }
}

export class CodexMigrationError extends CodexError {
  public constructor(
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message, "CODEX_MIGRATION_ERROR", details);
  }
}

export class CodexNotFoundError extends CodexError {
  public constructor(
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message, "CODEX_NOT_FOUND", details);
  }
}

export class CodexConflictError extends CodexError {
  public constructor(
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message, "CODEX_CONFLICT", details);
  }
}

export class CodexPersistenceError extends CodexError {
  public constructor(
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message, "CODEX_PERSISTENCE_ERROR", details);
  }
}

export class CodexSearchError extends CodexError {
  public constructor(
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message, "CODEX_SEARCH_ERROR", details);
  }
}
