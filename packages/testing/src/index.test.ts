import { describe, expect, it } from "vitest";

import {
  cleanTestDirectory,
  createTemporaryRmmzProject,
  readJsonFixture
} from "./index.js";

describe("testing helpers", () => {
  it("creates temporary RPG Maker projects", async () => {
    const root = await createTemporaryRmmzProject();
    try {
      const system = await readJsonFixture<{ gameTitle: string }>(
        root,
        "data/System.json"
      );

      expect(system.gameTitle).toBe("Temporary");
    } finally {
      await cleanTestDirectory(root);
    }
  });
});
