import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { readJsonFile } from "@caelis/shared";

/** Create a temporary minimal RPG Maker MZ fixture project. */
export async function createTemporaryRmmzProject(
  prefix = "caelis-rmmz-"
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  await mkdir(path.join(root, "data"), { recursive: true });
  await mkdir(path.join(root, "img"), { recursive: true });
  await mkdir(path.join(root, "audio"), { recursive: true });
  await mkdir(path.join(root, "js", "plugins"), { recursive: true });
  await writeFile(path.join(root, "Game.rmmzproject"), "RPGMZ", "utf8");
  await writeFile(
    path.join(root, "data", "System.json"),
    JSON.stringify({ gameTitle: "Temporary" }),
    "utf8"
  );
  await writeFile(path.join(root, "data", "MapInfos.json"), "[]", "utf8");
  return root;
}

/** Copy a fixture project to a temporary writable location. */
export async function copyFixtureProject(sourcePath: string): Promise<string> {
  const target = await mkdtemp(path.join(tmpdir(), "caelis-fixture-"));
  await cp(sourcePath, target, { recursive: true });
  return target;
}

/** Read a JSON file from a fixture project. */
export async function readJsonFixture<T = unknown>(
  fixtureRoot: string,
  relativePath: string
): Promise<T> {
  return readJsonFile<T>(path.join(fixtureRoot, relativePath));
}

/** Remove temporary test directories. */
export async function cleanTestDirectory(directory: string): Promise<void> {
  await rm(directory, { force: true, recursive: true });
}
