import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { copyFixtureProject } from "@caelis/testing";
import { describe, expect, it } from "vitest";

import {
  applyChangePlan,
  createActorCreatePlan,
  getChangePlan,
  type ChangePlan,
  type RmmzActor
} from "./index.js";

const fixtureRoot = path.resolve(
  import.meta.dirname,
  "../../../fixtures/vanilla-minimal"
);

describe("actor create change plans", () => {
  it("allocates the first actor ID after existing actors", async () => {
    const root = await createProject();
    try {
      const plan = await createActorCreatePlan({
        projectRoot: root,
        actor: { name: "Mage", classId: 1 }
      });

      expect(plan.actorId).toBe(2);
      expect(plan.affectedFile).toBe("data/Actors.json");
      expect(plan.safeToApply).toBe(true);
    } finally {
      await clean(root);
    }
  });

  it("fills an internal unused actor slot", async () => {
    const root = await createProject();
    try {
      await writeActors(root, [
        null,
        actor(1, "Hero"),
        null,
        actor(3, "Rival")
      ]);

      const plan = await createActorCreatePlan({
        projectRoot: root,
        actor: { name: "Mage", classId: 1 }
      });

      expect(plan.actorId).toBe(2);
    } finally {
      await clean(root);
    }
  });

  it("preserves null actor element zero and fills default actor fields", async () => {
    const root = await createProject();
    try {
      const plan = await createActorCreatePlan({
        projectRoot: root,
        actor: { name: "Default Hero", classId: 1 }
      });
      const persisted = await getChangePlan({
        projectRoot: root,
        planId: plan.planId
      });
      const proposedActors = JSON.parse(
        persisted.proposedAfterState.fileContent
      ) as unknown[];

      expect(proposedActors[0]).toBeNull();
      expect(plan.proposedActor).toEqual({
        id: 2,
        battlerName: "",
        characterIndex: 0,
        characterName: "",
        classId: 1,
        equips: [0, 0, 0, 0, 0],
        faceIndex: 0,
        faceName: "",
        initialLevel: 1,
        maxLevel: 99,
        name: "Default Hero",
        nickname: "",
        note: "",
        profile: "",
        traits: []
      });
    } finally {
      await clean(root);
    }
  });

  it("rejects invalid class IDs", async () => {
    const root = await createProject();
    try {
      await expect(
        createActorCreatePlan({
          projectRoot: root,
          actor: { name: "Invalid", classId: 99 }
        })
      ).rejects.toThrow("Class ID 99 does not exist");
    } finally {
      await clean(root);
    }
  });

  it("rejects invalid level ranges", async () => {
    const root = await createProject();
    try {
      await expect(
        createActorCreatePlan({
          projectRoot: root,
          actor: { name: "Invalid", classId: 1, initialLevel: 10, maxLevel: 1 }
        })
      ).rejects.toThrow("Initial level cannot be greater");
    } finally {
      await clean(root);
    }
  });

  it("persists plans without writing Actors.json", async () => {
    const root = await createProject();
    try {
      const before = await readFile(
        path.join(root, "data", "Actors.json"),
        "utf8"
      );
      const plan = await createActorCreatePlan({
        projectRoot: root,
        actor: { name: "Planned", classId: 1 }
      });
      const after = await readFile(
        path.join(root, "data", "Actors.json"),
        "utf8"
      );
      const persisted = await getChangePlan({
        projectRoot: root,
        planId: plan.planId
      });

      expect(after).toBe(before);
      expect(persisted.id).toBe(plan.planId);
      expect(persisted.operation).toEqual({
        type: "actor.create",
        actorId: plan.actorId
      });
    } finally {
      await clean(root);
    }
  });

  it("warns about duplicate actor names without blocking the plan", async () => {
    const root = await createProject();
    try {
      const plan = await createActorCreatePlan({
        projectRoot: root,
        actor: { name: "Hero", classId: 1 }
      });

      expect(plan.safeToApply).toBe(true);
      expect(plan.warnings).toEqual(['Actor name "Hero" already exists.']);
    } finally {
      await clean(root);
    }
  });

  it("creates a backup before successful atomic apply", async () => {
    const root = await createProject();
    try {
      const before = await readFile(
        path.join(root, "data", "Actors.json"),
        "utf8"
      );
      const plan = await createActorCreatePlan({
        projectRoot: root,
        actor: { name: "Applied", classId: 1 }
      });

      const result = await applyChangePlan({
        projectRoot: root,
        planId: plan.planId,
        confirm: true
      });
      const actors = JSON.parse(
        await readFile(path.join(root, "data", "Actors.json"), "utf8")
      ) as (RmmzActor | null)[];
      const backup = await readFile(result.backupPath, "utf8");

      expect(result.actorId).toBe(plan.actorId);
      expect(backup).toBe(before);
      expect(actors[0]).toBeNull();
      expect(actors[plan.actorId]?.name).toBe("Applied");
    } finally {
      await clean(root);
    }
  });

  it("rejects stale source hashes", async () => {
    const root = await createProject();
    try {
      const plan = await createActorCreatePlan({
        projectRoot: root,
        actor: { name: "Stale", classId: 1 }
      });
      await writeActors(root, [null, actor(1, "Hero"), actor(2, "Other")]);

      await expect(
        applyChangePlan({
          projectRoot: root,
          planId: plan.planId,
          confirm: true
        })
      ).rejects.toThrow("stale");
    } finally {
      await clean(root);
    }
  });

  it("restores the backup when post-apply validation fails", async () => {
    const root = await createProject();
    try {
      const before = await readFile(
        path.join(root, "data", "Actors.json"),
        "utf8"
      );
      const plan = await createActorCreatePlan({
        projectRoot: root,
        actor: { name: "Rollback", classId: 1 }
      });

      await expect(
        applyChangePlan(
          { projectRoot: root, planId: plan.planId, confirm: true },
          {
            validate: async () =>
              await Promise.resolve({
                valid: false,
                issues: [{ severity: "error", message: "forced" }]
              })
          }
        )
      ).rejects.toThrow("backup was restored");
      await expect(
        readFile(path.join(root, "data", "Actors.json"), "utf8")
      ).resolves.toBe(before);
    } finally {
      await clean(root);
    }
  });

  it("rejects duplicate apply", async () => {
    const root = await createProject();
    try {
      const plan = await createActorCreatePlan({
        projectRoot: root,
        actor: { name: "Once", classId: 1 }
      });
      await applyChangePlan({
        projectRoot: root,
        planId: plan.planId,
        confirm: true
      });

      await expect(
        applyChangePlan({
          projectRoot: root,
          planId: plan.planId,
          confirm: true
        })
      ).rejects.toThrow("already been applied");
    } finally {
      await clean(root);
    }
  });

  it("rejects path traversal in a persisted plan", async () => {
    const root = await createProject();
    try {
      const plan = await createActorCreatePlan({
        projectRoot: root,
        actor: { name: "Traversal", classId: 1 }
      });
      const persisted = await getChangePlan({
        projectRoot: root,
        planId: plan.planId
      });
      persisted.affectedPaths = ["../Actors.json"];
      await writePlan(root, persisted);

      await expect(
        applyChangePlan({
          projectRoot: root,
          planId: plan.planId,
          confirm: true
        })
      ).rejects.toThrow("inside the project root");
    } finally {
      await clean(root);
    }
  });

  it("rejects symlink escapes for Actors.json", async () => {
    const root = await createProject();
    const outside = await mkdtemp(path.join(tmpdir(), "caelis-outside-"));
    try {
      await writeFile(path.join(outside, "Actors.json"), "[null]", "utf8");
      await unlink(path.join(root, "data", "Actors.json"));
      await symlink(
        path.join(outside, "Actors.json"),
        path.join(root, "data", "Actors.json")
      );

      await expect(
        createActorCreatePlan({
          projectRoot: root,
          actor: { name: "Escaped", classId: 1 }
        })
      ).rejects.toThrow("outside the project root");
    } finally {
      await clean(root);
      await clean(outside);
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

async function clean(root: string): Promise<void> {
  await rm(root, { force: true, recursive: true });
}

async function writeActors(root: string, actors: unknown[]): Promise<void> {
  await writeFile(
    path.join(root, "data", "Actors.json"),
    `${JSON.stringify(actors, null, 2)}\n`,
    "utf8"
  );
}

async function writePlan(root: string, plan: ChangePlan): Promise<void> {
  await writeFile(
    path.join(root, ".caelis", "plans", `${plan.id}.json`),
    `${JSON.stringify(plan, null, 2)}\n`,
    "utf8"
  );
}

function actor(id: number, name: string): RmmzActor {
  return {
    id,
    battlerName: "",
    characterIndex: 0,
    characterName: "",
    classId: 1,
    equips: [0, 0, 0, 0, 0],
    faceIndex: 0,
    faceName: "",
    initialLevel: 1,
    maxLevel: 99,
    name,
    nickname: "",
    note: "",
    profile: "",
    traits: []
  };
}
