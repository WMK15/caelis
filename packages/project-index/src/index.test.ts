import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { detectRpgMakerMzProject, scanProject } from "./index.js";

describe("project scanner", () => {
  it("detects and scans an RPG Maker MZ project without executing plugins", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "caelis-scan-"));
    try {
      await mkdir(path.join(root, "data"), { recursive: true });
      await mkdir(path.join(root, "img", "characters"), { recursive: true });
      await mkdir(path.join(root, "audio"), { recursive: true });
      await mkdir(path.join(root, "js", "plugins"), { recursive: true });
      await writeFile(path.join(root, "Game.rmmzproject"), "RPGMZ", "utf8");
      await writeFile(
        path.join(root, "data", "System.json"),
        '{"gameTitle":"Demo"}',
        "utf8"
      );
      await writeFile(path.join(root, "data", "Map001.json"), "{}", "utf8");
      await writeFile(
        path.join(root, "js", "plugins", "Example.js"),
        "throw new Error('no');",
        "utf8"
      );

      const scan = await scanProject(root);

      expect(await detectRpgMakerMzProject(root)).toBe(true);
      expect(scan.projectName).toBe("Demo");
      expect(scan.mapCount).toBe(1);
      expect(scan.pluginFiles).toEqual(["js/plugins/Example.js"]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
