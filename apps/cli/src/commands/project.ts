import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  compileVisuStellaCommand,
  encodeVisuStellaParameterPatch,
  getVisuStellaPlugin,
  inspectVisuStellaProject
} from "@caelis/adapter-visustella";
import { compileEventCommands, type EventNode } from "@caelis/events";
import {
  compilePluginCommand,
  discoverPluginDocumentation,
  encodePluginParameterPatch,
  getPluginProfile,
  inspectPluginProject,
  scanPluginUsage
} from "@caelis/plugin-intelligence";
import {
  applyChangePlan,
  configurePluginPlan,
  createDatabaseRecordPlan,
  createPluginPlan,
  databaseCollections,
  getChangePlan,
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
  type JsonObject,
  type PluginCreatePlanInput
} from "@caelis/project-write";
import type { Command } from "commander";

interface JsonFileOption {
  json: string;
}
interface ReplaceOption {
  replace?: boolean;
}

/** Register project data, map event, plan, event compiler, and plugin commands. */
export function registerProjectCommands(program: Command): void {
  registerPlanCommands(program);
  registerDatabaseCommands(program);
  registerSystemCommands(program);
  registerMapCommands(program);
  registerEventCommands(program);
  registerPluginCommands(program);
  registerVisuStellaCommands(program);
  registerGeneratorCommands(program);
}

function registerPlanCommands(program: Command): void {
  const plan = program
    .command("plan")
    .description("Review and apply guarded Caelis change plans.");
  plan
    .command("get")
    .argument("<planId>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .action(async (planId: string, projectPath: string) => {
      printJson(await getChangePlan({ projectRoot: projectPath, planId }));
    });
  plan
    .command("apply")
    .argument("<planId>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .requiredOption("--confirm", "confirm the reviewed plan")
    .action(async (planId: string, projectPath: string) => {
      printJson(
        await applyChangePlan({
          projectRoot: projectPath,
          planId,
          confirm: true
        })
      );
    });
}

