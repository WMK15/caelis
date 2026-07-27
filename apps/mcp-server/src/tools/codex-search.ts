import path from "node:path";

import { SqliteCodexRepository, type CodexSearchResult } from "@caelis/codex";

export interface CodexSearchToolInput {
  projectRoot: string;
  query: string;
  documentTypes?: string[];
  limit?: number;
}

/** Search local Codex FTS documents for a project. */
export async function searchCodex(
  input: CodexSearchToolInput
): Promise<CodexSearchResult[]> {
  const repository = new SqliteCodexRepository({
    projectRoot: path.resolve(input.projectRoot)
  });
  await repository.initialize();
  try {
    return await repository.search({
      query: input.query,
      ...(input.documentTypes ? { documentTypes: input.documentTypes } : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {})
    });
  } finally {
    await repository.close();
  }
}
