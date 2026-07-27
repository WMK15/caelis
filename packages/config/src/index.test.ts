import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createDefaultConfig, getConfigPath, loadConfig } from "./index.js";

describe("config", () => {
  it("creates and loads the default config", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "caelis-config-"));
    try {
      const created = await createDefaultConfig(root);
      const loaded = await loadConfig(root);
      const raw = await readFile(getConfigPath(root), "utf8");

      expect(created).toEqual(loaded);
      expect(raw).toContain("RPG_MAKER_MZ");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
