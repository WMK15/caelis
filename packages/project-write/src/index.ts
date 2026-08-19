import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import { CaelisError, ValidationError } from "@caelis/core";
import {
  scanProject,
  validateProject,
  type ProjectValidationReport
} from "@caelis/project-index";
import { hashFile, normalizePath } from "@caelis/shared";
import { z } from "zod";

const actorRelativePath = "data/Actors.json";
const classesRelativePath = "data/Classes.json";
const planTtlMs = 24 * 60 * 60 * 1000;

const rmmzActorSchema = z.looseObject({
  id: z.number().int().positive(),
  battlerName: z.string(),
  characterIndex: z.number().int().min(0).max(7),
  characterName: z.string(),
  classId: z.number().int().positive(),
  equips: z.array(z.number().int().nonnegative()),
  faceIndex: z.number().int().min(0).max(7),
  faceName: z.string(),
  initialLevel: z.number().int().positive(),
  maxLevel: z.number().int().positive(),
  name: z.string(),
  nickname: z.string(),
  note: z.string(),
  profile: z.string(),
  traits: z.array(z.unknown())
});

const sourceActorSchema = z.looseObject({
  id: z.number().int().positive().optional(),
  name: z.string().optional()
});

const sourceActorArraySchema = z.array(sourceActorSchema.nullable());
const classesArraySchema = z.array(
  z
    .looseObject({
      id: z.number().int().positive().optional(),
      name: z.string().optional()
    })
    .nullable()
);

export const actorCreatePlanInputSchema = z.object({
  projectRoot: z.string().min(1),
  actor: z.object({
    name: z.string().min(1),
    nickname: z.string().optional(),
    profile: z.string().optional(),
    classId: z.number().int().positive().optional(),
    initialLevel: z.number().int().positive().optional(),
    maxLevel: z.number().int().positive().optional(),
    characterName: z.string().optional(),
    characterIndex: z.number().int().min(0).max(7).optional(),
    faceName: z.string().optional(),
    faceIndex: z.number().int().min(0).max(7).optional(),
    battlerName: z.string().optional()
  })
});

export const changePlanGetInputSchema = z.object({
  projectRoot: z.string().min(1),
  planId: z.string().min(1)
});

export const changeApplyInputSchema = z.object({
  projectRoot: z.string().min(1),
  planId: z.string().min(1),
  confirm: z.literal(true)
});

export type ActorCreatePlanInput = z.infer<typeof actorCreatePlanInputSchema>;
export type ChangePlanGetInput = z.infer<typeof changePlanGetInputSchema>;
export type ChangeApplyInput = z.infer<typeof changeApplyInputSchema>;

export interface RmmzActor {
  id: number;
  battlerName: string;
  characterIndex: number;
  characterName: string;
  classId: number;
  equips: number[];
  faceIndex: number;
  faceName: string;
  initialLevel: number;
  maxLevel: number;
  name: string;
  nickname: string;
  note: string;
  profile: string;
  traits: unknown[];
}

type ExistingActorRecord = z.infer<typeof sourceActorSchema>;

export interface ActorCreatePlanResult {
  planId: string;
  actorId: number;
  affectedFile: string;
  beforeSummary: string;
  afterSummary: string;
  proposedActor: RmmzActor;
  warnings: string[];
  safeToApply: boolean;
}

export interface ChangePlan {
  id: string;
  project: {
    root: string;
    identity: string;
    name: string;
    engine: "RPG_MAKER_MZ";
  };
  createdAt: string;
  expiresAt: string;
  sourceFileHash: string;
  operation: {
    type: "actor.create";
    actorId: number;
  };
  affectedPaths: string[];
  beforeState: {
    actorsLength: number;
    actorIds: number[];
    actorNames: string[];
  };
  proposedAfterState: {
    actorsLength: number;
    actorIds: number[];
    actorNames: string[];
    actor: RmmzActor;
    fileContent: string;
  };
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  approvalState: "pending";
  applicationState: "planned" | "applied";
  appliedAt?: string;
  backupPath?: string;
}

export interface ChangeApplyResult {
  actorId: number;
  backupPath: string;
  affectedFile: string;
  validation: ProjectValidationReport;
}

export interface ChangeApplyOptions {
  validate?: (projectRoot: string) => Promise<ProjectValidationReport>;
}

export class ChangePlanError extends CaelisError {
  public constructor(
    message: string,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message, "CHANGE_PLAN_ERROR", details);
  }
}

