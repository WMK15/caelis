import path from "node:path";

import { validateProject } from "@caelis/project-index";
import type { Command } from "commander";

/** Register `caelis validate`. */
export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description("Validate project structure and data JSON parseability.")
    .action(async (projectPath: string) => {
      const report = await validateProject(path.resolve(projectPath));

      if (report.issues.length === 0) {
        console.log("Validation passed.");
        return;
      }

      for (const issue of report.issues) {
        const location = issue.path ? ` (${issue.path})` : "";
        console.log(
          `${issue.severity.toUpperCase()}: ${issue.message}${location}`
        );
      }

      if (!report.valid) {
        process.exitCode = 1;
      }
    });
}
