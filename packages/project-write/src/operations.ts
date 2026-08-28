import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import { ValidationError } from "@caelis/core";
import {
  scanProject,
  validateProject,
  type ProjectValidationReport
} from "@caelis/project-index";
import { hashFile, normalizePath } from "@caelis/shared";

import { ChangePlanError } from "./errors.js";

export const databaseCollections = [
  "actors",
  "animations",
  "armors",
  "classes",
  "commonEvents",
  "enemies",
  "items",
  "skills",
  "states",
  "tilesets",
  "troops",
  "weapons"
] as const;

export type DatabaseCollection = (typeof databaseCollections)[number];
export type JsonObject = Record<string, unknown>;

const collectionFiles: Record<DatabaseCollection, string> = {
  actors: "Actors.json",
  animations: "Animations.json",
  armors: "Armors.json",
  classes: "Classes.json",
  commonEvents: "CommonEvents.json",
  enemies: "Enemies.json",
  items: "Items.json",
  skills: "Skills.json",
  states: "States.json",
  tilesets: "Tilesets.json",
  troops: "Troops.json",
  weapons: "Weapons.json"
};

export interface PlannedFileChange {
  path: string;
  sourceHash: string | null;
  beforeExists: boolean;
  proposedContent: string;
  summary: string;
}

export interface ProjectChangePlan {
  version: 2;
  id: string;
  project: {
    root: string;
    identity: string;
    name: string;
    engine: "RPG_MAKER_MZ";
  };
  createdAt: string;
  expiresAt: string;
  operation: {
    type: string;
    details: JsonObject;
  };
  files: PlannedFileChange[];
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  approvalState: "pending";
  applicationState: "planned" | "applied";
  appliedAt?: string;
  backupPaths?: string[];
}

export interface ProjectPlanResult {
  planId: string;
  operation: string;
  affectedFiles: string[];
  summary: string;
  warnings: string[];
  safeToApply: boolean;
  recordId?: number;
  eventId?: number;
}

export interface GenericChangeApplyResult {
  actorId?: number;
  operation: string;
  affectedFiles: string[];
  backupPaths: string[];
  validation: ProjectValidationReport;
}

export interface DatabaseRecordPlanInput {
  projectRoot: string;
  collection: DatabaseCollection;
  record: JsonObject;
  templateId?: number | undefined;
}

export interface DatabaseRecordUpdatePlanInput {
  projectRoot: string;
  collection: DatabaseCollection;
  id: number;
  patch: JsonObject;
  replace?: boolean | undefined;
}

export interface MapEventPlanInput {
  projectRoot: string;
  mapId: number;
  eventId?: number | undefined;
  event: JsonObject;
  replace?: boolean | undefined;
}

export interface SystemUpdatePlanInput {
  projectRoot: string;
  patch: JsonObject;
  replace?: boolean | undefined;
}

export interface PluginConfigPlanInput {
  projectRoot: string;
  name: string;
  status?: boolean | undefined;
  parameters?: Record<string, string> | undefined;
  description?: string | undefined;
  position?: number | undefined;
}

export interface PluginCreatePlanInput extends PluginConfigPlanInput {
  source?: string | undefined;
  author?: string | undefined;
  commands?:
    | {
        name: string;
        description?: string | undefined;
        arguments?:
          | {
              name: string;
              type?: "string" | "number" | "boolean" | undefined;
              description?: string | undefined;
              default?: string | undefined;
            }[]
          | undefined;
      }[]
    | undefined;
}

export interface PluginConfiguration {
  name: string;
  status: boolean;
  description: string;
  parameters: Record<string, string>;
}

export interface PluginMetadata {
  name: string;
  path: string;
  configured: boolean;
  status?: boolean;
  description?: string;
  author?: string;
  help?: string;
  parameters: string[];
  commands: { name: string; arguments: string[] }[];
}

const planTtlMs = 24 * 60 * 60 * 1000;

/** List complete records from any RPG Maker MZ array-backed database file. */
export async function listDatabaseRecords(
  projectRoot: string,
  collection: DatabaseCollection
): Promise<(JsonObject | null)[]> {
  const project = await resolveProject(projectRoot);
  return readDatabaseArray(project.root, collection);
}

/** Get one database record by its RPG Maker ID. */
export async function getDatabaseRecord(
  projectRoot: string,
  collection: DatabaseCollection,
  id: number
): Promise<JsonObject> {
  assertPositiveId(id, "record ID");
  const records = await listDatabaseRecords(projectRoot, collection);
  const record = records[id];
  if (!record) {
    throw new ChangePlanError(
      `${collection} record ${String(id)} does not exist.`,
      { collection, id }
    );
  }
  return record;
}

