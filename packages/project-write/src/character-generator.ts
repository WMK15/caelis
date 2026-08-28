import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { ChangePlanError } from "./errors.js";

export interface CharacterGeneratorStatus {
  editorPath?: string;
  generatorDirectory?: string;
  generatorAssetFiles: number;
  projectFile: string;
  canLaunch: boolean;
  note: string;
}

/** Locate the MZ editor and its generator asset directory without modifying anything. */
export async function getCharacterGeneratorStatus(
  projectRoot: string,
  editorPath?: string
): Promise<CharacterGeneratorStatus> {
  const root = await realpath(path.resolve(projectRoot));
  const projectFile = await findProjectFile(root);
  const editor = await findEditor(editorPath);
  const generatorDirectory = editor
    ? await findGeneratorDirectory(editor)
    : undefined;
  return {
    ...(editor ? { editorPath: editor } : {}),
    ...(generatorDirectory ? { generatorDirectory } : {}),
    generatorAssetFiles: generatorDirectory
      ? await countFiles(generatorDirectory)
      : 0,
    projectFile,
    canLaunch: editor !== undefined,
    note: "RPG Maker MZ exposes Character Generator as an editor UI tool. Caelis can launch the project editor; then choose Tools > Character Generator. The editor does not document a command-line switch that opens that window directly."
  };
}

/** Launch the RPG Maker MZ project editor for access to its built-in Character Generator. */
export async function launchCharacterGenerator(input: {
  projectRoot: string;
  editorPath?: string | undefined;
  confirm: boolean;
}): Promise<CharacterGeneratorStatus & { launched: true; pid?: number }> {
  if (!input.confirm) {
    throw new ChangePlanError("Launching RPG Maker MZ requires confirmation.");
  }
  const status = await getCharacterGeneratorStatus(
    input.projectRoot,
    input.editorPath
  );
  if (!status.editorPath) {
    throw new ChangePlanError(
      "RPG Maker MZ editor was not found. Pass editorPath or set RPG_MAKER_MZ_PATH."
    );
  }
  const command = status.editorPath.endsWith(".app")
    ? "open"
    : status.editorPath;
  const args = status.editorPath.endsWith(".app")
    ? ["-a", status.editorPath, status.projectFile]
    : [status.projectFile];
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
  return {
    ...status,
    launched: true,
    ...(child.pid === undefined ? {} : { pid: child.pid })
  };
}

async function findEditor(explicit?: string): Promise<string | undefined> {
  const candidates = [
    explicit,
    process.env.RPG_MAKER_MZ_PATH,
    ...(process.platform === "darwin"
      ? ["/Applications/RPG Maker MZ.app"]
      : []),
    ...(process.platform === "win32"
      ? [
          "C:/Program Files (x86)/Steam/steamapps/common/RPG Maker MZ/RPGMZ.exe",
          "C:/Program Files/Steam/steamapps/common/RPG Maker MZ/RPGMZ.exe"
        ]
      : []),
    ...(process.platform === "linux"
      ? [
          path.join(
            homedir(),
            ".steam/steam/steamapps/common/RPG Maker MZ/RPGMZ.exe"
          ),
          path.join(
            homedir(),
            ".local/share/Steam/steamapps/common/RPG Maker MZ/RPGMZ.exe"
          )
        ]
      : [])
  ].filter((candidate): candidate is string => !!candidate);
  for (const candidate of candidates) {
    if (await exists(candidate)) return realpath(candidate);
  }
  return undefined;
}

async function findGeneratorDirectory(
  editorPath: string
): Promise<string | undefined> {
  const base = editorPath.endsWith(".app")
    ? path.join(editorPath, "Contents", "Resources")
    : path.dirname(editorPath);
  for (const name of ["generator", "Generator"]) {
    const candidate = path.join(base, name);
    if (await isDirectory(candidate)) return realpath(candidate);
  }
  return undefined;
}

async function findProjectFile(root: string): Promise<string> {
  const entries = await readdir(root, { withFileTypes: true });
  const markers = entries.filter(
    (entry) =>
      entry.isFile() && entry.name.toLowerCase().endsWith(".rmmzproject")
  );
  if (markers.length !== 1 || !markers[0]) {
    throw new ChangePlanError(
      `Expected exactly one .rmmzproject file in ${root}.`
    );
  }
  return path.join(root, markers[0].name);
}

async function countFiles(directory: string): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true });
  const counts = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? countFiles(path.join(directory, entry.name))
        : Promise.resolve(entry.isFile() ? 1 : 0)
    )
  );
  return counts.reduce((total, count) => total + count, 0);
}

async function isDirectory(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}
