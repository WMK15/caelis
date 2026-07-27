import type Database from "better-sqlite3";

/** Apply required SQLite runtime settings for Codex. */
export function applyCodexPragmas(database: Database.Database): void {
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.pragma("synchronous = NORMAL");
}