function registerDatabaseCommands(program: Command): void {
  const database = program
    .command("database")
    .description(
      "Inspect and plan changes to every RPG Maker MZ database collection."
    );
  database.command("collections").action(() => {
    printJson(databaseCollections);
  });
  database
    .command("list")
    .argument("<collection>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .option("--include-empty", "include null record slots")
    .action(
      async (
        collection: string,
        projectPath: string,
        options: { includeEmpty?: boolean }
      ) => {
        const records = await listDatabaseRecords(
          projectPath,
          parseCollection(collection)
        );
        printJson(options.includeEmpty ? records : records.filter(Boolean));
      }
    );
  database
    .command("get")
    .argument("<collection>")
    .argument("<id>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .action(async (collection: string, id: string, projectPath: string) => {
      printJson(
        await getDatabaseRecord(
          projectPath,
          parseCollection(collection),
          positiveInteger(id, "record ID")
        )
      );
    });
  database
    .command("create-plan")
    .argument("<collection>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .requiredOption("--json <json-or-@file>", "record JSON object or @file")
    .option(
      "--template <id>",
      "clone an existing record before applying fields"
    )
    .action(
      async (
        collection: string,
        projectPath: string,
        options: JsonFileOption & { template?: string }
      ) => {
        printJson(
          await createDatabaseRecordPlan({
            projectRoot: projectPath,
            collection: parseCollection(collection),
            record: await readJsonObject(options.json),
            ...(options.template
              ? { templateId: positiveInteger(options.template, "template ID") }
              : {})
          })
        );
      }
    );
  database
    .command("update-plan")
    .argument("<collection>")
    .argument("<id>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .requiredOption("--json <json-or-@file>", "patch JSON object or @file")
    .option(
      "--replace",
      "replace the full record rather than recursively merging"
    )
    .action(
      async (
        collection: string,
        id: string,
        projectPath: string,
        options: JsonFileOption & ReplaceOption
      ) => {
        printJson(
          await updateDatabaseRecordPlan({
            projectRoot: projectPath,
            collection: parseCollection(collection),
            id: positiveInteger(id, "record ID"),
            patch: await readJsonObject(options.json),
            ...(options.replace ? { replace: true } : {})
          })
        );
      }
    );
}

function registerSystemCommands(program: Command): void {
  const system = program
    .command("system")
    .description(
      "Inspect or plan changes to System.json, Types, Terms, switches and variables."
    );
  system
    .command("get")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .action(async (projectPath: string) => {
      printJson(await getSystemData(projectPath));
    });
  system
    .command("update-plan")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .requiredOption("--json <json-or-@file>", "patch JSON object or @file")
    .option("--replace", "replace all System.json data")
    .action(
      async (projectPath: string, options: JsonFileOption & ReplaceOption) => {
        printJson(
          await updateSystemPlan({
            projectRoot: projectPath,
            patch: await readJsonObject(options.json),
            ...(options.replace ? { replace: true } : {})
          })
        );
      }
    );
}

function registerMapCommands(program: Command): void {
  const map = program
    .command("map")
    .description("Inspect maps and plan multi-page map event changes.");
  map
    .command("get")
    .argument("<mapId>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .action(async (mapId: string, projectPath: string) => {
      printJson(
        await getMapData(projectPath, positiveInteger(mapId, "map ID"))
      );
    });
  map
    .command("event-get")
    .argument("<mapId>")
    .argument("<eventId>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .action(async (mapId: string, eventId: string, projectPath: string) => {
      printJson(
        await getMapEvent(
          projectPath,
          positiveInteger(mapId, "map ID"),
          positiveInteger(eventId, "event ID")
        )
      );
    });
  map
    .command("event-upsert-plan")
    .argument("<mapId>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .requiredOption("--json <json-or-@file>", "event JSON object or @file")
    .option("--event-id <id>", "existing event ID to update")
    .option(
      "--replace",
      "replace the full event rather than recursively merging"
    )
    .action(
      async (
        mapId: string,
        projectPath: string,
        options: JsonFileOption & ReplaceOption & { eventId?: string }
      ) => {
        printJson(
          await upsertMapEventPlan({
            projectRoot: projectPath,
            mapId: positiveInteger(mapId, "map ID"),
            ...(options.eventId
              ? { eventId: positiveInteger(options.eventId, "event ID") }
              : {}),
            event: await readJsonObject(options.json),
            ...(options.replace ? { replace: true } : {})
          })
        );
      }
    );
}

function registerEventCommands(program: Command): void {
  program
    .command("event-compile")
    .requiredOption(
      "--json <json-or-@file>",
      "JSON array of Caelis event AST nodes or @file"
    )
    .description("Compile event AST nodes to RPG Maker MZ command objects.")
    .action(async (options: JsonFileOption) => {
      const nodes = await readJson(options.json);
      if (!Array.isArray(nodes))
        throw new Error("Event AST input must be a JSON array.");
      printJson(compileEventCommands(nodes as EventNode[]));
    });
}

function registerPluginCommands(program: Command): void {
  const plugin = program
    .command("plugin")
    .description(
      "Inspect, validate, configure and create RPG Maker MZ plugins without executing them."
    );
  plugin
    .command("inventory")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description("Inventory installed and configured plugins from public data.")
    .action(async (projectPath: string) => {
      printJson(await inspectPluginProject(projectPath));
    });
  plugin
    .command("inspect")
    .argument("<name>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description(
      "Inspect one plugin's public profile and current configuration."
    )
    .action(async (name: string, projectPath: string) => {
      printJson(await getPluginProfile(projectPath, name));
    });
  plugin
    .command("validate")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description(
      "Validate plugin files, configuration, and public dependencies."
    )
    .action(async (projectPath: string) => {
      printJson(await inspectPluginProject(projectPath));
    });
  plugin
    .command("usage")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .option("--name <name>", "limit the scan to one plugin")
    .description("Scan project event data for plugin command usage.")
    .action(async (projectPath: string, options: { name?: string }) => {
      printJson(await scanPluginUsage(projectPath, options.name));
    });
  plugin
    .command("graph")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description("Show the public plugin dependency graph.")
    .action(async (projectPath: string) => {
      printJson(dependencyGraph(await inspectPluginProject(projectPath)));
    });
  const params = plugin
    .command("params")
    .description("Inspect and safely plan typed plugin parameter updates.");
  params
    .command("get")
    .argument("<name>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description(
      "Show a plugin's public parameter definitions and configured values."
    )
    .action(async (name: string, projectPath: string) => {
      printJson(pluginParameters(await getPluginProfile(projectPath, name)));
    });
  params
    .command("plan")
    .argument("<name>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .requiredOption(
      "--values <json-or-@file>",
      "typed partial parameter object"
    )
    .description(
      "Encode a typed parameter patch, then create a guarded plugins.js change plan."
    )
    .action(
      async (
        name: string,
        projectPath: string,
        options: { values: string }
      ) => {
        const parameters = await encodePluginParameterPatch(
          projectPath,
          name,
          await readJsonObject(options.values)
        );
        printJson(
          await configurePluginPlan({
            projectRoot: projectPath,
            name,
            parameters
          })
        );
      }
    );
  const commands = plugin
    .command("commands")
    .description("Inspect and compile public plugin commands.");
  commands
    .command("list")
    .argument("<name>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description("List a plugin's public command definitions.")
    .action(async (name: string, projectPath: string) => {
      printJson(pluginCommands(await getPluginProfile(projectPath, name)));
    });
  commands
    .command("describe")
    .argument("<name>")
    .argument("<commandName>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description("Describe one public plugin command and its typed arguments.")
    .action(async (name: string, commandName: string, projectPath: string) => {
      const command = pluginCommands(
        await getPluginProfile(projectPath, name)
      ).find((entry) => commandNameOf(entry) === commandName);
      if (!command)
        throw new Error(
          `Plugin command ${commandName} was not found for ${name}.`
        );
      printJson(command);
    });
  commands
    .command("compile")
    .argument("<name>")
    .argument("<commandName>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .requiredOption("--args <json-or-@file>", "typed command argument object")
    .description(
      "Validate and compile a plugin command to RPG Maker event code 357."
    )
    .action(
      async (
        name: string,
        commandName: string,
        projectPath: string,
        options: { args: string }
      ) => {
        printJson(
          await compilePluginCommand(
            projectPath,
            name,
            commandName,
            await readJsonObject(options.args)
          )
        );
      }
    );
  const docs = plugin
    .command("docs")
    .description(
      "Discover local and public documentation sources for a plugin."
    );
  docs
    .command("discover")
    .argument("<name>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description(
      "Discover documentation sources declared by a plugin's public metadata."
    )
    .action(async (name: string, projectPath: string) => {
      printJson(await discoverPluginDocumentation(projectPath, name));
    });
  plugin
    .command("list")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .action(async (projectPath: string) => {
      printJson(await listPlugins(projectPath));
    });
  plugin
    .command("get")
    .argument("<name>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .action(async (name: string, projectPath: string) => {
      printJson(await getPluginMetadata(projectPath, name));
    });
  plugin
    .command("configure-plan")
    .argument("<name>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .option("--enable", "enable the plugin")
    .option("--disable", "disable the plugin")
    .option("--parameters <json-or-@file>", "string-valued parameter object")
    .option("--description <text>")
    .option("--position <index>")
    .action(
      async (
        name: string,
        projectPath: string,
        options: {
          enable?: boolean;
          disable?: boolean;
          parameters?: string;
          description?: string;
          position?: string;
        }
      ) => {
        if (options.enable && options.disable)
          throw new Error("Choose either --enable or --disable.");
        printJson(
          await configurePluginPlan({
            projectRoot: projectPath,
            name,
            ...(options.enable || options.disable
              ? { status: !!options.enable }
              : {}),
            ...(options.parameters
              ? { parameters: await readStringRecord(options.parameters) }
              : {}),
            ...(options.description !== undefined
              ? { description: options.description }
              : {}),
            ...(options.position
              ? { position: nonnegativeInteger(options.position, "position") }
              : {})
          })
        );
      }
    );
  plugin
    .command("create-plan")
    .argument("<name>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .option("--spec <json-or-@file>", "plugin scaffold options as JSON")
    .option("--source <@file>", "complete plugin JavaScript source file")
    .action(
      async (
        name: string,
        projectPath: string,
        options: { spec?: string; source?: string }
      ) => {
        const spec = options.spec ? await readJsonObject(options.spec) : {};
        const source = options.source
          ? await readSourceFile(options.source)
          : undefined;
        printJson(
          await createPluginPlan({
            ...(spec as Omit<PluginCreatePlanInput, "projectRoot" | "name">),
            projectRoot: projectPath,
            name,
            ...(source !== undefined ? { source } : {})
          })
        );
      }
    );
}

function pluginParameters(profile: unknown): unknown {
  const record = asRecord(profile);
  return {
    definitions: record.metadata && asRecord(record.metadata).parameters,
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

function registerVisuStellaCommands(program: Command): void {
  const visuStella = program
    .command("visustella")
    .description(
      "Inspect and safely configure installed VisuStella MZ plugins from public metadata."
    );
  visuStella
    .command("status")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description(
      "Validate tiers, dependencies, ordering and configured parameter encoding."
    )
    .action(async (projectPath: string) => {
      printJson(await inspectVisuStellaProject(projectPath));
    });
  visuStella
    .command("get")
    .argument("<name>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .description(
      "Inspect typed parameters, structs, commands and dependencies."
    )
    .action(async (name: string, projectPath: string) => {
      printJson(await getVisuStellaPlugin(projectPath, name));
    });
  visuStella
    .command("parameter-plan")
    .argument("<name>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .requiredOption(
      "--values <json-or-@file>",
      "typed partial parameter object"
    )
    .description(
      "Validate and encode nested parameter values, then create a guarded plugins.js plan."
    )
    .action(
      async (
        name: string,
        projectPath: string,
        options: { values: string }
      ) => {
        const values = await readJsonObject(options.values);
        const parameters = await encodeVisuStellaParameterPatch(
          projectPath,
          name,
          values
        );
        printJson(
          await configurePluginPlan({
            projectRoot: projectPath,
            name,
            parameters
          })
        );
      }
    );
  visuStella
    .command("command-compile")
    .argument("<name>")
    .argument("<commandName>")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .requiredOption("--args <json-or-@file>", "typed command argument object")
    .description("Compile a typed plugin command to RPG Maker event code 357.")
    .action(
      async (
        name: string,
        commandName: string,
        projectPath: string,
        options: { args: string }
      ) => {
        printJson(
          await compileVisuStellaCommand(
            projectPath,
            name,
            commandName,
            await readJsonObject(options.args)
          )
        );
      }
    );
}

function registerGeneratorCommands(program: Command): void {
  const generator = program
    .command("generator")
    .description(
      "Locate or launch RPG Maker MZ's built-in Character Generator."
    );
  generator
    .command("status")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .option("--editor <path>", "RPG Maker MZ executable or macOS app path")
    .action(async (projectPath: string, options: { editor?: string }) => {
      printJson(await getCharacterGeneratorStatus(projectPath, options.editor));
    });
  generator
    .command("open")
    .argument("[projectPath]", "RPG Maker MZ project path", ".")
    .option("--editor <path>", "RPG Maker MZ executable or macOS app path")
    .requiredOption("--confirm", "confirm launching the editor")
    .action(async (projectPath: string, options: { editor?: string }) => {
      printJson(
        await launchCharacterGenerator({
          projectRoot: projectPath,
          ...(options.editor ? { editorPath: options.editor } : {}),
          confirm: true
        })
      );
    });
}

function parseCollection(value: string): DatabaseCollection {
  const match = databaseCollections.find(
    (collection) => collection.toLowerCase() === value.toLowerCase()
  );
  if (!match)
    throw new Error(
      `Unknown database collection ${value}. Use: ${databaseCollections.join(", ")}`
    );
  return match;
}

async function readJsonObject(value: string): Promise<JsonObject> {
  const parsed = await readJson(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error("Expected a JSON object.");
  return parsed as JsonObject;
}

async function readStringRecord(
  value: string
): Promise<Record<string, string>> {
  const parsed = await readJsonObject(value);
  if (Object.values(parsed).some((item) => typeof item !== "string"))
    throw new Error("Plugin parameter values must be strings.");
  return parsed as Record<string, string>;
}

async function readJson(value: string): Promise<unknown> {
  return JSON.parse(
    value.startsWith("@")
      ? await readFile(path.resolve(value.slice(1)), "utf8")
      : value
  ) as unknown;
}

async function readSourceFile(value: string): Promise<string> {
  if (!value.startsWith("@"))
    throw new Error("--source expects @path/to/plugin.js");
  return readFile(path.resolve(value.slice(1)), "utf8");
}

function positiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function nonnegativeInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0)
    throw new Error(`${label} must be a non-negative integer.`);
  return parsed;
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}