/** Plan creation of a record in any array-backed RPG Maker database. */
export async function createDatabaseRecordPlan(
  input: DatabaseRecordPlanInput
): Promise<ProjectPlanResult> {
  const project = await resolveProject(input.projectRoot);
  const records = await readDatabaseArray(project.root, input.collection);
  const recordId = firstUnusedId(records);
  const template =
    input.templateId === undefined
      ? {}
      : await getDatabaseRecord(
          project.root,
          input.collection,
          input.templateId
        );
  const proposed = deepMerge(template, input.record);
  proposed.id = recordId;
  const next = [...records];
  next[recordId] = proposed;
  const relativePath = collectionPath(input.collection);
  const warnings = duplicateNameWarnings(records, proposed);
  const plan = await createPlan(
    project,
    "database.record.create",
    { collection: input.collection, recordId },
    [
      await plannedExistingFile(
        project.root,
        relativePath,
        jsonContent(next),
        `Create ${input.collection} record ${String(recordId)}.`
      )
    ],
    warnings
  );
  return planResult(
    plan,
    `${input.collection} record ${String(recordId)} will be created.`,
    { recordId }
  );
}

/** Plan a shallow or recursive-merge update of an existing database record. */
export async function updateDatabaseRecordPlan(
  input: DatabaseRecordUpdatePlanInput
): Promise<ProjectPlanResult> {
  assertPositiveId(input.id, "record ID");
  const project = await resolveProject(input.projectRoot);
  const records = await readDatabaseArray(project.root, input.collection);
  const existing = records[input.id];
  if (!existing) {
    throw new ChangePlanError(
      `${input.collection} record ${String(input.id)} does not exist.`,
      { collection: input.collection, id: input.id }
    );
  }
  const proposed = input.replace
    ? structuredClone(input.patch)
    : deepMerge(existing, input.patch);
  proposed.id = input.id;
  const next = [...records];
  next[input.id] = proposed;
  const relativePath = collectionPath(input.collection);
  const plan = await createPlan(
    project,
    "database.record.update",
    {
      collection: input.collection,
      recordId: input.id,
      replace: !!input.replace
    },
    [
      await plannedExistingFile(
        project.root,
        relativePath,
        jsonContent(next),
        `Update ${input.collection} record ${String(input.id)}.`
      )
    ]
  );
  return planResult(
    plan,
    `${input.collection} record ${String(input.id)} will be updated.`,
    { recordId: input.id }
  );
}

/** Read System.json, including system, type, term, switch and variable data. */
export async function getSystemData(projectRoot: string): Promise<JsonObject> {
  const project = await resolveProject(projectRoot);
  return readJsonObject(project.root, "data/System.json");
}

/** Plan an update to System.json, covering Types, Terms, switches and variables. */
export async function updateSystemPlan(
  input: SystemUpdatePlanInput
): Promise<ProjectPlanResult> {
  const project = await resolveProject(input.projectRoot);
  const existing = await readJsonObject(project.root, "data/System.json");
  const proposed = input.replace
    ? structuredClone(input.patch)
    : deepMerge(existing, input.patch);
  const plan = await createPlan(
    project,
    "system.update",
    { replace: !!input.replace },
    [
      await plannedExistingFile(
        project.root,
        "data/System.json",
        jsonContent(proposed),
        "Update RPG Maker system database data."
      )
    ]
  );
  return planResult(plan, "System.json will be updated.");
}

/** Read a complete RPG Maker map, including all event pages and commands. */
export async function getMapData(
  projectRoot: string,
  mapId: number
): Promise<JsonObject> {
  assertPositiveId(mapId, "map ID");
  const project = await resolveProject(projectRoot);
  return readJsonObject(project.root, mapPath(mapId));
}

/** Read one event from a map. */
export async function getMapEvent(
  projectRoot: string,
  mapId: number,
  eventId: number
): Promise<JsonObject> {
  assertPositiveId(eventId, "event ID");
  const map = await getMapData(projectRoot, mapId);
  const events = asNullableObjectArray(map.events, "Map events");
  const event = events[eventId];
  if (!event) {
    throw new ChangePlanError(
      `Event ${String(eventId)} does not exist on map ${String(mapId)}.`,
      { mapId, eventId }
    );
  }
  return event;
}

