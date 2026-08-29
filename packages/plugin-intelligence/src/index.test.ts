import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  compilePluginCommand,
  discoverPluginDocumentation,
  encodePluginParameterPatch,
  getPluginProfile,
  inspectPluginProject,
  scanPluginUsage
} from "./index.js";

const core = `/*:
 * @target MZ
 * @plugindesc Core dependency
 * @help First public help line.
 * Second public help line.
 */
`;

const feature = `/*:
 * @target MZ
 * @plugindesc Nested plugin fixture
 * @base vendor/Core
 * @orderAfter vendor/Core
 * @param Entries
 * @type struct<Outer>[]
 * @default []
 * @command Apply
 * @text Apply configuration
 * @arg enabled
 * @type boolean
 * @default true
 */
/*:ja
 * @plugindesc ネストされたプラグイン
 * @help 日本語ヘルプ
 */
/*~struct~Outer:
 * @param label
 * @type string
 * @param inner
 * @type struct<Inner>
 */
/*~struct~Inner:
 * @param enabled
 * @type boolean
 */
const version = "1.2.3";
const docs = "https://example.test/feature";
PluginManager.parameters("vendor/Feature");
PluginManager.registerCommand("vendor/Feature", "Apply", () => {});
// EXECUTE_ME: this must only ever be read as text.
`;

describe("plugin intelligence", () => {
  it("inspects nested public schemas from subfolders without leaking plugin source", async () => {
    const root = await createFixture();
    try {
      const report = await inspectPluginProject(root);
      const profile = report.plugins.find(
        (entry) => entry.name === "vendor/Feature"
      );
      expect(profile).toMatchObject({
        installed: true,
        configured: true,
        enabled: true,
        file: { path: "js/plugins/vendor/Feature.js" },
        configurationFile: { path: "js/plugins.js" },
        metadata: {
          dependencies: ["vendor/Core"],
          orderAfter: ["vendor/Core"],
          locales: {
            ja: { description: "ネストされたプラグイン", help: "日本語ヘルプ" }
          }
        },
        decodedParameters: {
          Entries: [{ label: "alpha", inner: { enabled: true } }]
        }
      });
      expect(profile?.file?.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(profile?.metadata.structs.Outer?.[1]).toMatchObject({
        name: "inner",
        type: "struct<Inner>"
      });
      expect(profile?.observations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "parameter-access",
            plugin: "vendor/Feature",
            evidence: {
              label: "observed",
              sourceKind: "static-js-literal",
              detail: "Literal-only static JavaScript scan"
            }
          }),
          expect.objectContaining({
            kind: "registered-command",
            plugin: "vendor/Feature",
            commandName: "Apply"
          }),
          expect.objectContaining({ kind: "version", value: "1.2.3" }),
          expect.objectContaining({
            kind: "url",
            value: "https://example.test/feature"
          })
        ])
      );
      expect(JSON.stringify(report)).not.toContain("EXECUTE_ME");
      expect(report.dependencyGraph).toContainEqual(
        expect.objectContaining({
          plugin: "vendor/Feature",
          dependencies: ["vendor/Core"]
        })
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("encodes nested structs and compiles public commands", async () => {
    const root = await createFixture();
    try {
      const patch = await encodePluginParameterPatch(root, "vendor/Feature", {
        Entries: [{ label: "beta", inner: { enabled: false } }]
      });
      expect(JSON.parse(patch.Entries ?? "[]")).toEqual([
        '{"label":"beta","inner":"{\\"enabled\\":\\"false\\"}"}'
      ]);
      await expect(
        compilePluginCommand(root, "vendor/Feature", "Apply", {
          enabled: false
        })
      ).resolves.toEqual({
        code: 357,
        indent: 0,
        parameters: [
          "vendor/Feature",
          "Apply",
          "Apply configuration",
          { enabled: "false" }
        ]
      });
      await expect(
        getPluginProfile(root, "vendor/Feature")
      ).resolves.toMatchObject({ name: "vendor/Feature" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports dependency order and statically finds command, note, and comment usage", async () => {
    const root = await createFixture();
    try {
      const report = await inspectPluginProject(root);
      expect(report.valid).toBe(false);
      expect(report.issues).toContainEqual(
        expect.objectContaining({
          code: "dependency-order",
          plugin: "vendor/Feature"
        })
      );
      const usages = await scanPluginUsage(root, "vendor/Feature");
      expect(usages.map((usage) => usage.kind).sort()).toEqual([
        "command",
        "comment",
        "note"
      ]);
      expect(usages).toContainEqual(
        expect.objectContaining({
          kind: "command",
          commandName: "Apply",
          path: "data/Map001.json"
        })
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns public help and nearby static documentation", async () => {
    const root = await createFixture();
    try {
      const docs = await discoverPluginDocumentation(root, "vendor/Core");
      expect(docs.help).toBe(
        "First public help line.\nSecond public help line."
      );
      expect(docs.documents).toEqual([
        expect.objectContaining({
          path: "js/plugins/vendor/Core.md",
          size: 7,
          sections: ["Core"]
        })
      ]);
      expect(JSON.stringify(docs)).not.toContain("# Core");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function createFixture(): Promise<string> {
  const root = await mkdtemp(
    path.join(tmpdir(), "caelis-plugin-intelligence-")
  );
  await mkdir(path.join(root, "js", "plugins", "vendor"), { recursive: true });
  await mkdir(path.join(root, "data"), { recursive: true });
  await writeFile(
    path.join(root, "js", "plugins.js"),
    `var $plugins = ${JSON.stringify([
      {
        name: "vendor/Feature",
        status: true,
        description: "feature",
        parameters: {
          Entries:
            '["{\\"label\\":\\"alpha\\",\\"inner\\":\\"{\\\\\\"enabled\\\\\\":\\\\\\"true\\\\\\"}\\"}"]'
        }
      },
      { name: "vendor/Core", status: true, description: "core", parameters: {} }
    ])};\n`,
    "utf8"
  );
  await writeFile(
    path.join(root, "js", "plugins", "vendor", "Core.js"),
    core,
    "utf8"
  );
  await writeFile(
    path.join(root, "js", "plugins", "vendor", "Feature.js"),
    feature,
    "utf8"
  );
  await writeFile(
    path.join(root, "js", "plugins", "vendor", "Core.md"),
    "# Core\n",
    "utf8"
  );
  await writeFile(
    path.join(root, "data", "Map001.json"),
    JSON.stringify({
      note: "<vendor/Feature:used>",
      list: [
        {
          code: 357,
          parameters: [
            "vendor/Feature",
            "Apply",
            "Apply configuration",
            { enabled: "true" }
          ]
        },
        { code: 108, parameters: ["Uses vendor/Feature"] }
      ]
    }),
    "utf8"
  );
  return root;
}
