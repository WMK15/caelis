import { access } from "node:fs/promises";
import path from "node:path";

import { createDefaultConfig, getConfigPath } from "@caelis/config";
import { detectRpgMakerMzProject } from "@caelis/project-index";
import type { Command } from "commander";

interface InitOptions {
  force?: boolean;
}

/** Register `caelis init`. */
export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .option("--force", "overwrite an existing Caelis config")
    .description("Create .caelis/config.yaml for an RPG Maker MZ project.")
    .action(async (projectPath: string, options: InitOptions) => {
      const projectRoot = path.resolve(projectPath);

      if (!(await detectRpgMakerMzProject(projectRoot))) {
        console.error(`No RPG Maker MZ project found at ${projectRoot}`);
        process.exitCode = 1;
        return;
      }

      const configPath = getConfigPath(projectRoot);
      if (!options.force && (await exists(configPath))) {
        console.error(
          `Config already exists at ${configPath}. Re-run with --force to overwrite.`
        );
        process.exitCode = 1;
        return;
      }

      await createDefaultConfig(projectRoot);
      console.log(`Created ${configPath}`);
    });
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