/** Plan creation or editing of a map event, including arbitrary page arrays. */
export async function upsertMapEventPlan(
  input: MapEventPlanInput
): Promise<ProjectPlanResult> {
  assertPositiveId(input.mapId, "map ID");
  if (input.eventId !== undefined) {
    assertPositiveId(input.eventId, "event ID");
  }
  const project = await resolveProject(input.projectRoot);
  const relativePath = mapPath(input.mapId);
  const map = await readJsonObject(project.root, relativePath);
  const events = asNullableObjectArray(map.events, "Map events");
  if (events[0] !== null) {
    throw new ChangePlanError(`${relativePath} must contain null event zero.`);
  }
  const eventId = input.eventId ?? firstUnusedId(events);
  const existing = events[eventId];
  if (input.eventId !== undefined && !existing) {
    throw new ChangePlanError(
      `Event ${String(eventId)} does not exist on map ${String(input.mapId)}.`,
      { mapId: input.mapId, eventId }
    );
  }
  const base = existing ?? defaultMapEvent(eventId);
  const event = input.replace
    ? structuredClone(input.event)
    : deepMerge(base, input.event);
  event.id = eventId;
  normalizeEventPages(event);
  validateEventCoordinates(map, event, input.mapId);
  const nextEvents = [...events];
  nextEvents[eventId] = event;
  const nextMap = { ...map, events: nextEvents };
  const operation = existing ? "map.event.update" : "map.event.create";
  const plan = await createPlan(
    project,
    operation,
    { mapId: input.mapId, eventId, replace: !!input.replace },
    [
      await plannedExistingFile(
        project.root,
        relativePath,
        jsonContent(nextMap),
        `${existing ? "Update" : "Create"} event ${String(eventId)} on map ${String(input.mapId)}.`
      )
    ]
  );
  return planResult(
    plan,
    `Event ${String(eventId)} on map ${String(input.mapId)} will be ${existing ? "updated" : "created"}.`,
    { eventId }
  );
}

/** Read plugin configuration without executing plugin JavaScript. */
export async function listPlugins(
  projectRoot: string
): Promise<PluginMetadata[]> {
  const project = await resolveProject(projectRoot);
  const configurations = await readPluginConfigurations(project.root);
  const scan = await scanProject(project.root);
  const names = new Set([
    ...configurations.map((plugin) => plugin.name),
    ...scan.pluginFiles.map((file) => path.basename(file, ".js"))
  ]);
  return Promise.all(
    [...names].map((name) => inspectPlugin(project.root, name, configurations))
  );
}

/** Inspect public RPG Maker metadata in a plugin header without executing it. */
export async function getPluginMetadata(
  projectRoot: string,
  name: string
): Promise<PluginMetadata> {
  const project = await resolveProject(projectRoot);
  return inspectPlugin(
    project.root,
    safePluginName(name),
    await readPluginConfigurations(project.root)
  );
}

/** Plan enable/disable, ordering, parameter, and description changes in plugins.js. */
export async function configurePluginPlan(
  input: PluginConfigPlanInput
): Promise<ProjectPlanResult> {
  const project = await resolveProject(input.projectRoot);
  const name = safePluginName(input.name);
  const relativePath = "js/plugins.js";
  const source = await readTextFile(project.root, relativePath);
  const configurations = parsePluginConfigurations(source);
  const index = configurations.findIndex((plugin) => plugin.name === name);
  const existing = index >= 0 ? configurations[index] : undefined;
  const nextPlugin: PluginConfiguration = {
    name,
    status: input.status ?? existing?.status ?? true,
    description: input.description ?? existing?.description ?? "",
    parameters: { ...(existing?.parameters ?? {}), ...(input.parameters ?? {}) }
  };
  if (index >= 0) {
    configurations.splice(index, 1);
  }
  const requestedPosition = input.position ?? index;
  const position = Math.max(
    0,
    Math.min(
      requestedPosition < 0 ? configurations.length : requestedPosition,
      configurations.length
    )
  );
  configurations.splice(position, 0, nextPlugin);
  const plan = await createPlan(
    project,
    "plugin.configure",
    { name, status: nextPlugin.status, position },
    [
      await plannedExistingFile(
        project.root,
        relativePath,
        replacePluginArray(source, configurations),
        `Configure plugin ${name}.`
      )
    ]
  );
  return planResult(plan, `Plugin ${name} configuration will be updated.`);
}

