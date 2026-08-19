import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { detectRpgMakerMzProject, scanProject } from "./index.js";

describe("project scanner", () => {
  it("detects and scans an RPG Maker MZ project without executing plugins", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "caelis-scan-"));
    try {
      await createProject(root, "Game.rmmzproject");
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

  it("returns each normalized asset path once while preserving aggregate totals", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "caelis-scan-"));
    try {
      await createProject(root, "game.rmmzproject");
      await mkdir(path.join(root, "img", "enemies"), { recursive: true });
      await mkdir(path.join(root, "audio", "bgm"), { recursive: true });
      await writeFile(
        path.join(root, "img", "characters", "Hero.png"),
        "",
        "utf8"
      );
      await writeFile(
        path.join(root, "img", "enemies", "Slime.png"),
        "",
        "utf8"
      );
      await writeFile(path.join(root, "audio", "bgm", "Theme.ogg"), "", "utf8");

      const scan = await scanProject(root);
      const folders = scan.assetCounts.map((asset) => asset.folder);

      expect(folders).toEqual([
        "audio",
        "audio/bgm",
        "img",
        "img/characters",
        "img/enemies"
      ]);
      expect(new Set(folders).size).toBe(folders.length);
      expect(folders.every((folder) => !folder.includes("\\"))).toBe(true);
      expect(scan.assetCounts).toEqual([
        { folder: "audio", count: 1 },
        { folder: "audio/bgm", count: 1 },
        { folder: "img", count: 2 },
        { folder: "img/characters", count: 1 },
        { folder: "img/enemies", count: 1 }
      ]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it.each([
    "game.rmmzproject",
    "Game.rmmzproject",
    "MyGame.rmmzproject",
    "GAME.RMMZPROJECT",
    "game.RmMzPrOjEcT"
  ])("accepts project marker %s", async (marker) => {
    const root = await mkdtemp(path.join(tmpdir(), "caelis-scan-"));
    try {
      await createProject(root, marker);

      const scan = await scanProject(root);
      const entries = await readdir(root);

      expect(await detectRpgMakerMzProject(root)).toBe(true);
      expect(scan.projectName).toBe("Demo");
      expect(entries).toContain(marker);
      expect(
        entries.filter(
          (entry) => path.extname(entry).toLowerCase() === ".rmmzproject"
        )
      ).toEqual([marker]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("rejects a project without a marker", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "caelis-scan-"));
    try {
      await createProjectDirectories(root);

      await expect(scanProject(root)).rejects.toThrow(
        "No RPG Maker MZ project marker"
      );
      expect(await detectRpgMakerMzProject(root)).toBe(false);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("rejects projects with multiple markers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "caelis-scan-"));
    try {
      await createProject(root, "game.rmmzproject");
      await writeFile(path.join(root, "GAME.RMMZPROJECT"), "RPGMZ", "utf8");

      await expect(scanProject(root)).rejects.toThrow(
        "Multiple RPG Maker MZ project markers"
      );
      expect(await detectRpgMakerMzProject(root)).toBe(false);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("rejects a project subdirectory path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "caelis-scan-"));
    try {
      await createProject(root, "game.rmmzproject");

      await expect(scanProject(path.join(root, "data"))).rejects.toThrow(
        "Use the project root instead"
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("rejects projects with missing required directories", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "caelis-scan-"));
    try {
      await mkdir(path.join(root, "data"), { recursive: true });
      await mkdir(path.join(root, "audio"), { recursive: true });
      await mkdir(path.join(root, "js"), { recursive: true });
      await writeFile(path.join(root, "game.rmmzproject"), "RPGMZ", "utf8");

      await expect(scanProject(root)).rejects.toThrow(
        "missing required directories: img"
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});

async function createProject(root: string, marker: string): Promise<void> {
  await createProjectDirectories(root);
  await writeFile(path.join(root, marker), "RPGMZ", "utf8");
  await writeFile(
    path.join(root, "data", "System.json"),
    '{"gameTitle":"Demo"}',
    "utf8"
  );
}

async function createProjectDirectories(root: string): Promise<void> {
  await mkdir(path.join(root, "data"), { recursive: true });
  await mkdir(path.join(root, "img", "characters"), { recursive: true });
  await mkdir(path.join(root, "audio"), { recursive: true });
  await mkdir(path.join(root, "js", "plugins"), { recursive: true });
}
