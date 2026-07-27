import { randomUUID } from "node:crypto";

/** Generate a collision-resistant Codex ID. */
export function createCodexId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

/** Current Unix millisecond timestamp. */
export function nowMs(): number {
  return Date.now();
}

/** Normalize aliases for consistent lookup. */
export function normalizeAlias(alias: string): string {
  return alias.trim().toLocaleLowerCase().replaceAll(/\s+/g, " ");
}

/** Convert optional null database values to exact optional fields. */
export function optional<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}
