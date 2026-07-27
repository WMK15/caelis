import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { ValidationError } from "@caelis/core";
import pino from "pino";

/** Successful or failed operation result without exceptions. */
export type Result<T, E = Error> =
  { ok: true; value: T } | { ok: false; error: E };

/** Create a successful result value. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Create a failed result value. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Enforce exhaustive checks for discriminated unions. */
export function assertNever(value: never): never {
  throw new ValidationError("Unhandled discriminated union member.", { value });
}

/** Compute SHA-256 for a buffer or string. */
export function sha256(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Normalize a path for stable cross-platform display and keys. */
export function normalizePath(input: string): string {
  return input.split(path.sep).join("/");
}

/** Read and parse a JSON file with actionable parse errors. */
export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");

  try {
    return JSON.parse(content) as T;
  } catch (cause) {
    throw new ValidationError("JSON file could not be parsed.", {
      filePath,
      cause: cause instanceof Error ? cause.message : String(cause)
    });
  }
}

/** Read a file and return its SHA-256 hash. */
export async function hashFile(filePath: string): Promise<string> {
  return sha256(await readFile(filePath));
}

/** Shared structured logger used by Caelis packages. */
export const logger = pino({
  name: "caelis",
  level: process.env.CAELIS_LOG_LEVEL ?? "info"
});

/** Create a child logger for a package or subsystem. */
export function createLogger(component: string): pino.Logger {
  return logger.child({ component });
}
