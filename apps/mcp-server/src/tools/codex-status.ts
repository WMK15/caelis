import path from "node:path";

import { SqliteCodexRepository, type CodexStatus } from "@caelis/codex";

/** Return local Codex database status for a project. */
export async function getCodexStatus(
  projectRoot: string
): Promise<CodexStatus> {
  const repository = new SqliteCodexRepository({
    projectRoot: path.resolve(projectRoot)
  });
  await repository.initialize();
  try {
    return await repository.getStatus();
  } finally {
    await repository.close();
  }
}
