import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  compileVisuStellaCommand,
  encodeVisuStellaParameterPatch,
  inspectVisuStellaProject,
  parsePluginHeaders
} from "./index.js";

const coreSource = `/*:
 * @target MZ
 * @plugindesc Synthetic Tier 0 fixture
 * @author Caelis Tests
 * @param Rules
 * @type struct<Rules>
 * @default {"speed":"4","enabled":"true","labels":"[\\"A\\",\\"B\\"]"}
 * @command SetMode
 * @text Set Mode
 * @arg mode
 * @type select
 * @option Fast
 * @value fast
 * @option Safe
 * @value safe
 * @default safe
 */
/*~struct~Rules:
 * @param speed
 * @type number
 * @min 1
 * @max 10
 * @default 4
 * @param enabled
 * @type boolean
 * @default true
 * @param labels
 * @type string[]
 * @default []
 */
`;

const extensionSource = `/*:
 * @target MZ
 * @plugindesc Synthetic Tier 3 fixture
 * @base VisuMZ_0_CoreEngine
 * @orderAfter VisuMZ_0_CoreEngine
 * @param Entries
 * @type struct<Entry>[]
 * @default []
 */
/*~struct~Entry:
 * @param id
 * @type number
 * @param title
 * @type string
 */
`;

describe("VisuStella adapter", () => {
  it("parses command and nested struct schemas from public headers", () => {
    const metadata = parsePluginHeaders(coreSource);
    expect(metadata.parameters[0]).toMatchObject({
      name: "Rules",
      type: "struct<Rules>"
    });
    expect(metadata.structs.Rules).toHaveLength(3);
    expect(metadata.commands[0]).toMatchObject({
      name: "SetMode",
      text: "Set Mode",
      arguments: [
        {
          name: "mode",
          options: [
            { text: "Fast", value: "fast" },
            { text: "Safe", value: "safe" }
          ]
        }
      ]
    });
  });

  it("decodes and encodes structs and compiles typed commands", async () => {
    const root = await createProject();
    try {
      const report = await inspectVisuStellaProject(root);
      expect(report).toMatchObject({ detected: true, valid: true });
      expect(report.tierCounts).toMatchObject({ "0": 1, "3": 1 });
      expect(report.plugins[0]?.decodedParameters).toEqual({
        Rules: { speed: 4, enabled: true, labels: ["A", "B"] }
      });

      const patch = await encodeVisuStellaParameterPatch(
        root,
        "VisuMZ_0_CoreEngine",
        { Rules: { speed: 7, enabled: false, labels: ["X", "Y"] } }
      );
      expect(JSON.parse(patch.Rules ?? "{}")).toEqual({
        speed: "7",
        enabled: "false",
        labels: '["X","Y"]'
      });

      expect(
        await compileVisuStellaCommand(root, "VisuMZ_0_CoreEngine", "SetMode", {
          mode: "fast"
        })
      ).toEqual({
        code: 357,
        indent: 0,
        parameters: [
          "VisuMZ_0_CoreEngine",
          "SetMode",
          "Set Mode",
          { mode: "fast" }
        ]
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports tier, base and Tier 5 risks", async () => {
    const root = await createProject([
      pluginConfig("VisuMZ_3_Extension", true, { Entries: "[]" }),
      pluginConfig("VisuMZ_0_CoreEngine", true, {}),
      pluginConfig("VisuMZ_5_Patch", true, {})
    ]);
    try {
      await writeFile(
        path.join(root, "js", "plugins", "VisuMZ_5_Patch.js"),
        "/*:\n * @target MZ\n */\n",
        "utf8"
      );
      const report = await inspectVisuStellaProject(root);
      expect(report.valid).toBe(false);
      expect(report.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining([
          "tier-order",
          "dependency-order",
          "tier-5-risk"
        ])
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function createProject(
  configurations = [
    pluginConfig("VisuMZ_0_CoreEngine", true, {
      Rules: '{"speed":"4","enabled":"true","labels":"[\\"A\\",\\"B\\"]"}'
    }),
    pluginConfig("VisuMZ_3_Extension", true, { Entries: "[]" })
  ]
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "caelis-visustella-"));
  await mkdir(path.join(root, "js", "plugins"), { recursive: true });
  await writeFile(
    path.join(root, "js", "plugins.js"),
    `var $plugins = ${JSON.stringify(configurations, null, 2)};\n`,
    "utf8"
  );
  await writeFile(
    path.join(root, "js", "plugins", "VisuMZ_0_CoreEngine.js"),
    coreSource,
    "utf8"
  );
  await writeFile(
    path.join(root, "js", "plugins", "VisuMZ_3_Extension.js"),
    extensionSource,
    "utf8"
  );
  return root;
}

function pluginConfig(
  name: string,
  status: boolean,
  parameters: Record<string, string>
): Record<string, unknown> {
  return { name, status, description: "fixture", parameters };
}
