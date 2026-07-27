import type { z } from "zod";

import { CodexPersistenceError } from "../errors.js";

/** Serialize flexible metadata and assertion values for SQLite storage. */
export function serializeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (cause) {
    throw new CodexPersistenceError(
      "Codex JSON value could not be serialized.",
      {
        cause: cause instanceof Error ? cause.message : String(cause)
      }
    );
  }
}

/** Parse and validate JSON stored in SQLite. */
export function parseJson<T>(value: string, schema: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (cause) {
    throw new CodexPersistenceError("Codex JSON value could not be parsed.", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new CodexPersistenceError(
      "Codex JSON value failed schema validation.",
      {
        issues: result.error.issues
      }
    );
  }

  return result.data;
}
