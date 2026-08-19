import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { copyFixtureProject } from "@caelis/testing";
import { describe, expect, it } from "vitest";

import {
  actorCreatePlanSchema,
  actorCreatePlanTool,
  changeApplySchema,
  changeApplyTool,
  changePlanGetTool,
  toJsonToolResponse
} from "./change-plan-tools.js";

const fixtureRoot = path.resolve(
  import.meta.dirname,
  "../../../../fixtures/vanilla-minimal"
);

describe("change plan MCP tools", () => {
  it("validates MCP tool schemas", () => {
    expect(
      actorCreatePlanSchema.safeParse({
        projectRoot: "fixtures/vanilla-minimal",
        actor: { name: "Hero", classId: 1, characterIndex: 7, faceIndex: 0 }
      }).success
    ).toBe(true);
    expect(
      actorCreatePlanSchema.safeParse({
        projectRoot: "fixtures/vanilla-minimal",
        actor: { name: "Hero", characterIndex: 8 }
      }).success
    ).toBe(false);
    expect(
      changeApplySchema.safeParse({
        projectRoot: ".",
        planId: "plan_1",
        confirm: false
      }).success
    ).toBe(false);
  });

  it("creates and reads actor plans as JSON tool responses", async () => {
    const root = await createProject();
    try {
      const plan = await actorCreatePlanTool({
        projectRoot: root,
        actor: { name: "MCP Hero", classId: 1 }
      });
      const response = toJsonToolResponse(plan);
      const payload = JSON.parse(response.content[0]?.text ?? "{}") as {
        planId: string;
        actorId: number;
      };
      const persisted = await changePlanGetTool({
        projectRoot: root,
        planId: payload.planId
      });

      expect(payload.actorId).toBe(2);
      expect(JSON.stringify(persisted)).toContain("actor.create");
      await expect(
        readFile(path.join(root, "data", "Actors.json"), "utf8")
      ).resolves.not.toContain("MCP Hero");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("applies a reviewed plan through the MCP apply adapter", async () => {
    const root = await createProject();
    try {
      const plan = (await actorCreatePlanTool({
        projectRoot: root,
        actor: { name: "Applied MCP Hero", classId: 1 }
      })) as { planId: string; actorId: number };

      const result = (await changeApplyTool({
        projectRoot: root,
        planId: plan.planId,
        confirm: true
      })) as {
        actorId: number;
        backupPath: string;
      };
      const actors = await readFile(
        path.join(root, "data", "Actors.json"),
        "utf8"
      );

      expect(result.actorId).toBe(plan.actorId);
      expect(result.backupPath).toContain(".caelis/backups");
      expect(actors).toContain("Applied MCP Hero");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});

async function createProject(): Promise<string> {
  const root = await copyFixtureProject(fixtureRoot);
  await mkdir(path.join(root, ".caelis"), { recursive: true });
  await writeFile(
    path.join(root, "data", "Classes.json"),
    `${JSON.stringify([null, { id: 1, name: "Hero" }], null, 2)}\n`,
    "utf8"
  );
  return root;
}