/** Plan a new local plugin scaffold plus its plugins.js registration. */
export async function createPluginPlan(
  input: PluginCreatePlanInput
): Promise<ProjectPlanResult> {
  const project = await resolveProject(input.projectRoot);
  const name = safePluginName(input.name);
  const pluginPath = `js/plugins/${name}.js`;
  if (await pathExists(path.join(project.root, pluginPath))) {
    throw new ChangePlanError(`Plugin file ${pluginPath} already exists.`, {
      name
    });
  }
  const pluginsPath = "js/plugins.js";
  const pluginsSource = await readTextFile(project.root, pluginsPath);
  const configurations = parsePluginConfigurations(pluginsSource);
  if (configurations.some((plugin) => plugin.name === name)) {
    throw new ChangePlanError(`Plugin ${name} is already configured.`, {
      name
    });
  }
  const configuration: PluginConfiguration = {
    name,
    status: input.status ?? true,
    description: input.description ?? "Created with Caelis.",
    parameters: input.parameters ?? {}
  };
  const position = Math.max(
    0,
    Math.min(input.position ?? configurations.length, configurations.length)
  );
  configurations.splice(position, 0, configuration);
  const source =
    input.source ??
    renderPluginScaffold({
      name,
      description: configuration.description,
      author: input.author ?? "",
      parameters: configuration.parameters,
      commands: input.commands ?? []
    });
  const plan = await createPlan(
    project,
    "plugin.create",
    { name, status: configuration.status, position },
    [
      await plannedNewFile(
        project.root,
        pluginPath,
        source.endsWith("\n") ? source : `${source}\n`,
        `Create plugin source ${pluginPath}.`
      ),
      await plannedExistingFile(
        project.root,
        pluginsPath,
        replacePluginArray(pluginsSource, configurations),
        `Register plugin ${name}.`
      )
    ]
  );
  return planResult(plan, `Plugin ${name} will be created and registered.`);
}

/** Load a version 2 project change plan. */
export async function getProjectChangePlan(input: {
  projectRoot: string;
  planId: string;
}): Promise<ProjectChangePlan> {
  const project = await resolveProject(input.projectRoot);
  const plan = await loadPlan(project.root, input.planId);
  if (!isProjectChangePlan(plan)) {
    throw new ChangePlanError(
      "Change plan uses the legacy actor-plan format.",
      {
        planId: input.planId
      }
    );
  }
  assertPlanProject(plan, project);
  return plan;
}

/** Apply a version 2 multi-file plan with stale checks, backup, validation and rollback. */
export async function applyProjectChangePlan(
  input: { projectRoot: string; planId: string; confirm: boolean },
  options: {
    validate?: (projectRoot: string) => Promise<ProjectValidationReport>;
  } = {}
): Promise<GenericChangeApplyResult> {
  if (!input.confirm) {
    throw new ChangePlanError("Applying a change plan requires confirmation.");
  }
  const project = await resolveProject(input.projectRoot);
  const plan = await getProjectChangePlan(input);
  assertGenericPlanCanApply(plan, project);
  const resolved = await Promise.all(
    plan.files.map(async (file) => ({
      file,
      absolutePath: await resolveWritableProjectPath(project.root, file.path)
    }))
  );

  for (const target of resolved) {
    const exists = await pathExists(target.absolutePath);
    if (exists !== target.file.beforeExists) {
      throw new ChangePlanError(
        `Change plan is stale because ${target.file.path} ${exists ? "now exists" : "no longer exists"}.`,
        { planId: plan.id, path: target.file.path }
      );
    }
    if (
      exists &&
      (await hashFile(target.absolutePath)) !== target.file.sourceHash
    ) {
      throw new ChangePlanError(
        `Change plan is stale because ${target.file.path} changed after planning.`,
        { planId: plan.id, path: target.file.path }
      );
    }
    validateProposedContent(target.file.path, target.file.proposedContent);
  }

  const backups: { target: string; backup?: string; existed: boolean }[] = [];
  const tempPaths: string[] = [];
  try {
    for (const target of resolved) {
      await mkdir(path.dirname(target.absolutePath), { recursive: true });
      const backup = target.file.beforeExists
        ? await createBackup(
            project.root,
            target.absolutePath,
            target.file.path,
            plan.id
          )
        : undefined;
      backups.push({
        target: target.absolutePath,
        ...(backup ? { backup } : {}),
        existed: target.file.beforeExists
      });
      const tempPath = `${target.absolutePath}.caelis-${String(process.pid)}-${String(Date.now())}.tmp`;
      tempPaths.push(tempPath);
      await writeFile(tempPath, target.file.proposedContent, "utf8");
    }
    for (let index = 0; index < resolved.length; index += 1) {
      const target = resolved[index];
      const tempPath = tempPaths[index];
      if (!target || !tempPath) {
        throw new ChangePlanError("Internal multi-file plan mismatch.");
      }
      await rename(tempPath, target.absolutePath);
    }
    const validation = await (options.validate ?? validateProject)(
      project.root
    );
    if (!validation.valid) {
      throw new ChangePlanError(
        "Project validation failed after applying the plan.",
        {
          planId: plan.id,
          validation
        }
      );
    }
    plan.applicationState = "applied";
    plan.appliedAt = new Date().toISOString();
    plan.backupPaths = backups.flatMap((entry) =>
      entry.backup ? [entry.backup] : []
    );
    await savePlan(project.root, plan);
    return {
      operation: plan.operation.type,
      affectedFiles: plan.files.map((file) => file.path),
      backupPaths: plan.backupPaths,
      validation
    };
  } catch (cause) {
    for (const tempPath of tempPaths) {
      await unlink(tempPath).catch(() => undefined);
    }
    for (const backup of backups.reverse()) {
      if (backup.backup) {
        await copyFile(backup.backup, backup.target).catch(() => undefined);
      } else if (!backup.existed) {
        await unlink(backup.target).catch(() => undefined);
      }
    }
    if (cause instanceof ChangePlanError) {
      throw new ChangePlanError(
        `${cause.message} Applied files were rolled back.`,
        cause.details
      );
    }
    throw new ChangePlanError(
      "Change plan could not be applied safely; applied files were rolled back.",
      {
        planId: plan.id,
        cause: cause instanceof Error ? cause.message : String(cause)
      }
    );
  }
}

