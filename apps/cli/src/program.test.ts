import { describe, expect, it } from "vitest";

import { createProgram } from "./program.js";

describe("cli program", () => {
  it("registers inspection, project editing, and Codex commands", () => {
    const commandNames = createProgram()
      .commands.map((command) => command.name())
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
  });
});
