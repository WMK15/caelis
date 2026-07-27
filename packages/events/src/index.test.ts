import { NotImplementedError } from "@caelis/core";
import { describe, expect, it } from "vitest";

import { compileEventCommands, parseEventCommands } from "./index.js";

describe("event AST", () => {
  it("parses supported scaffold commands", () => {
    expect(
      parseEventCommands([
        { code: 108, indent: 0, parameters: ["Hello"] },
        { code: 230, indent: 0, parameters: [30] },
        { code: 115, indent: 0, parameters: [] },
        { code: 0, indent: 0, parameters: [] }
      ])
    ).toEqual([
      { type: "comment", text: "Hello" },
      { type: "wait", frames: 30 },
      { type: "exit-event-processing" }
    ]);
  });

  it("compiles supported scaffold nodes", () => {
    expect(
      compileEventCommands([
        { type: "comment", text: "Hello" },
        { type: "wait", frames: 12 },
        { type: "exit-event-processing" }
      ])
    ).toEqual([
      { code: 108, indent: 0, parameters: ["Hello"] },
      { code: 230, indent: 0, parameters: [12] },
      { code: 115, indent: 0, parameters: [] },
      { code: 0, indent: 0, parameters: [] }
    ]);
  });

  it("throws typed errors for deferred nodes", () => {
    expect(() =>
      compileEventCommands([{ type: "dialogue", text: "Hi" }])
    ).toThrow(NotImplementedError);
  });
});