export function isProjectChangePlan(
  value: unknown
): value is ProjectChangePlan {
  return isObject(value) && value.version === 2 && Array.isArray(value.files);
}

async function createPlan(
  project: { root: string; identity: string },
  operationType: string,
  details: JsonObject,
  files: PlannedFileChange[],
  warnings: string[] = []
): Promise<ProjectChangePlan> {
  const scan = await scanProject(project.root);
  const now = new Date();
  const plan: ProjectChangePlan = {
    version: 2,
    id: `plan_${randomUUID()}`,
    project: {
      root: project.root,
      identity: project.identity,
      name: scan.projectName,
      engine: scan.engine
    },
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + planTtlMs).toISOString(),
    operation: { type: operationType, details },
    files,
    validation: { valid: true, errors: [], warnings },
    approvalState: "pending",
    applicationState: "planned"
  };
  await savePlan(project.root, plan);
  return plan;
}

function planResult(
  plan: ProjectChangePlan,
  summary: string,
  ids: { recordId?: number; eventId?: number } = {}
): ProjectPlanResult {
  return {
    planId: plan.id,
    operation: plan.operation.type,
    affectedFiles: plan.files.map((file) => file.path),
    summary,
    warnings: plan.validation.warnings,
    safeToApply: plan.validation.valid,
    ...ids
  };
}

async function plannedExistingFile(
  root: string,
  relativePath: string,
  proposedContent: string,
  summary: string
): Promise<PlannedFileChange> {
  const absolutePath = await resolveExistingProjectPath(root, relativePath);
  return {
    path: normalizePath(relativePath),
    sourceHash: await hashFile(absolutePath),
    beforeExists: true,
    proposedContent,
    summary
  };
}

async function plannedNewFile(
  root: string,
  relativePath: string,
  proposedContent: string,
  summary: string
): Promise<PlannedFileChange> {
  const absolutePath = await resolveWritableProjectPath(root, relativePath);
  if (await pathExists(absolutePath)) {
    throw new ChangePlanError(`${relativePath} already exists.`);
  }
  return {
    path: normalizePath(relativePath),
    sourceHash: null,
    beforeExists: false,
    proposedContent,
    summary
  };
}

async function readDatabaseArray(
  root: string,
  collection: DatabaseCollection
): Promise<(JsonObject | null)[]> {
  const relativePath = collectionPath(collection);
  const parsed = JSON.parse(await readTextFile(root, relativePath)) as unknown;
  const records = asNullableObjectArray(parsed, `${collection} database`);
  if (records[0] !== null) {
    throw new ChangePlanError(`${relativePath} must contain null record zero.`);
  }
  return records;
}

async function readJsonObject(
  root: string,
  relativePath: string
): Promise<JsonObject> {
  const parsed = JSON.parse(await readTextFile(root, relativePath)) as unknown;
  if (!isObject(parsed)) {
    throw new ChangePlanError(`${relativePath} must contain a JSON object.`);
  }
  return parsed;
}

async function readTextFile(
  root: string,
  relativePath: string
): Promise<string> {
  return readFile(await resolveExistingProjectPath(root, relativePath), "utf8");
}

function collectionPath(collection: DatabaseCollection): string {
  return `data/${collectionFiles[collection]}`;
}

function mapPath(mapId: number): string {
  return `data/Map${String(mapId).padStart(3, "0")}.json`;
}

