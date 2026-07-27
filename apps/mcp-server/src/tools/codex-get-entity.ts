import path from "node:path";

import { SqliteCodexRepository, type CodexEntity } from "@caelis/codex";

export interface CodexGetEntityToolInput {
  projectRoot: string;
  entityId?: string;
  canonicalKey?: string;
}

/** Retrieve a Codex entity by ID or canonical key. */
export async function getCodexEntity(
  input: CodexGetEntityToolInput
): Promise<CodexEntity | undefined> {
  const repository = new SqliteCodexRepository({
    projectRoot: path.resolve(input.projectRoot)
  });
  await repository.initialize();
  try {
    if (input.entityId) {
      return await repository.getEntity(input.entityId);
    }
    if (input.canonicalKey) {
      return await repository.getEntityByKey("default", input.canonicalKey);
    }
    return undefined;
  } finally {
    await repository.close();
  }
}
