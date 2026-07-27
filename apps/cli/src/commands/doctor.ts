import { access, constants } from "node:fs/promises";
import path from "node:path";

import { getConfigPath } from "@caelis/config";
import {
  detectRpgMakerMzProject,
  scanProject,
  validateProject
} from "@caelis/project-index";
import type { Command } from "commander";

interface DoctorOptions {
  json?: boolean;
}

interface DoctorCheck {
  name: string;
  ok: boolean;
  message: string;
}

/** Register `caelis doctor`. */
export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .option("--json", "print machine-readable JSON")
    .description("Check local environment and project health.")
    .action(async (projectPath: string, options: DoctorOptions) => {
      const projectRoot = path.resolve(projectPath);
      const checks = await runDoctor(projectRoot);

      if (options.json) {
        console.log(JSON.stringify({ projectRoot, checks }, null, 2));
      } else {
        for (const check of checks) {
          console.log(
            `${check.ok ? "OK" : "FAIL"} ${check.name}: ${check.message}`
          );
        }
      }

      if (checks.some((check) => !check.ok)) {
        process.exitCode = 1;
      }
    });
}

async function runDoctor(projectRoot: string): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const majorVersion = Number.parseInt(
    process.versions.node.split(".")[0] ?? "0",
    10
  );

  checks.push({
    name: "Node.js",
    ok: majorVersion >= 24,
    message: `Detected ${process.version}`
  });

  const detected = await detectRpgMakerMzProject(projectRoot);
  checks.push({
    name: "Project detection",
    ok: detected,
    message: detected
      ? "RPG Maker MZ project file found"
      : "Game.rmmzproject not found"
  });

  checks.push({
    name: "Configuration",
    ok: await canAccess(getConfigPath(projectRoot), constants.R_OK),
    message: getConfigPath(projectRoot)
  });

  checks.push({
    name: "Write access",
    ok: await canAccess(projectRoot, constants.W_OK),
    message: projectRoot
  });

  if (detected) {
    const scan = await scanProject(projectRoot);
    const validation = await validateProject(projectRoot);
    checks.push({
      name: "Malformed JSON",
      ok: validation.issues.every(
        (issue) =>
          issue.severity !== "error" ||
          !issue.message.startsWith("Malformed JSON")
      ),
      message:
        validation.issues.filter((issue) =>
          issue.message.startsWith("Malformed JSON")
        ).length === 0
          ? "No malformed data JSON found"
          : "Malformed data JSON found"
    });
    checks.push({
      name: "Plugin directory",
      ok: scan.folders.plugins,
      message: scan.folders.plugins
        ? "js/plugins exists"
        : "js/plugins is missing"
    });
  }

  return checks;
}

async function canAccess(filePath: string, mode: number): Promise<boolean> {
  try {
    await access(filePath, mode);
    return true;
  } catch {
    return false;
  }
}
