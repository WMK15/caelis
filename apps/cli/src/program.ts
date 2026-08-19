import { Command } from "commander";
import { setLogLevel } from "@caelis/shared";

import { registerCodexCommand } from "./commands/codex.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerInitCommand } from "./commands/init.js";
import { registerScanCommand } from "./commands/scan.js";
import { registerValidateCommand } from "./commands/validate.js";

/** Create the Caelis CLI program. */
export function createProgram(): Command {
  const program = new Command();

  program
    .name("caelis")
    .description("Local-first RPG Maker MZ development intelligence toolkit.")
    .version("0.0.0")
    .option("--debug", "show detailed error stacks");

  program.hook("preAction", () => {
    const { debug } = program.opts<{ debug?: boolean }>();
    setLogLevel(debug ? "debug" : "warn");
  });

  registerInitCommand(program);
  registerScanCommand(program);
  registerValidateCommand(program);
  registerDoctorCommand(program);
  registerCodexCommand(program);

  return program;
}
