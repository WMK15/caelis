/** Absolute path to an RPG Maker project root. */
export type ProjectPath = string;

/** Numeric RPG Maker database or event entity identifier. */
export type EntityId = number;

/** Stable identifier for a planned or applied Caelis change set. */
export type ChangeSetId = string;

/** Supported engine identifiers. */
export type CaelisEngine = "RPG_MAKER_MZ";

/** Basic identity for a project known to Caelis. */
export interface CaelisProject {
  rootPath: ProjectPath;
  name: string;
  engine: CaelisEngine;
}

/** Reference to a file inside a project, optionally including content hash. */
export interface ProjectFileReference {
  relativePath: string;
  sha256?: string;
}

/** Base class for all actionable Caelis errors. */
export class CaelisError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Raised when a path does not contain an RPG Maker MZ project. */
export class ProjectNotFoundError extends CaelisError {
  public constructor(projectRoot: string) {
    super("RPG Maker MZ project was not found.", "PROJECT_NOT_FOUND", {
      projectRoot
    });
  }
}

/** Raised when user input or project data fails validation. */
export class ValidationError extends CaelisError {
  public constructor(
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message, "VALIDATION_ERROR", details);
  }
}

/** Raised when Caelis configuration is missing or invalid. */
export class ConfigurationError extends CaelisError {
  public constructor(
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message, "CONFIGURATION_ERROR", details);
  }
}

/** Raised for intentionally deferred scaffold behavior. */
export class NotImplementedError extends CaelisError {
  public constructor(feature: string) {
    super(
      `${feature} is not implemented in the initial Caelis scaffold.`,
      "NOT_IMPLEMENTED",
      {
        feature
      }
    );
  }
}