/** Create and persist a safe actor creation plan without modifying Actors.json. */
export async function createActorCreatePlan(
  input: ActorCreatePlanInput
): Promise<ActorCreatePlanResult> {
  const parsed = actorCreatePlanInputSchema.parse(input);
  const project = await resolveProject(parsed.projectRoot);
  const scan = await scanProject(project.root);
  const actorsPath = await resolveProjectFile(
    project.root,
    actorRelativePath,
    true
  );
  const actorsRaw = await readFile(actorsPath.absolutePath, "utf8");
  const actors = parseActors(actorsRaw, actorRelativePath);
  const classId = parsed.actor.classId ?? 1;
  const warnings = findDuplicateActorNameWarnings(actors, parsed.actor.name);

  await validateClassId(project.root, classId);
  validateLevels(parsed.actor.initialLevel ?? 1, parsed.actor.maxLevel ?? 99);

  const actorId = firstUnusedActorId(actors);
  const proposedActor = createActor(actorId, { ...parsed.actor, classId });
  const nextActors: (ExistingActorRecord | RmmzActor | null)[] = [...actors];
  nextActors[actorId] = proposedActor;

  if (nextActors[0] !== null) {
    throw new ChangePlanError(
      "Actors.json must preserve the RPG Maker null actor at index 0.",
      {
        path: actorRelativePath
      }
    );
  }

  const fileContent = `${JSON.stringify(nextActors, null, 2)}\n`;
  const sourceFileHash = await hashFile(actorsPath.absolutePath);
  const createdAt = new Date();
  const plan: ChangePlan = {
    id: `plan_${randomUUID()}`,
    project: {
      root: project.root,
      identity: project.identity,
      name: scan.projectName,
      engine: scan.engine
    },
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + planTtlMs).toISOString(),
    sourceFileHash,
    operation: { type: "actor.create", actorId },
    affectedPaths: [actorRelativePath],
    beforeState: summarizeActors(actors),
    proposedAfterState: {
      ...summarizeActors(nextActors),
      actor: proposedActor,
      fileContent
    },
    validation: {
      valid: true,
      errors: [],
      warnings
    },
    approvalState: "pending",
    applicationState: "planned"
  };

  await saveChangePlan(project.root, plan);

  return {
    planId: plan.id,
    actorId,
    affectedFile: actorRelativePath,
    beforeSummary: `${String(plan.beforeState.actorIds.length)} actor records before planning.`,
    afterSummary: `Actor ${String(actorId)} (${proposedActor.name}) will be added to ${actorRelativePath}.`,
    proposedActor,
    warnings,
    safeToApply: plan.validation.valid
  };
}

/** Load a persisted change plan after confirming it belongs to this project. */
export async function getChangePlan(
  input: ChangePlanGetInput
): Promise<ChangePlan> {
  const parsed = changePlanGetInputSchema.parse(input);
  const project = await resolveProject(parsed.projectRoot);
  const plan = await loadChangePlan(project.root, parsed.planId);
  assertPlanBelongsToProject(plan, project);
  return plan;
}

/** Apply a previously reviewed plan using backup, atomic replace, validation, and rollback. */
export async function applyChangePlan(
  input: ChangeApplyInput,
  options: ChangeApplyOptions = {}
): Promise<ChangeApplyResult> {
  const parsed = changeApplyInputSchema.parse(input);
  const project = await resolveProject(parsed.projectRoot);
  const plan = await loadChangePlan(project.root, parsed.planId);
  assertPlanCanApply(plan, project);

  const affectedPath = plan.affectedPaths[0];
  if (!affectedPath) {
    throw new ChangePlanError(
      "Change plan does not include an affected file.",
      { planId: plan.id }
    );
  }

  const source = await resolveProjectFile(project.root, affectedPath, true);
  const currentHash = await hashFile(source.absolutePath);
  if (currentHash !== plan.sourceFileHash) {
    throw new ChangePlanError(
      "Change plan is stale because an affected file changed after planning.",
      {
        planId: plan.id,
        path: affectedPath,
        expectedHash: plan.sourceFileHash,
        currentHash
      }
    );
  }

  const backupPath = await createBackup(
    project.root,
    source.absolutePath,
    affectedPath,
    plan.id
  );
  const tempPath = `${source.absolutePath}.caelis-${String(process.pid)}-${String(Date.now())}.tmp`;

  try {
    await writeFile(tempPath, plan.proposedAfterState.fileContent, "utf8");
    validatePlannedActorFile(
      await readFile(tempPath, "utf8"),
      plan.operation.actorId
    );
    await rename(tempPath, source.absolutePath);

    const validation = await (options.validate ?? validateProject)(
      project.root
    );
    if (!validation.valid) {
      await copyFile(backupPath, source.absolutePath);
      throw new ChangePlanError(
        "Project validation failed after applying the plan; backup was restored.",
        {
          planId: plan.id,
          backupPath,
          validation
        }
      );
    }

    plan.applicationState = "applied";
    plan.appliedAt = new Date().toISOString();
    plan.backupPath = backupPath;
    await saveChangePlan(project.root, plan);

    return {
      actorId: plan.operation.actorId,
      backupPath,
      affectedFile: affectedPath,
      validation
    };
  } catch (cause) {
    if (await fileExists(tempPath)) {
      await unlink(tempPath).catch(() => undefined);
    }
    if (cause instanceof ChangePlanError) {
      throw cause;
    }
    throw new ChangePlanError("Change plan could not be applied safely.", {
      planId: plan.id,
      cause: cause instanceof Error ? cause.message : String(cause)
    });
  }
}