function firstUnusedId(records: (JsonObject | null)[]): number {
  for (let index = 1; index < records.length; index += 1) {
    if (records[index] === null || records[index] === undefined) {
      return index;
    }
  }
  return Math.max(1, records.length);
}

function defaultMapEvent(id: number): JsonObject {
  return {
    id,
    name: `EV${String(id).padStart(3, "0")}`,
    note: "",
    x: 0,
    y: 0,
    pages: [defaultEventPage()]
  };
}

function defaultEventPage(): JsonObject {
  return {
    conditions: {
      actorId: 1,
      actorValid: false,
      itemId: 1,
      itemValid: false,
      selfSwitchCh: "A",
      selfSwitchValid: false,
      switch1Id: 1,
      switch1Valid: false,
      switch2Id: 1,
      switch2Valid: false,
      variableId: 1,
      variableValid: false,
      variableValue: 0
    },
    directionFix: false,
    image: {
      characterIndex: 0,
      characterName: "",
      direction: 2,
      pattern: 1,
      tileId: 0
    },
    list: [{ code: 0, indent: 0, parameters: [] }],
    moveFrequency: 3,
    moveRoute: {
      list: [{ code: 0, parameters: [] }],
      repeat: true,
      skippable: false,
      wait: false
    },
    moveSpeed: 3,
    moveType: 0,
    priorityType: 1,
    stepAnime: false,
    through: false,
    trigger: 0,
    walkAnime: true
  };
}

function normalizeEventPages(event: JsonObject): void {
  const pages =
    Array.isArray(event.pages) && event.pages.length > 0
      ? event.pages
      : [defaultEventPage()];
  event.pages = pages.map((value: unknown, pageIndex: number) => {
    if (!isObject(value)) {
      throw new ChangePlanError(
        `Event page ${String(pageIndex + 1)} must be an object.`
      );
    }
    const page = deepMerge(defaultEventPage(), value);
    if (!Array.isArray(page.list)) {
      throw new ChangePlanError(
        `Event page ${String(pageIndex + 1)} list must be an array.`
      );
    }
    const list = page.list.map((command, commandIndex) =>
      normalizeEventCommand(command, pageIndex, commandIndex)
    );
    const final = list.at(-1);
    if (final?.code !== 0) {
      list.push({ code: 0, indent: 0, parameters: [] });
    }
    page.list = list;
    return page;
  });
}

function normalizeEventCommand(
  value: unknown,
  pageIndex: number,
  commandIndex: number
): JsonObject {
  if (!isObject(value) || !Number.isInteger(value.code)) {
    throw new ChangePlanError(
      `Event page ${String(pageIndex + 1)} command ${String(commandIndex + 1)} requires an integer code.`
    );
  }
  return {
    ...value,
    indent:
      Number.isInteger(value.indent) && Number(value.indent) >= 0
        ? value.indent
        : 0,
    parameters: Array.isArray(value.parameters) ? value.parameters : []
  };
}

function validateEventCoordinates(
  map: JsonObject,
  event: JsonObject,
  mapId: number
): void {
  const x = event.x;
  const y = event.y;
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    Number(x) < 0 ||
    Number(y) < 0
  ) {
    throw new ChangePlanError(
      "Map event coordinates must be non-negative integers.",
      { mapId, x, y }
    );
  }
  if (
    (typeof map.width === "number" && Number(x) >= map.width) ||
    (typeof map.height === "number" && Number(y) >= map.height)
  ) {
    throw new ChangePlanError(
      "Map event coordinates are outside the map bounds.",
      {
        mapId,
        x,
        y,
        width: map.width,
        height: map.height
      }
    );
  }
}

async function readPluginConfigurations(
  root: string
): Promise<PluginConfiguration[]> {
  const pluginsPath = path.join(root, "js", "plugins.js");
  if (!(await pathExists(pluginsPath))) {
    return [];
  }
  return parsePluginConfigurations(await readFile(pluginsPath, "utf8"));
}

export function parsePluginConfigurations(
  source: string
): PluginConfiguration[] {
  const start = source.indexOf("[");
  const end = source.lastIndexOf("]");
  if (start < 0 || end < start) {
    throw new ChangePlanError("js/plugins.js does not contain a plugin array.");
  }
  const parsed = JSON.parse(source.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed)) {
    throw new ChangePlanError(
      "js/plugins.js plugin configuration must be an array."
    );
  }
  return parsed.map((value, index) => {
    if (!isObject(value) || typeof value.name !== "string") {
      throw new ChangePlanError(
        `Plugin configuration ${String(index)} is malformed.`
      );
    }
    return {
      name: value.name,
      status: typeof value.status === "boolean" ? value.status : false,
      description:
        typeof value.description === "string" ? value.description : "",
      parameters: isStringRecord(value.parameters) ? value.parameters : {}
    };
  });
}

