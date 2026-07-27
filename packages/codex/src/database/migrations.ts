import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { createLogger } from "@caelis/shared";

import { CodexMigrationError } from "../errors.js";
import type { CodexConnection } from "./connection.js";

const log = createLogger("codex:migrations");
const initialMigrationTag = "0000_initial_codex";

/** Run Drizzle migrations, backing up existing databases before schema changes. */
export async function runCodexMigrations(
  connection: CodexConnection
): Promise<void> {
  try {
    log.info({ databasePath: connection.path }, "Starting Codex migrations");
    if (needsMigrationBackup(connection)) {
      const backupPath = await createMigrationBackup(connection);
      log.info({ backupPath }, "Created Codex migration backup");
    }

    migrate(connection.db, { migrationsFolder: resolveMigrationsFolder() });
    log.info({ databasePath: connection.path }, "Completed Codex migrations");
  } catch (cause) {
    throw new CodexMigrationError("Codex migrations failed.", {
      databasePath: connection.path,
      cause: cause instanceof Error ? cause.message : String(cause)
    });
  }
}

/** Create an online SQLite backup under `.caelis/backups`. */
export async function createCodexBackup(
  connection: CodexConnection,
  label = "manual"
): Promise<string> {
  const backupDirectory = path.join(path.dirname(connection.path), "backups");
  mkdirSync(backupDirectory, { recursive: true });
  const backupPath = path.join(
    backupDirectory,
    `caelis-${label}-${safeTimestamp()}.sqlite3`
  );
  await connection.sqlite.backup(backupPath);
  return backupPath;
}

function needsMigrationBackup(connection: CodexConnection): boolean {
  if (
    !connection.existedWithContent ||
    !existsSync(connection.path) ||
    statSync(connection.path).size === 0
  ) {
    return false;
  }

  const migrationRow = connection.sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'"
    )
    .get() as { name: string } | undefined;
  if (!migrationRow) {
    return true;
  }

  const applied = connection.sqlite
    .prepare("SELECT COUNT(*) AS count FROM __drizzle_migrations")
    .get() as { count: number };
  return applied.count === 0 || !hasInitialSchema(connection);
}

function hasInitialSchema(connection: CodexConnection): boolean {
  const row = connection.sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'entities'"
    )
    .get() as { name: string } | undefined;
  return row?.name === "entities";
}

async function createMigrationBackup(
  connection: CodexConnection
): Promise<string> {
  return createCodexBackup(
    connection,
    `before-migration-${initialMigrationTag}`
  );
}

function safeTimestamp(): string {
  return new Date().toISOString().replaceAll(/[:.]/g, "").replace("Z", "");
}

function resolveMigrationsFolder(): string {
  const candidates = [
    path.resolve(import.meta.dirname, "../../drizzle/migrations"),
    path.resolve(process.cwd(), "packages/codex/drizzle/migrations"),
    path.resolve(process.cwd(), "drizzle/migrations")
  ];

  const found = candidates.find((candidate) =>
    existsSync(path.join(candidate, "meta", "_journal.json"))
  );
  if (!found) {
    throw new CodexMigrationError(
      "Codex migration folder could not be found.",
      { candidates }
    );
  }

  return found;
}
