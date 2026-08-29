import {
  compilePluginCommand,
  discoverPluginDocumentation,
  encodePluginParameterPatch,
  getPluginProfile,
  inspectPluginProject,
  scanPluginUsage
} from "@caelis/plugin-intelligence";
import { configurePluginPlan, type JsonObject } from "@caelis/project-write";
import { z } from "zod";

const projectRoot = z.string().min(1);
const pluginName = z.string().min(1);
const commandName = z.string().min(1);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const pluginInventoryShape = { projectRoot };
export const pluginInspectShape = { projectRoot, name: pluginName };
export const pluginValidateShape = { projectRoot };
export const pluginUsageScanShape = {
  projectRoot,
  name: pluginName.optional()
};
export const pluginDependencyGraphShape = { projectRoot };
export const pluginParameterGetShape = { projectRoot, name: pluginName };
export const pluginParameterUpdatePlanShape = {
  projectRoot,
  name: pluginName,
  values: jsonObjectSchema
};
export const pluginCommandListShape = { projectRoot, name: pluginName };
export const pluginCommandDescribeShape = {
  projectRoot,
  name: pluginName,
  commandName
};
export const pluginCommandCompileShape = {
  projectRoot,
  name: pluginName,
  commandName,
  args: jsonObjectSchema
};
export const pluginDocumentationSourcesShape = {
  projectRoot,
  name: pluginName
};

export async function pluginInventoryTool(input: {
  projectRoot: string;
}): Promise<unknown> {
  return inspectPluginProject(input.projectRoot);
}

export async function pluginInspectTool(input: {
  projectRoot: string;
  name: string;
}): Promise<unknown> {
  return getPluginProfile(input.projectRoot, input.name);
}

export async function pluginValidateTool(input: {
  projectRoot: string;
}): Promise<unknown> {
  return inspectPluginProject(input.projectRoot);
}

export async function pluginUsageScanTool(input: {
  projectRoot: string;
  name?: string | undefined;
}): Promise<unknown> {
  return scanPluginUsage(input.projectRoot, input.name);
}

export async function pluginDependencyGraphTool(input: {
  projectRoot: string;
}): Promise<unknown> {
  return dependencyGraph(await inspectPluginProject(input.projectRoot));
}

export async function pluginParameterGetTool(input: {
  projectRoot: string;
  name: string;
}): Promise<unknown> {
  return pluginParameters(
    await getPluginProfile(input.projectRoot, input.name)
  );
}

export async function pluginParameterUpdatePlanTool(input: {
  projectRoot: string;
  name: string;
  values: JsonObject;
}): Promise<unknown> {
  const parameters = await encodePluginParameterPatch(
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

export async function pluginCommandListTool(input: {
  projectRoot: string;
  name: string;
}): Promise<unknown> {
  return pluginCommands(await getPluginProfile(input.projectRoot, input.name));
}

export async function pluginCommandDescribeTool(input: {
  projectRoot: string;
  name: string;
  commandName: string;
}): Promise<unknown> {
  const command = pluginCommands(
    await getPluginProfile(input.projectRoot, input.name)
  ).find((entry) => commandNameOf(entry) === input.commandName);
  if (!command)
    throw new Error(
      `Plugin command ${input.commandName} was not found for ${input.name}.`
    );
  return command;
}

export async function pluginCommandCompileTool(input: {
  projectRoot: string;
  name: string;
  commandName: string;
  args: JsonObject;
}): Promise<unknown> {
  return compilePluginCommand(
    input.projectRoot,
    input.name,
    input.commandName,
    input.args
  );
}

export async function pluginDocumentationSourcesTool(input: {
  projectRoot: string;
  name: string;
}): Promise<unknown> {
  return discoverPluginDocumentation(input.projectRoot, input.name);
}

function pluginParameters(profile: unknown): unknown {
  const record = asRecord(profile);
  return {
    definitions: asRecord(record.metadata).parameters,
    configured: record.decodedParameters ?? record.parameters,
    raw: asRecord(record.configuration).parameters
  };
}

function pluginCommands(profile: unknown): unknown[] {
  const record = asRecord(profile);
  const metadata = asRecord(record.metadata);
  const commands = metadata.commands ?? record.commands;
  return Array.isArray(commands) ? commands : [];
}

function commandNameOf(command: unknown): string | undefined {
  const record = asRecord(command);
  return typeof record.name === "string" ? record.name : undefined;
}

function dependencyGraph(report: unknown): unknown {
  const reportRecord = asRecord(report);
  if (reportRecord.dependencyGraph !== undefined)
    return reportRecord.dependencyGraph;
  const plugins = Array.isArray(reportRecord.profiles)
    ? reportRecord.profiles
    : [];
  const nodes = plugins.map((plugin) => {
    const record = asRecord(plugin);
    return {
      name: record.name,
      enabled: record.enabled,
      configured: record.configured,
      position: record.position
    };
  });
  const edges = plugins.flatMap((plugin) => {
    const record = asRecord(plugin);
    const metadata = asRecord(record.metadata);
    const name = typeof record.name === "string" ? record.name : undefined;
    if (!name) return [];
    return [
      ...dependencyEdges(metadata.bases, name, "base"),
      ...dependencyEdges(metadata.orderAfter, name, "after"),
      ...dependencyEdges(metadata.orderBefore, name, "before")
    ];
  });
  return { nodes, edges };
}

function dependencyEdges(
  values: unknown,
  plugin: string,
  relation: "base" | "after" | "before"
): { from: string; to: string; relation: string }[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string")
    .map((dependency) =>
      relation === "before"
        ? { from: plugin, to: dependency, relation }
        : { from: dependency, to: plugin, relation }
    );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