function replacePluginArray(
  source: string,
  plugins: PluginConfiguration[]
): string {
  const start = source.indexOf("[");
  const end = source.lastIndexOf("]");
  if (start < 0 || end < start) {
    throw new ChangePlanError("js/plugins.js does not contain a plugin array.");
  }
  return `${source.slice(0, start)}${JSON.stringify(plugins, null, 2)}${source.slice(end + 1)}`;
}

async function inspectPlugin(
  root: string,
  name: string,
  configurations: PluginConfiguration[]
): Promise<PluginMetadata> {
  const relativePath = `js/plugins/${safePluginName(name)}.js`;
  const configuration = configurations.find((plugin) => plugin.name === name);
  const absolutePath = path.join(root, relativePath);
  const source = (await pathExists(absolutePath))
    ? await readFile(absolutePath, "utf8")
    : "";
  const header = /\/\*:[\s\S]*?\*\//.exec(source)?.[0] ?? "";
  const author = annotationValue(header, "author");
  const help = annotationValue(header, "help");
  const commands: { name: string; arguments: string[] }[] = [];
  let currentCommand: { name: string; arguments: string[] } | undefined;
  const parameters: string[] = [];
  for (const line of header.split(/\r?\n/)) {
    const annotation = /^\s*\*?\s*@([A-Za-z]+)\s*(.*)$/.exec(line);
    if (!annotation) continue;
    const key = annotation[1]?.toLowerCase();
    const value = annotation[2]?.trim() ?? "";
    if (key === "param") parameters.push(value);
    if (key === "command") {
      currentCommand = { name: value, arguments: [] };
      commands.push(currentCommand);
    }
    if (key === "arg" && currentCommand) currentCommand.arguments.push(value);
  }
  return {
    name,
    path: relativePath,
    configured: configuration !== undefined,
    ...(configuration
      ? {
          status: configuration.status,
          description: configuration.description
        }
      : {}),
    ...(author ? { author } : {}),
    ...(help ? { help } : {}),
    parameters,
    commands
  };
}

function annotationValue(header: string, key: string): string | undefined {
  const match = new RegExp(`^\\s*\\*?\\s*@${key}\\s+(.+)$`, "im").exec(header);
  return match?.[1]?.trim();
}

function renderPluginScaffold(input: {
  name: string;
  description: string;
  author: string;
  parameters: Record<string, string>;
  commands: NonNullable<PluginCreatePlanInput["commands"]>;
}): string {
  const parameterHeaders = Object.entries(input.parameters).flatMap(
    ([name, defaultValue]) => [
      ` * @param ${name}`,
      " * @type string",
      ` * @default ${defaultValue}`
    ]
  );
  const commandHeaders = input.commands.flatMap((command) => [
    ` * @command ${command.name}`,
    ` * @text ${command.description ?? command.name}`,
    ...(command.arguments ?? []).flatMap((argument) => [
      ` * @arg ${argument.name}`,
      ` * @type ${argument.type ?? "string"}`,
      ...(argument.description ? [` * @desc ${argument.description}`] : []),
      ...(argument.default !== undefined
        ? [` * @default ${argument.default}`]
        : [])
    ])
  ]);
  const registrations = input.commands.map(
    (command) =>
      `  PluginManager.registerCommand(pluginName, ${JSON.stringify(command.name)}, (args) => {\n` +
      `    // TODO: Implement ${command.name}. Parsed arguments are available in args.\n` +
      "    void args;\n  });"
  );
  return [
    "/*:",
    " * @target MZ",
    ` * @plugindesc ${input.description}`,
    ...(input.author ? [` * @author ${input.author}`] : []),
    ...parameterHeaders,
    ...commandHeaders,
    " * @help",
    ` * ${input.description}`,
    " */",
    "",
    "(() => {",
    '  "use strict";',
    `  const pluginName = ${JSON.stringify(input.name)};`,
    ...(registrations.length > 0 ? ["", ...registrations] : []),
    "})();",
    ""
  ].join("\n");
}

function duplicateNameWarnings(
  records: (JsonObject | null)[],
  proposed: JsonObject
): string[] {
  return typeof proposed.name === "string" &&
    records.some((record) => record?.name === proposed.name)
    ? [`Record name "${proposed.name}" already exists.`]
    : [];
}

function deepMerge(base: JsonObject, patch: JsonObject): JsonObject {
  const result: JsonObject = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) {
    const existing = result[key];
    result[key] =
      isObject(existing) && isObject(value)
        ? deepMerge(existing, value)
        : structuredClone(value);
  }
  return result;
}

