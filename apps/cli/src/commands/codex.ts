import path from "node:path";

import { getCodexDatabasePath, SqliteCodexRepository } from "@caelis/codex";
import type { Command } from "commander";

interface JsonOption {
  json?: boolean;
}

interface SearchOptions extends JsonOption {
  project?: string;
  type?: string[];
  limit?: string;
}

/** Register `caelis codex` commands. */
export function registerCodexCommand(program: Command): void {
  const codex = program
    .command("codex")
    .description("Inspect and maintain the local Caelis Codex database.");

  codex
    .command("status")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .option("--json", "print machine-readable JSON")
    .description("Show Codex database status.")
    .action(async (projectPath: string, options: JsonOption) => {
      const repository = await openRepository(projectPath);
      try {
        const status = await repository.getStatus();
        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
        } else {
          console.log(`Database: ${status.databasePath}`);
          console.log(`Size: ${String(status.databaseSize)} bytes`);
          console.log(`Schema version: ${String(status.schemaVersion)}`);
          console.log(`Entities: ${String(status.entityCount)}`);
          console.log(`Assertions: ${String(status.assertionCount)}`);
          console.log(`Relationships: ${String(status.relationshipCount)}`);
          console.log(`Sources: ${String(status.sourceCount)}`);
          console.log(
            `Search documents: ${String(status.searchDocumentCount)}`
          );
        }
      } finally {
        await repository.close();
      }
    });

  codex
    .command("search")
    .argument("<query>", "search query")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .option("--project <projectId>", "filter by Codex project ID")
    .option("--type <documentType...>", "filter by document type")
    .option("--limit <number>", "maximum results", "10")
    .option("--json", "print machine-readable JSON")
    .description("Search the Codex FTS5 index.")
    .action(
      async (query: string, projectPath: string, options: SearchOptions) => {
        const repository = await openRepository(projectPath);
        try {
          const results = await repository.search({
            query,
            ...(options.project ? { projectId: options.project } : {}),
            ...(options.type ? { documentTypes: options.type } : {}),
            limit: parseLimit(options.limit)
          });
          if (options.json) {
            console.log(JSON.stringify(results, null, 2));
          } else if (results.length === 0) {
            console.log("No Codex results found.");
          } else {
            for (const result of results) {
              console.log(`${result.documentType} ${result.title}`);
              console.log(`  ${result.snippet}`);
            }
          }
        } finally {
          await repository.close();
        }
      }
    );

  codex
    .command("verify")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description("Verify Codex database integrity.")
    .action(async (projectPath: string) => {
      const repository = await openRepository(projectPath);
      try {
        const report = await repository.verify();
        console.log(JSON.stringify(report, null, 2));
        if (!report.valid) {
          process.exitCode = 1;
        }
      } finally {
        await repository.close();
      }
    });

  codex
    .command("backup")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description("Create a safe Codex SQLite backup.")
    .action(async (projectPath: string) => {
      const repository = await openRepository(projectPath);
      try {
        console.log(await repository.backup("manual"));
      } finally {
        await repository.close();
      }
    });

  codex
    .command("rebuild-index")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description(
      "Rebuild the Codex FTS index without deleting canonical memory."
    )
    .action(async (projectPath: string) => {
      const repository = await openRepository(projectPath);
      try {
        await repository.rebuildIndex();
        console.log("Codex search index rebuilt.");
      } finally {
        await repository.close();
      }
    });
}

async function openRepository(
  projectPath: string
): Promise<SqliteCodexRepository> {
  const projectRoot = path.resolve(projectPath);
  const repository = new SqliteCodexRepository({ projectRoot });
  await repository.initialize();
  return repository;
}

function parseLimit(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "10", 10);
  return Number.isFinite(parsed) ? parsed : 10;
}

export { getCodexDatabasePath };
