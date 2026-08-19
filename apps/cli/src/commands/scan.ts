import path from "node:path";

import { scanProject } from "@caelis/project-index";
import type { AssetCount } from "@caelis/project-index";
import type { Command } from "commander";

/** Register `caelis scan`. */
export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description("Run a read-only scan of an RPG Maker MZ project.")
    .action(async (projectPath: string) => {
      const scan = await scanProject(path.resolve(projectPath));
      console.log(`Project: ${scan.projectName}`);
      console.log(`Data files: ${String(scan.dataJsonFiles.length)}`);
      console.log(`Maps: ${String(scan.mapCount)}`);
      console.log(`Plugins: ${String(scan.pluginFiles.length)}`);
      console.log("Assets:");
      for (const asset of formatAssetCountsForOutput(scan.assetCounts)) {
        console.log(`  ${asset.folder}: ${String(asset.count)}`);
      }
    });
}

export function formatAssetCountsForOutput(
  assetCounts: readonly AssetCount[]
): AssetCount[] {
  const byFolder = new Map<string, AssetCount>();

  for (const asset of assetCounts) {
    const folder = asset.folder.replace(/\\/g, "/");
    if (!byFolder.has(folder)) {
      byFolder.set(folder, { folder, count: asset.count });
    }
  }

  return [...byFolder.values()].sort((left, right) => {
    if (left.folder < right.folder) {
      return -1;
    }
    if (left.folder > right.folder) {
      return 1;
    }
    return 0;
  });
}
