import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { copyFixtureProject } from "@caelis/testing";
import { describe, expect, it } from "vitest";

import {
  applyChangePlan,
  configurePluginPlan,
  createDatabaseRecordPlan,
  createPluginPlan,
  getCharacterGeneratorStatus,
  getDatabaseRecord,
  getMapEvent,
  getPluginMetadata,
  getSystemData,
  listPlugins,
  updateDatabaseRecordPlan,
  updateSystemPlan,
  upsertMapEventPlan
} from "./index.js";

const fixtureRoot = path.resolve(
  import.meta.dirname,
  "../../../fixtures/vanilla-minimal"
);

describe("general RPG Maker project operations", () => {
  it("creates and updates arbitrary database records through guarded plans", async () => {
    const root = await createProject();
    try {
      const create = await createDatabaseRecordPlan({
        projectRoot: root,
        collection: "skills",
        templateId: 1,
        record: { name: "Ice", damage: { elementId: 2 } }
      });
      expect(create.recordId).toBe(2);
      expect((await getDatabaseRecord(root, "skills", 1)).name).toBe("Fire");
      await applyChangePlan({
        projectRoot: root,
        planId: create.planId,
        confirm: true
      });
      expect(await getDatabaseRecord(root, "skills", 2)).toMatchObject({
        id: 2,
        name: "Ice",
        damage: { elementId: 2, type: 1 }
      });

      const update = await updateDatabaseRecordPlan({
        projectRoot: root,
        collection: "skills",
        id: 2,
        patch: { description: "Cold damage" }
      });
      await applyChangePlan({
        projectRoot: root,
        planId: update.planId,
        confirm: true
      });
      expect((await getDatabaseRecord(root, "skills", 2)).description).toBe(
        "Cold damage"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("edits troop battle pages as ordinary complete database data", async () => {
    const root = await createProject();
    try {
      const plan = await updateDatabaseRecordPlan({
        projectRoot: root,
        collection: "troops",
        id: 1,
        patch: {
          pages: [
            {
              conditions: {
                turnEnding: false,
                turnValid: true,
                turnA: 1,
                turnB: 0
              },
              span: 0,
              list: [
                { code: 101, indent: 0, parameters: ["", 0, 0, 2, "Boss"] },
                { code: 401, indent: 0, parameters: ["You cannot win!"] },
                { code: 0, indent: 0, parameters: [] }
              ]
            }
          ]
        }
      });
      await applyChangePlan({
        projectRoot: root,
        planId: plan.planId,
        confirm: true
      });
      const troop = await getDatabaseRecord(root, "troops", 1);
      expect(troop.pages as unknown[]).toHaveLength(1);
      expect(JSON.stringify(troop)).toContain("You cannot win!");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates and edits map events with multiple normalized pages", async () => {
    const root = await createProject();
    try {
      const plan = await upsertMapEventPlan({
        projectRoot: root,
        mapId: 1,
        event: {
          name: "Door",
          x: 3,
          y: 4,
          pages: [
            { list: [{ code: 108, indent: 0, parameters: ["Locked"] }] },
            {
              conditions: { switch1Valid: true, switch1Id: 1 },
              list: [{ code: 201, indent: 0, parameters: [0, 1, 5, 5, 0, 0] }]
            }
          ]
        }
      });
      await applyChangePlan({
        projectRoot: root,
        planId: plan.planId,
        confirm: true
      });
      const event = await getMapEvent(root, 1, plan.eventId ?? 0);
      const pages = event.pages as { list: { code: number }[] }[];
      expect(pages).toHaveLength(2);
      expect(pages[0]?.list.at(-1)?.code).toBe(0);
      expect(pages[1]?.list.at(-1)?.code).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("updates System Types and Terms through the same review workflow", async () => {
    const root = await createProject();
    try {
      const plan = await updateSystemPlan({
        projectRoot: root,
        patch: {
          terms: { basic: ["Level", "Lv"] },
          switches: [null, "Intro", "Boss Defeated"]
        }
      });
      await applyChangePlan({
        projectRoot: root,
        planId: plan.planId,
        confirm: true
      });
      expect(await getSystemData(root)).toMatchObject({
        terms: { basic: ["Level", "Lv"] },
        switches: [null, "Intro", "Boss Defeated"]
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates, registers, inspects and reconfigures plugins with multi-file apply", async () => {
    const root = await createProject();
    try {
      const create = await createPluginPlan({
        projectRoot: root,
        name: "QuestTools",
        description: "Quest helpers",
        author: "Caelis",
        commands: [
          {
            name: "StartQuest",
            arguments: [{ name: "questId", type: "number" }]
          }
        ]
      });
      const result = await applyChangePlan({
        projectRoot: root,
        planId: create.planId,
        confirm: true
      });
      expect(result.affectedFiles).toEqual([
        "js/plugins/QuestTools.js",
        "js/plugins.js"
      ]);
      expect(await getPluginMetadata(root, "QuestTools")).toMatchObject({
        configured: true,
        status: true,
        author: "Caelis",
        commands: [{ name: "StartQuest", arguments: ["questId"] }]
      });
      expect(await listPlugins(root)).toHaveLength(1);

      const configure = await configurePluginPlan({
        projectRoot: root,
        name: "QuestTools",
        status: false,
        parameters: { debug: "true" }
      });
      await applyChangePlan({
        projectRoot: root,
        planId: configure.planId,
        confirm: true
      });
      expect(await getPluginMetadata(root, "QuestTools")).toMatchObject({
        status: false
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports generator assets when an editor path is supplied", async () => {
    const root = await createProject();
    try {
      const install = path.join(root, "fake-editor");
      await mkdir(path.join(install, "generator", "Face"), { recursive: true });
      await writeFile(path.join(install, "RPGMZ.exe"), "fake", "utf8");
      await writeFile(
        path.join(install, "generator", "Face", "part.png"),
        "fake",
        "utf8"
      );
      expect(
        await getCharacterGeneratorStatus(root, path.join(install, "RPGMZ.exe"))
      ).toMatchObject({
        canLaunch: true,
        generatorAssetFiles: 1
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function createProject(): Promise<string> {
  const root = await copyFixtureProject(fixtureRoot);
  await mkdir(path.join(root, ".caelis"), { recursive: true });
  await writeFile(
    path.join(root, "data", "Skills.json"),
    JSON.stringify(
      [
        null,
        {
          id: 1,
          name: "Fire",
          description: "",
          damage: { elementId: 1, type: 1 }
        }
      ],
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(root, "data", "Troops.json"),
    JSON.stringify(
      [null, { id: 1, name: "Slime", members: [], pages: [] }],
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(root, "js", "plugins.js"),
    "// Generated by RPG Maker.\nvar $plugins =\n[];\n",
    "utf8"
  );
  return root;
}
