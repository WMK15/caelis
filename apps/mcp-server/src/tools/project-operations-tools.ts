import {
  compileVisuStellaCommand,
  encodeVisuStellaParameterPatch,
  getVisuStellaPlugin,
  inspectVisuStellaProject
} from "@caelis/adapter-visustella";
import { compileEventCommands, type EventNode } from "@caelis/events";
import {
  configurePluginPlan,
  createDatabaseRecordPlan,
  createPluginPlan,
  databaseCollections,
  getDatabaseRecord,
  getCharacterGeneratorStatus,
  getMapData,
  getMapEvent,
  getPluginMetadata,
  getSystemData,
  listDatabaseRecords,
  listPlugins,
  launchCharacterGenerator,
  updateDatabaseRecordPlan,
  updateSystemPlan,
  upsertMapEventPlan,
  type DatabaseCollection,
  type JsonObject
} from "@caelis/project-write";
import { z } from "zod";

const jsonObjectSchema = z.record(z.string(), z.unknown());
const collectionSchema = z.enum(databaseCollections);
const projectRoot = z.string().min(1);
const positiveId = z.number().int().positive();

export const databaseListShape = {
  projectRoot,
  collection: collectionSchema,
  includeEmpty: z.boolean().optional()
};
export const databaseGetShape = {
  projectRoot,
  collection: collectionSchema,
  id: positiveId
};
export const databaseCreatePlanShape = {
  projectRoot,
  collection: collectionSchema,
  record: jsonObjectSchema,
  templateId: positiveId.optional()
};
export const databaseUpdatePlanShape = {
  projectRoot,
  collection: collectionSchema,
  id: positiveId,
  patch: jsonObjectSchema,
  replace: z.boolean().optional()
};
export const systemGetShape = { projectRoot };
export const systemUpdatePlanShape = {
  projectRoot,
  patch: jsonObjectSchema,
  replace: z.boolean().optional()
};
export const mapGetShape = { projectRoot, mapId: positiveId };
export const mapEventGetShape = {
  projectRoot,
  mapId: positiveId,
  eventId: positiveId
};
export const mapEventUpsertPlanShape = {
  projectRoot,
  mapId: positiveId,
  eventId: positiveId.optional(),
  event: jsonObjectSchema,
  replace: z.boolean().optional()
};
export const eventCompileShape = { nodes: z.array(jsonObjectSchema) };
export const pluginListShape = { projectRoot };
export const pluginGetShape = { projectRoot, name: z.string().min(1) };
export const pluginConfigurePlanShape = {
  projectRoot,
  name: z.string().min(1),
  status: z.boolean().optional(),
  parameters: z.record(z.string(), z.string()).optional(),
  description: z.string().optional(),
  position: z.number().int().nonnegative().optional()
};
const pluginArgumentSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean"]).optional(),
  description: z.string().optional(),
  default: z.string().optional()
});
const pluginCommandSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  arguments: z.array(pluginArgumentSchema).optional()
});
export const pluginCreatePlanShape = {
  ...pluginConfigurePlanShape,
  source: z.string().min(1).optional(),
  author: z.string().optional(),
  commands: z.array(pluginCommandSchema).optional()
};
export const visuStellaStatusShape = { projectRoot };
export const visuStellaGetShape = {
  projectRoot,
  name: z.string().min(1)
};
export const visuStellaParameterPlanShape = {
  projectRoot,
  name: z.string().min(1),
  values: jsonObjectSchema
};
export const visuStellaCommandCompileShape = {
  projectRoot,
  name: z.string().min(1),
  commandName: z.string().min(1),
  args: jsonObjectSchema
};
export const characterGeneratorStatusShape = {
  projectRoot,
  editorPath: z.string().min(1).optional()
};
export const characterGeneratorLaunchShape = {
  ...characterGeneratorStatusShape,
  confirm: z.literal(true)
};

export async function databaseListTool(input: {
  projectRoot: string;
  collection: DatabaseCollection;
  includeEmpty?: boolean | undefined;
}): Promise<unknown> {
  const records = await listDatabaseRecords(
    input.projectRoot,
    input.collection
  );
  return input.includeEmpty
    ? records
    : records.filter((record) => record !== null);
}

export async function databaseGetTool(input: {
  projectRoot: string;
  collection: DatabaseCollection;
  id: number;
}): Promise<unknown> {
  return getDatabaseRecord(input.projectRoot, input.collection, input.id);
}

export async function databaseCreatePlanTool(input: {
  projectRoot: string;
  collection: DatabaseCollection;
  record: JsonObject;
  templateId?: number | undefined;
}): Promise<unknown> {
  return createDatabaseRecordPlan(input);
}

export async function databaseUpdatePlanTool(input: {
  projectRoot: string;
  collection: DatabaseCollection;
  id: number;
  patch: JsonObject;
  replace?: boolean | undefined;
}): Promise<unknown> {
  return updateDatabaseRecordPlan(input);
}

export function eventCompileTool(input: { nodes: JsonObject[] }): unknown {
  return compileEventCommands(input.nodes as unknown as EventNode[]);
}

export {
  configurePluginPlan as pluginConfigurePlanTool,
  createPluginPlan as pluginCreatePlanTool,
  getMapData as mapGetTool,
  getMapEvent as mapEventGetTool,
  getPluginMetadata as pluginGetTool,
  getSystemData as systemGetTool,
  listPlugins as pluginListTool,
  updateSystemPlan as systemUpdatePlanTool,
  upsertMapEventPlan as mapEventUpsertPlanTool
};

export async function characterGeneratorStatusTool(input: {
  projectRoot: string;
  editorPath?: string | undefined;
}): Promise<unknown> {
  return getCharacterGeneratorStatus(input.projectRoot, input.editorPath);
}

export async function characterGeneratorLaunchTool(input: {
  projectRoot: string;
  editorPath?: string | undefined;
  confirm: true;
}): Promise<unknown> {
  return launchCharacterGenerator(input);
}

export async function visuStellaStatusTool(input: {
  projectRoot: string;
}): Promise<unknown> {
  return inspectVisuStellaProject(input.projectRoot);
}

export async function visuStellaGetTool(input: {
  projectRoot: string;
  name: string;
}): Promise<unknown> {
  return getVisuStellaPlugin(input.projectRoot, input.name);
}

export async function visuStellaParameterPlanTool(input: {
  projectRoot: string;
  name: string;
  values: JsonObject;
}): Promise<unknown> {
  const parameters = await encodeVisuStellaParameterPatch(
    input.projectRoot,
    input.name,
    input.values
  );
  return configurePluginPlan({
    projectRoot: input.projectRoot,
    name: input.name,
    parameters
  });
}

export async function visuStellaCommandCompileTool(input: {
  projectRoot: string;
  name: string;
  commandName: string;
  args: JsonObject;
}): Promise<unknown> {
  return compileVisuStellaCommand(
    input.projectRoot,
    input.name,
    input.commandName,
    input.args
  );
}
