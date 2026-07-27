import { mkdirSync } from "node:fs";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database
} from "drizzle-orm/better-sqlite3";

import { CodexConnectionError } from "../errors.js";
import { applyCodexPragmas } from "./pragmas.js";
import * as schema from "./schema.js";

export type CodexDatabase = BetterSQLite3Database<typeof schema>;

export interface CodexConnection {
  path: string;
  existedWithContent: boolean;
  sqlite: Database.Database;
  db: CodexDatabase;
}

/** Return the local Codex database path for an RPG Maker project root. */
export function getCodexDatabasePath(projectRoot: string): string {
  return path.join(path.resolve(projectRoot), ".caelis", "caelis.sqlite3");
}

/** Open a Codex SQLite connection and apply required pragmas. */
export function openCodexConnection(projectRoot: string): CodexConnection {
  const databasePath = getCodexDatabasePath(projectRoot);
  const existedWithContent =
    existsSync(databasePath) && statSync(databasePath).size > 0;
  mkdirSync(path.dirname(databasePath), { recursive: true });

  try {
    const sqlite = new Database(databasePath);
    applyCodexPragmas(sqlite);
    return {
      path: databasePath,
      existedWithContent,
      sqlite,
      db: drizzle(sqlite, { schema })
    };
  } catch (cause) {
    throw new CodexConnectionError(
      "Codex SQLite database could not be opened.",
      {
        databasePath,
        cause: cause instanceof Error ? cause.message : String(cause)
      }
    );
  }
}
