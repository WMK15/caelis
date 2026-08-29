import { describe, expect, it } from "vitest";

import { createProgram } from "./program.js";

describe("cli program", () => {
  it("registers inspection, project editing, and Codex commands", () => {
    const program = createProgram();
    const commandNames = program.commands
      .map((command) => command.name())
      .sort();

    expect(commandNames).toEqual([
      "codex",
      "database",
      "doctor",
      "event-compile",
      "generator",
      "init",
      "map",
      "plan",
      "plugin",
      "scan",
      "system",
      "validate",
      "visustella"
    ]);

    const plugin = program.commands.find(
      (command) => command.name() === "plugin"
    );
    expect(plugin?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining([
        "inventory",
        "inspect",
        "validate",
        "usage",
        "graph",
        "params",
        "commands",
        "docs"
      ])
    );
  });
});
