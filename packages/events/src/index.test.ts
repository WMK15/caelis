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

  it("compiles dialogue, database controls, transfers and plugin commands", () => {
    expect(
      compileEventCommands([
        { type: "dialogue", speaker: "Hero", text: "Hi\nThere" },
        { type: "set-switch", switchId: 4, value: true },
        { type: "set-variable", variableId: 2, value: 9 },
        { type: "call-common-event", commonEventId: 3 },
        { type: "transfer-player", mapId: 2, x: 5, y: 6 },
        {
          type: "plugin-command",
          pluginName: "Example",
          commandName: "Run",
          args: { speed: "4" }
        }
      ])
    ).toEqual([
      { code: 101, indent: 0, parameters: ["", 0, 0, 2, "Hero"] },
      { code: 401, indent: 0, parameters: ["Hi"] },
      { code: 401, indent: 0, parameters: ["There"] },
      { code: 121, indent: 0, parameters: [4, 4, 0] },
      { code: 122, indent: 0, parameters: [2, 2, 0, 0, 9] },
      { code: 117, indent: 0, parameters: [3] },
      { code: 201, indent: 0, parameters: [0, 2, 5, 6, 0, 0] },
      {
        code: 357,
        indent: 0,
        parameters: ["Example", "Run", "Run", { speed: "4" }]
      },
      { code: 0, indent: 0, parameters: [] }
    ]);
  });

  it("throws typed errors for unsupported raw command variants", () => {
    expect(() =>
      parseEventCommands([{ code: 999, indent: 0, parameters: [] }])
    ).toThrow(NotImplementedError);
  });
});
