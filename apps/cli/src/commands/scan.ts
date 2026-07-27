import path from "node:path";

import { scanProject } from "@caelis/project-index";
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
      for (const asset of scan.assetCounts) {
        console.log(`  ${asset.folder}: ${String(asset.count)}`);
      }
    });
}
