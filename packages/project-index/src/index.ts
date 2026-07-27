import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { ProjectNotFoundError } from "@caelis/core";
import { normalizePath } from "@caelis/shared";

/** Asset counts keyed by project-relative asset folder. */
export interface AssetCount {
  folder: string;
  count: number;
}

/** Read-only scan result for an RPG Maker MZ project. */
export interface ProjectScanResult {
  projectRoot: string;
  projectName: string;
  engine: "RPG_MAKER_MZ";
  folders: {
    data: boolean;
    img: boolean;
    audio: boolean;
    js: boolean;
    plugins: boolean;
  };
  dataJsonFiles: string[];
  pluginFiles: string[];
  assetCounts: AssetCount[];
  mapCount: number;
}

/** Validation issue discovered during read-only project inspection. */
export interface ProjectValidationIssue {
  severity: "error" | "warning";
  message: string;
  path?: string;
}

/** Read-only validation report for a project root. */
export interface ProjectValidationReport {
  valid: boolean;
  issues: ProjectValidationIssue[];
}

/** Return whether a path resembles an RPG Maker MZ project. */
export async function detectRpgMakerMzProject(
  projectRoot: string
): Promise<boolean> {
  try {
    await access(path.join(projectRoot, "Game.rmmzproject"));
    return true;
  } catch {
    return false;
  }
}

/** Scan project structure without executing plugins or modifying files. */
export async function scanProject(
  projectRoot: string
): Promise<ProjectScanResult> {
  if (!(await detectRpgMakerMzProject(projectRoot))) {
    throw new ProjectNotFoundError(projectRoot);
  }

  const folders = {
    data: await isDirectory(path.join(projectRoot, "data")),
    img: await isDirectory(path.join(projectRoot, "img")),
    audio: await isDirectory(path.join(projectRoot, "audio")),
    js: await isDirectory(path.join(projectRoot, "js")),
    plugins: await isDirectory(path.join(projectRoot, "js", "plugins"))
  };

  const dataJsonFiles = folders.data
    ? await listFilesByExtension(
        projectRoot,
        path.join(projectRoot, "data"),
        ".json"
      )
    : [];
  const pluginFiles = folders.plugins
    ? await listFilesByExtension(
        projectRoot,
        path.join(projectRoot, "js", "plugins"),
        ".js"
      )
    : [];
  const assetCounts = await countAssets(projectRoot, ["img", "audio"]);

  return {
    projectRoot,
    projectName: await readProjectName(projectRoot),
    engine: "RPG_MAKER_MZ",
    folders,
    dataJsonFiles,
    pluginFiles,
    assetCounts,
    mapCount: dataJsonFiles.filter((file) => /^data\/Map\d+\.json$/.test(file))
      .length
  };
}

/** Validate expected RPG Maker MZ folders and JSON parseability without writes. */
export async function validateProject(
  projectRoot: string
): Promise<ProjectValidationReport> {
  const issues: ProjectValidationIssue[] = [];
  let scan: ProjectScanResult;

  try {
    scan = await scanProject(projectRoot);
  } catch (cause) {
    return {
      valid: false,
      issues: [
        {
          severity: "error",
          message:
            cause instanceof Error
              ? cause.message
              : "Project could not be scanned."
        }
      ]
    };
  }

  for (const [folder, exists] of Object.entries(scan.folders)) {
    if (!exists && folder !== "plugins") {
      issues.push({
        severity: "error",
        message: `Expected ${folder} folder is missing.`,
        path: folder
      });
    }
  }

  if (!scan.folders.plugins) {
    issues.push({
      severity: "warning",
      message: "Plugin directory is missing.",
      path: "js/plugins"
    });
  }

  for (const relativePath of scan.dataJsonFiles) {
    try {
      JSON.parse(await readFile(path.join(projectRoot, relativePath), "utf8"));
    } catch (cause) {
      issues.push({
        severity: "error",
        message: `Malformed JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
        path: relativePath
      });
    }
  }

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues
  };
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

async function listFilesByExtension(
  projectRoot: string,
  directory: string,
  extension: string
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listFilesByExtension(projectRoot, fullPath, extension);
      }
      if (entry.isFile() && entry.name.endsWith(extension)) {
        return [normalizePath(path.relative(projectRoot, fullPath))];
      }
      return [];
    })
  );

  return files.flat().sort();
}

async function countAssets(
  projectRoot: string,
  roots: string[]
): Promise<AssetCount[]> {
  const counts = await Promise.all(
    roots.map(async (root) => {
      const rootPath = path.join(projectRoot, root);
      if (!(await isDirectory(rootPath))) {
        return [];
      }

      const directories = await listDirectories(rootPath);
      return Promise.all(
        directories.map(async (directory) => ({
          folder: normalizePath(path.relative(projectRoot, directory)),
          count: (await listAllFiles(directory)).length
        }))
      );
    })
  );

  return counts
    .flat()
    .sort((left, right) => left.folder.localeCompare(right.folder));
}

async function listDirectories(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const fullPath = path.join(directory, entry.name);
        return [fullPath, ...(await listDirectories(fullPath))];
      })
  );

  return [directory, ...nested.flat()];
}

async function listAllFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listAllFiles(fullPath);
      }
      return entry.isFile() ? [fullPath] : [];
    })
  );

  return files.flat();
}

async function readProjectName(projectRoot: string): Promise<string> {
  const systemPath = path.join(projectRoot, "data", "System.json");
  try {
    const raw = await readFile(systemPath, "utf8");
    const parsed = JSON.parse(raw) as { gameTitle?: unknown };
    if (typeof parsed.gameTitle === "string" && parsed.gameTitle.length > 0) {
      return parsed.gameTitle;
    }
  } catch {
    return path.basename(path.resolve(projectRoot));
  }

  return path.basename(path.resolve(projectRoot));
}
