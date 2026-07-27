import { describe, expect, it } from "vitest";

import { createProgram } from "./program.js";

describe("cli program", () => {
  it("registers initial commands", () => {
    const commandNames = createProgram()
      .commands.map((command) => command.name())
      .sort();

    expect(commandNames).toEqual([
      "codex",
      "doctor",
      "init",
      "scan",
      "validate"
    ]);
  });
});