async function resolveProject(
  projectRoot: string
): Promise<{ root: string; identity: string }> {
  const resolved = path.resolve(projectRoot);
  const root = await realpath(resolved);
  return { root, identity: root };
}

async function resolveProjectFile(
  projectRoot: string,
  relativePath: string,
  mustExist: boolean
): Promise<{ absolutePath: string; relativePath: string }> {
  if (path.isAbsolute(relativePath) || relativePath.includes("..")) {
    throw new ValidationError(
      "Project file path must stay inside the project root.",
      { relativePath }
    );
  }
  const absolutePath = path.resolve(projectRoot, relativePath);
  if (!isInside(projectRoot, absolutePath)) {
    throw new ValidationError("Project file path escapes the project root.", {
      relativePath
    });
  }
  const checkedPath = mustExist ? await realpath(absolutePath) : absolutePath;
  if (!isInside(projectRoot, checkedPath)) {
    throw new ValidationError(
      "Project file resolves outside the project root.",
      { relativePath }
    );
  }
  return {
    absolutePath: checkedPath,
    relativePath: normalizePath(relativePath)
  };
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function parseActors(
  raw: string,
  relativePath: string
): (ExistingActorRecord | null)[] {
  try {
    const actors = sourceActorArraySchema.parse(JSON.parse(raw));
    if (actors[0] !== null) {
      throw new ChangePlanError("Actors.json must have null at index 0.", {
        path: relativePath
      });
    }
    return actors;
  } catch (cause) {
    if (cause instanceof ChangePlanError) {
      throw cause;
    }
    throw new ChangePlanError("Actors.json is malformed.", {
      path: relativePath,
      cause: cause instanceof Error ? cause.message : String(cause)
    });
  }
}

async function validateClassId(
  projectRoot: string,
  classId: number
): Promise<void> {
  const classFile = await resolveProjectFile(
    projectRoot,
    classesRelativePath,
    true
  ).catch(() => undefined);
  if (!classFile) {
    throw new ChangePlanError(
      "Classes.json is required to validate actor class IDs.",
      {
        classId,
        path: classesRelativePath
      }
    );
  }
  const classes = classesArraySchema.parse(
    JSON.parse(await readFile(classFile.absolutePath, "utf8"))
  );
  const classRecord = classes[classId];
  if (
    !classRecord ||
    (classRecord.id !== undefined && classRecord.id !== classId)
  ) {
    throw new ChangePlanError(
      `Class ID ${String(classId)} does not exist in Classes.json.`,
      {
        classId,
        path: classesRelativePath
      }
    );
  }
}

function validateLevels(initialLevel: number, maxLevel: number): void {
  if (initialLevel > maxLevel) {
    throw new ChangePlanError(
      "Initial level cannot be greater than maximum level.",
      {
        initialLevel,
        maxLevel
      }
    );
  }
}

function firstUnusedActorId(actors: (ExistingActorRecord | null)[]): number {
  for (let index = 1; index < actors.length; index += 1) {
    if (actors[index] === null || actors[index] === undefined) {
      return index;
    }
  }
  return actors.length;
}

function validatePlannedActorFile(raw: string, actorId: number): void {
  const actors = sourceActorArraySchema.parse(JSON.parse(raw));
  rmmzActorSchema.parse(actors[actorId]);
}

function createActor(
  id: number,
  actor: ActorCreatePlanInput["actor"] & { classId: number }
): RmmzActor {
  return {
    id,
    battlerName: actor.battlerName ?? "",
    characterIndex: actor.characterIndex ?? 0,
    characterName: actor.characterName ?? "",
    classId: actor.classId,
    equips: [0, 0, 0, 0, 0],
    faceIndex: actor.faceIndex ?? 0,
    faceName: actor.faceName ?? "",
    initialLevel: actor.initialLevel ?? 1,
    maxLevel: actor.maxLevel ?? 99,
    name: actor.name,
    nickname: actor.nickname ?? "",
    note: "",
    profile: actor.profile ?? "",
    traits: []
  };
}

function findDuplicateActorNameWarnings(
  actors: (ExistingActorRecord | null)[],
  actorName: string
): string[] {
  return actors.some((actor) => actor?.name === actorName)
    ? [`Actor name "${actorName}" already exists.`]
    : [];
}

function summarizeActors(
  actors: (ExistingActorRecord | RmmzActor | null)[]
): ChangePlan["beforeState"] {
  const existing = actors.filter(
    (actor): actor is ExistingActorRecord | RmmzActor => actor !== null
  );
  return {
    actorsLength: actors.length,
    actorIds: existing.flatMap((actor) =>
      typeof actor.id === "number" ? [actor.id] : []
    ),
    actorNames: existing.flatMap((actor) =>
      typeof actor.name === "string" ? [actor.name] : []
    )
  };
}

async function saveChangePlan(
  projectRoot: string,
  plan: ChangePlan
): Promise<void> {
  const plansDirectory = path.join(projectRoot, ".caelis", "plans");
  await mkdir(plansDirectory, { recursive: true });
  await writeFile(
    path.join(plansDirectory, `${plan.id}.json`),
    `${JSON.stringify(plan, null, 2)}\n`,
    "utf8"
  );
}

async function loadChangePlan(
  projectRoot: string,
  planId: string
): Promise<ChangePlan> {
  if (!/^plan_[0-9a-f-]+$/i.test(planId)) {
    throw new ChangePlanError("Invalid change plan ID.", { planId });
  }
  const planPath = path.join(projectRoot, ".caelis", "plans", `${planId}.json`);
  const resolvedPlanPath = await realpath(planPath).catch(() => undefined);
  if (!resolvedPlanPath || !isInside(projectRoot, resolvedPlanPath)) {
    throw new ChangePlanError("Change plan was not found in this project.", {
      planId
    });
  }
  return JSON.parse(await readFile(resolvedPlanPath, "utf8")) as ChangePlan;
}

function assertPlanBelongsToProject(
  plan: ChangePlan,
  project: { root: string; identity: string }
): void {
  if (
    plan.project.identity !== project.identity ||
    plan.project.root !== project.root
  ) {
    throw new ChangePlanError("Change plan belongs to another project.", {
      planId: plan.id
    });
  }
}

function assertPlanCanApply(
  plan: ChangePlan,
  project: { root: string; identity: string }
): void {
  assertPlanBelongsToProject(plan, project);
  if (Date.parse(plan.expiresAt) <= Date.now()) {
    throw new ChangePlanError("Change plan has expired.", {
      planId: plan.id,
      expiresAt: plan.expiresAt
    });
  }
  if (plan.applicationState === "applied") {
    throw new ChangePlanError("Change plan has already been applied.", {
      planId: plan.id
    });
  }
  if (!plan.validation.valid) {
    throw new ChangePlanError("Change plan is invalid and cannot be applied.", {
      planId: plan.id
    });
  }
}

async function createBackup(
  projectRoot: string,
  absoluteSourcePath: string,
  relativePath: string,
  planId: string
): Promise<string> {
  const backupsDirectory = path.join(projectRoot, ".caelis", "backups");
  await mkdir(backupsDirectory, { recursive: true });
  const safeRelativePath = relativePath.replaceAll(/[\\/]/g, "__");
  const backupPath = path.join(
    backupsDirectory,
    `${safeTimestamp()}-${planId}-${safeRelativePath}`
  );
  await copyFile(absoluteSourcePath, backupPath);
  return backupPath;
}

function safeTimestamp(): string {
  return new Date().toISOString().replaceAll(/[:.]/g, "").replace("Z", "");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await realpath(filePath);
    return true;
  } catch {
    return false;
  }
}