function asNullableObjectArray(
  value: unknown,
  label: string
): (JsonObject | null)[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => item !== null && !isObject(item))
  ) {
    throw new ChangePlanError(
      `${label} must be an array of objects or null slots.`
    );
  }
  return value as (JsonObject | null)[];
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isObject(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function jsonContent(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assertPositiveId(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ChangePlanError(`${label} must be a positive integer.`, {
      value
    });
  }
}

function safePluginName(name: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new ChangePlanError(
      "Plugin name may only contain letters, numbers, underscores, and hyphens.",
      { name }
    );
  }
  return name;
}

function validateProposedContent(relativePath: string, source: string): void {
  if (relativePath.endsWith(".json")) {
    JSON.parse(source);
  } else if (relativePath === "js/plugins.js") {
    parsePluginConfigurations(source);
  } else if (relativePath.endsWith(".js") && source.trim().length === 0) {
    throw new ChangePlanError(`Plugin source ${relativePath} cannot be empty.`);
  }
}

async function resolveProject(
  projectRoot: string
): Promise<{ root: string; identity: string }> {
  const root = await realpath(path.resolve(projectRoot));
  await scanProject(root);
  return { root, identity: root };
}

async function resolveExistingProjectPath(
  root: string,
  relativePath: string
): Promise<string> {
  const candidate = await resolveWritableProjectPath(root, relativePath);
  const resolved = await realpath(candidate).catch(() => undefined);
  if (!resolved) throw new ChangePlanError(`${relativePath} does not exist.`);
  if (!isInside(root, resolved)) {
    throw new ValidationError(
      "Project file resolves outside the project root.",
      { relativePath }
    );
  }
  return resolved;
}

async function resolveWritableProjectPath(
  root: string,
  relativePath: string
): Promise<string> {
  if (
    path.isAbsolute(relativePath) ||
    relativePath.split(/[\\/]/).includes("..")
  ) {
    throw new ValidationError(
      "Project file path must stay inside the project root.",
      { relativePath }
    );
  }
  const absolutePath = path.resolve(root, relativePath);
  if (!isInside(root, absolutePath)) {
    throw new ValidationError("Project file path escapes the project root.", {
      relativePath
    });
  }
  const existingParent = await nearestExistingParent(
    path.dirname(absolutePath)
  );
  const resolvedParent = await realpath(existingParent);
  if (!isInside(root, resolvedParent)) {
    throw new ValidationError(
      "Project file parent resolves outside the project root.",
      { relativePath }
    );
  }
  return absolutePath;
}

async function nearestExistingParent(candidate: string): Promise<string> {
  let current = candidate;
  while (!(await pathExists(current))) {
    const parent = path.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function savePlan(root: string, plan: ProjectChangePlan): Promise<void> {
  const directory = path.join(root, ".caelis", "plans");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${plan.id}.json`),
    jsonContent(plan),
    "utf8"
  );
}

async function loadPlan(root: string, planId: string): Promise<unknown> {
  if (!/^plan_[0-9a-f-]+$/i.test(planId)) {
    throw new ChangePlanError("Invalid change plan ID.", { planId });
  }
  const planPath = await resolveExistingProjectPath(
    root,
    `.caelis/plans/${planId}.json`
  );
  return JSON.parse(await readFile(planPath, "utf8")) as unknown;
}

function assertPlanProject(
  plan: ProjectChangePlan,
  project: { root: string; identity: string }
): void {
  if (
    plan.project.root !== project.root ||
    plan.project.identity !== project.identity
  ) {
    throw new ChangePlanError("Change plan belongs to another project.", {
      planId: plan.id
    });
  }
}

function assertGenericPlanCanApply(
  plan: ProjectChangePlan,
  project: { root: string; identity: string }
): void {
  assertPlanProject(plan, project);
  if (Date.parse(plan.expiresAt) <= Date.now()) {
    throw new ChangePlanError("Change plan has expired.", { planId: plan.id });
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
  root: string,
  absoluteSourcePath: string,
  relativePath: string,
  planId: string
): Promise<string> {
  const directory = path.join(root, ".caelis", "backups");
  await mkdir(directory, { recursive: true });
  const safePath = relativePath.replaceAll(/[\\/]/g, "__");
  const timestamp = new Date()
    .toISOString()
    .replaceAll(/[:.]/g, "")
    .replace("Z", "");
  const backup = path.join(directory, `${timestamp}-${planId}-${safePath}`);
  await copyFile(absoluteSourcePath, backup);
  return backup;
}
