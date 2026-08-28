import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type {
  AdapterDetectionContext,
  PluginAdapter,
  PluginCapability
} from "@caelis/adapter-sdk";

export type VisuStellaTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface MetadataOption {
  text: string;
  value: string;
}

export interface MetadataField {
  name: string;
  text?: string;
  description?: string;
  type: string;
  default?: string;
  parent?: string;
  min?: number;
  max?: number;
  decimals?: number;
  directory?: string;
  require?: boolean;
  options: MetadataOption[];
}

export interface PluginCommandMetadata {
  name: string;
  text?: string;
  description?: string;
  arguments: MetadataField[];
}

export interface PluginHeaderMetadata {
  target?: string;
  description?: string;
  author?: string;
  url?: string;
  help?: string;
  bases: string[];
  orderAfter: string[];
  orderBefore: string[];
  parameters: MetadataField[];
  commands: PluginCommandMetadata[];
  structs: Record<string, MetadataField[]>;
}

export interface VisuStellaPluginConfiguration {
  name: string;
  status: boolean;
  description: string;
  parameters: Record<string, string>;
  position: number;
}

export interface VisuStellaPluginInspection {
  name: string;
  tier: VisuStellaTier;
  path: string;
  installed: boolean;
  configured: boolean;
  enabled: boolean;
  position?: number;
  configuration?: VisuStellaPluginConfiguration;
  metadata: PluginHeaderMetadata;
  decodedParameters: Record<string, unknown>;
}

export interface VisuStellaValidationIssue {
  severity: "error" | "warning";
  code:
    | "missing-file"
    | "not-configured"
    | "duplicate-configuration"
    | "tier-order"
    | "tier-5-risk"
    | "missing-base"
    | "disabled-base"
    | "dependency-order"
    | "parameter-decode"
    | "unknown-parameter";
  message: string;
  plugin?: string;
  parameter?: string;
}

export interface VisuStellaProjectReport {
  projectRoot: string;
  detected: boolean;
  plugins: VisuStellaPluginInspection[];
  tierCounts: Record<string, number>;
  issues: VisuStellaValidationIssue[];
  valid: boolean;
  guarantee: string;
}

const visuNamePattern = /^VisuMZ_([0-5])_.+$/i;

/** Parse public RPG Maker MZ plugin headers, including nested struct schemas. */
export function parsePluginHeaders(source: string): PluginHeaderMetadata {
  const metadata: PluginHeaderMetadata = {
    bases: [],
    orderAfter: [],
    orderBefore: [],
    parameters: [],
    commands: [],
    structs: {}
  };
  const blocks = source.match(/\/\*[\s\S]*?\*\//g) ?? [];
  for (const block of blocks) {
    const firstLine = block.split(/\r?\n/, 1)[0] ?? "";
    const structMatch = /^\/\*~struct~([^:]+):\s*$/.exec(firstLine.trim());
    if (structMatch?.[1]) {
      metadata.structs[structMatch[1]] = parseFields(block);
      continue;
    }
    if (!/^\/\*:\s*$/.test(firstLine.trim())) continue;
    parseMainHeader(block, metadata);
  }
  return metadata;
}

/** Decode an RPG Maker parameter value according to its public header type. */
export function decodeMetadataValue(
  raw: string,
  field: MetadataField,
  structs: Record<string, MetadataField[]>
): unknown {
  const type = parseType(field.type);
  if (type.array) {
    const parsed = parseJson(raw, `${field.name} array`);
    if (!Array.isArray(parsed))
      throw new Error(`${field.name} must be an array.`);
    return parsed.map((value) =>
      decodeScalar(
        typeof value === "string" ? value : JSON.stringify(value),
        type.base,
        field,
        structs
      )
    );
  }
  return decodeScalar(raw, type.base, field, structs);
}

/** Encode a typed value to the string representation expected by plugins.js. */
export function encodeMetadataValue(
  value: unknown,
  field: MetadataField,
  structs: Record<string, MetadataField[]>
): string {
  const type = parseType(field.type);
  if (type.array) {
    if (!Array.isArray(value))
      throw new Error(`${field.name} must be an array.`);
    return JSON.stringify(
      value.map((item) => encodeScalar(item, type.base, field, structs))
    );
  }
  return encodeScalar(value, type.base, field, structs);
}

/** Inspect installed/configured VisuStella plugins without executing their code. */
export async function inspectVisuStellaProject(
  projectRoot: string
): Promise<VisuStellaProjectReport> {
  const root = path.resolve(projectRoot);
  const pluginDirectory = path.join(root, "js", "plugins");
  const files = await readdir(pluginDirectory, { withFileTypes: true }).catch(
    () => []
  );
  const installedNames = files
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => path.basename(entry.name, ".js"))
    .filter(isVisuStellaPluginName);
  const configurations = await readConfigurations(root);
  const configuredNames = configurations
    .map((configuration) => configuration.name)
    .filter(isVisuStellaPluginName);
  const names = [...new Set([...installedNames, ...configuredNames])];
  const plugins = await Promise.all(
    names.map(async (name): Promise<VisuStellaPluginInspection> => {
      const configuration = configurations.find((entry) => entry.name === name);
      const installed = installedNames.includes(name);
      const source = installed
        ? await readFile(path.join(pluginDirectory, `${name}.js`), "utf8")
        : "";
      const metadata = parsePluginHeaders(source);
      return {
        name,
        tier: tierFromName(name),
        path: `js/plugins/${name}.js`,
        installed,
        configured: configuration !== undefined,
        enabled: configuration?.status ?? false,
        ...(configuration
          ? { position: configuration.position, configuration }
          : {}),
        metadata,
        decodedParameters: decodeConfiguredParameters(configuration, metadata)
      };
    })
  );
  const issues = validatePlugins(plugins, configurations);
  const tierCounts = Object.fromEntries(
    [0, 1, 2, 3, 4, 5].map((tier) => [
      String(tier),
      plugins.filter((plugin) => plugin.tier === tier).length
    ])
  );
  return {
    projectRoot: root,
    detected: plugins.length > 0,
    plugins: plugins.sort(comparePlugins),
    tierCounts,
    issues,
    valid: !issues.some((issue) => issue.severity === "error"),
    guarantee:
      "Caelis validates public metadata and RPG Maker data shape; it does not execute, decrypt, or certify proprietary plugin internals or every plugin combination."
  };
}

/** Inspect one installed or configured VisuStella plugin. */
export async function getVisuStellaPlugin(
  projectRoot: string,
  name: string
): Promise<VisuStellaPluginInspection> {
  const report = await inspectVisuStellaProject(projectRoot);
  const plugin = report.plugins.find((entry) => entry.name === name);
  if (!plugin) throw new Error(`VisuStella plugin ${name} was not found.`);
  return plugin;
}

/** Encode a typed partial parameter object for use in a guarded plugins.js plan. */
export async function encodeVisuStellaParameterPatch(
  projectRoot: string,
  name: string,
  values: Record<string, unknown>
): Promise<Record<string, string>> {
  const plugin = await getVisuStellaPlugin(projectRoot, name);
  const definitions = new Map(
    plugin.metadata.parameters.map((field) => [field.name, field])
  );
  return Object.fromEntries(
    Object.entries(values).map(([parameter, value]) => {
      const field = definitions.get(parameter);
      if (!field)
        throw new Error(`Unknown parameter ${parameter} for ${name}.`);
      return [
        parameter,
        encodeMetadataValue(value, field, plugin.metadata.structs)
      ];
    })
  );
}

/** Compile a typed VisuStella command using its public command schema. */
export async function compileVisuStellaCommand(
  projectRoot: string,
  name: string,
  commandName: string,
  values: Record<string, unknown>
): Promise<{
  code: 357;
  indent: 0;
  parameters: [string, string, string, Record<string, string>];
}> {
  const plugin = await getVisuStellaPlugin(projectRoot, name);
  const command = plugin.metadata.commands.find(
    (entry) => entry.name === commandName
  );
  if (!command) throw new Error(`Unknown command ${commandName} for ${name}.`);
  const definitions = new Map(
    command.arguments.map((field) => [field.name, field])
  );
  const unknown = Object.keys(values).find(
    (argument) => !definitions.has(argument)
  );
  if (unknown)
    throw new Error(`Unknown argument ${unknown} for ${name}:${commandName}.`);
  const args = Object.fromEntries(
    command.arguments.map((field) => {
      const value = values[field.name] ?? field.default ?? "";
      return [
        field.name,
        encodeMetadataValue(value, field, plugin.metadata.structs)
      ];
    })
  );
  return {
    code: 357,
    indent: 0,
    parameters: [name, commandName, command.text ?? commandName, args]
  };
}

const capabilities: PluginCapability[] = [
  {
    id: "visustella.parameters",
    kind: "database-records",
    displayName: "Typed VisuStella parameters"
  },
  {
    id: "visustella.commands",
    kind: "plugin-commands",
    displayName: "VisuStella plugin commands"
  },
  {
    id: "visustella.notetags",
    kind: "notetags",
    displayName: "VisuStella public notetags"
  }
];

export class VisuStellaAdapter implements PluginAdapter {
  public readonly id = "visustella-mz";
  public readonly displayName = "VisuStella MZ";

  public detect(context: AdapterDetectionContext): Promise<boolean> {
    return Promise.resolve(
      context.pluginFiles.some((file) =>
        isVisuStellaPluginName(path.basename(file, ".js"))
      )
    );
  }

  public getCapabilities(): PluginCapability[] {
    return capabilities;
  }
}

export const visuStellaAdapter = new VisuStellaAdapter();

function parseMainHeader(block: string, metadata: PluginHeaderMetadata): void {
  let command: PluginCommandMetadata | undefined;
  let field: MetadataField | undefined;
  let option: MetadataOption | undefined;
  for (const annotation of annotations(block)) {
    switch (annotation.key) {
      case "target":
        metadata.target = annotation.value;
        break;
      case "plugindesc":
        metadata.description = annotation.value;
        break;
      case "author":
        metadata.author = annotation.value;
        break;
      case "url":
        metadata.url = annotation.value;
        break;
      case "help":
        metadata.help = annotation.value;
        break;
      case "base":
        metadata.bases.push(annotation.value);
        break;
      case "orderafter":
        metadata.orderAfter.push(annotation.value);
        break;
      case "orderbefore":
        metadata.orderBefore.push(annotation.value);
        break;
      case "param":
        command = undefined;
        field = newField(annotation.value);
        metadata.parameters.push(field);
        option = undefined;
        break;
      case "command":
        command = { name: annotation.value, arguments: [] };
        metadata.commands.push(command);
        field = undefined;
        option = undefined;
        break;
      case "arg":
        if (command) {
          field = newField(annotation.value);
          command.arguments.push(field);
          option = undefined;
        }
        break;
      default:
        if (field) option = applyFieldAnnotation(field, annotation, option);
        else if (command && annotation.key === "text")
          command.text = annotation.value;
        else if (command && annotation.key === "desc")
          command.description = annotation.value;
    }
  }
}

function parseFields(block: string): MetadataField[] {
  const fields: MetadataField[] = [];
  let field: MetadataField | undefined;
  let option: MetadataOption | undefined;
  for (const annotation of annotations(block)) {
    if (annotation.key === "param") {
      field = newField(annotation.value);
      fields.push(field);
      option = undefined;
    } else if (field) {
      option = applyFieldAnnotation(field, annotation, option);
    }
  }
  return fields;
}

function annotations(block: string): { key: string; value: string }[] {
  const result: { key: string; value: string }[] = [];
  for (const line of block.split(/\r?\n/)) {
    const match = /^\s*\*?\s*@([A-Za-z]+)\s*(.*)$/.exec(line);
    if (match?.[1])
      result.push({
        key: match[1].toLowerCase(),
        value: match[2]?.trim() ?? ""
      });
  }
  return result;
}

function newField(name: string): MetadataField {
  return { name, type: "string", options: [] };
}

function applyFieldAnnotation(
  field: MetadataField,
  annotation: { key: string; value: string },
  currentOption: MetadataOption | undefined
): MetadataOption | undefined {
  switch (annotation.key) {
    case "text":
      field.text = annotation.value;
      break;
    case "desc":
      field.description = annotation.value;
      break;
    case "type":
      field.type = annotation.value || "string";
      break;
    case "default":
      field.default = annotation.value;
      break;
    case "parent":
      field.parent = annotation.value;
      break;
    case "min":
      setFiniteNumber(field, "min", annotation.value);
      break;
    case "max":
      setFiniteNumber(field, "max", annotation.value);
      break;
    case "decimals":
      setFiniteNumber(field, "decimals", annotation.value);
      break;
    case "dir":
      field.directory = annotation.value;
      break;
    case "require":
      field.require = annotation.value.toLowerCase() === "true";
      break;
    case "option": {
      const option = { text: annotation.value, value: annotation.value };
      field.options.push(option);
      return option;
    }
    case "value":
      if (currentOption) currentOption.value = annotation.value;
      break;
  }
  return currentOption;
}

function decodeScalar(
  raw: string,
  type: string,
  field: MetadataField,
  structs: Record<string, MetadataField[]>
): unknown {
  const struct = /^struct<(.+)>$/i.exec(type)?.[1];
  if (struct) {
    const value = parseJson(raw, `${field.name} struct`);
    if (!isObject(value)) throw new Error(`${field.name} must be an object.`);
    const definitions = structs[struct] ?? [];
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => {
        const definition = definitions.find((entry) => entry.name === name);
        return [
          name,
          definition && typeof item === "string"
            ? decodeMetadataValue(item, definition, structs)
            : item
        ];
      })
    );
  }
  if (isNumberType(type)) {
    const value = Number(raw);
    if (!Number.isFinite(value))
      throw new Error(`${field.name} must be numeric.`);
    return value;
  }
  if (type.toLowerCase() === "boolean") {
    if (raw !== "true" && raw !== "false")
      throw new Error(`${field.name} must be boolean.`);
    return raw === "true";
  }
  if (
    field.options.length > 0 &&
    !field.options.some((option) => option.value === raw)
  ) {
    throw new Error(`${field.name} is not one of its declared options.`);
  }
  return raw;
}

function encodeScalar(
  value: unknown,
  type: string,
  field: MetadataField,
  structs: Record<string, MetadataField[]>
): string {
  const struct = /^struct<(.+)>$/i.exec(type)?.[1];
  if (struct) {
    if (!isObject(value)) throw new Error(`${field.name} must be an object.`);
    const definitions = new Map(
      (structs[struct] ?? []).map((entry) => [entry.name, entry])
    );
    const encoded = Object.fromEntries(
      Object.entries(value).map(([name, item]) => {
        const definition = definitions.get(name);
        if (!definition)
          throw new Error(`Unknown field ${name} in struct ${struct}.`);
        return [name, encodeMetadataValue(item, definition, structs)];
      })
    );
    return JSON.stringify(encoded);
  }
  if (isNumberType(type)) {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new Error(`${field.name} must be numeric.`);
    if (field.min !== undefined && value < field.min)
      throw new Error(`${field.name} must be at least ${String(field.min)}.`);
    if (field.max !== undefined && value > field.max)
      throw new Error(`${field.name} must be at most ${String(field.max)}.`);
    return String(value);
  }
  if (type.toLowerCase() === "boolean") {
    if (typeof value !== "boolean")
      throw new Error(`${field.name} must be boolean.`);
    return String(value);
  }
  if (typeof value === "string") {
    if (
      field.options.length > 0 &&
      !field.options.some((option) => option.value === value)
    ) {
      throw new Error(`${field.name} is not one of its declared options.`);
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  throw new Error(`${field.name} must be a scalar value.`);
}

function parseType(type: string): { base: string; array: boolean } {
  const trimmed = type.trim() || "string";
  return trimmed.endsWith("[]")
    ? { base: trimmed.slice(0, -2), array: true }
    : { base: trimmed, array: false };
}

function decodeConfiguredParameters(
  configuration: VisuStellaPluginConfiguration | undefined,
  metadata: PluginHeaderMetadata
): Record<string, unknown> {
  if (!configuration) return {};
  return Object.fromEntries(
    Object.entries(configuration.parameters).map(([name, raw]) => {
      const field = metadata.parameters.find((entry) => entry.name === name);
      if (!field) return [name, raw];
      try {
        return [name, decodeMetadataValue(raw, field, metadata.structs)];
      } catch {
        return [name, raw];
      }
    })
  );
}

function validatePlugins(
  plugins: VisuStellaPluginInspection[],
  configurations: VisuStellaPluginConfiguration[]
): VisuStellaValidationIssue[] {
  const issues: VisuStellaValidationIssue[] = [];
  for (const plugin of plugins) {
    if (!plugin.installed && plugin.enabled)
      issues.push(
        issue(
          "error",
          "missing-file",
          `${plugin.name} is enabled but its JavaScript file is missing.`,
          plugin.name
        )
      );
    if (plugin.installed && !plugin.configured)
      issues.push(
        issue(
          "warning",
          "not-configured",
          `${plugin.name} is installed but absent from plugins.js.`,
          plugin.name
        )
      );
    if (plugin.enabled && plugin.tier === 5)
      issues.push(
        issue(
          "warning",
          "tier-5-risk",
          `${plugin.name} is Tier 5; compatibility must be assessed for its specific target combination.`,
          plugin.name
        )
      );
    if (!plugin.configuration) continue;
    for (const name of Object.keys(plugin.configuration.parameters)) {
      const field = plugin.metadata.parameters.find(
        (entry) => entry.name === name
      );
      if (!field) {
        issues.push({
          ...issue(
            "warning",
            "unknown-parameter",
            `${plugin.name} has a configured parameter not present in its public header: ${name}.`,
            plugin.name
          ),
          parameter: name
        });
        continue;
      }
      try {
        decodeMetadataValue(
          plugin.configuration.parameters[name] ?? "",
          field,
          plugin.metadata.structs
        );
      } catch (error) {
        issues.push({
          ...issue(
            "error",
            "parameter-decode",
            error instanceof Error ? error.message : String(error),
            plugin.name
          ),
          parameter: name
        });
      }
    }
  }
  const duplicates = configurations.filter(
    (entry, index) =>
      configurations.findIndex((other) => other.name === entry.name) !==
        index && isVisuStellaPluginName(entry.name)
  );
  for (const duplicate of duplicates)
    issues.push(
      issue(
        "error",
        "duplicate-configuration",
        `${duplicate.name} appears more than once in plugins.js.`,
        duplicate.name
      )
    );
  const enabled = plugins
    .filter((plugin) => plugin.enabled && plugin.position !== undefined)
    .sort(comparePlugins);
  for (let index = 1; index < enabled.length; index += 1) {
    const previous = enabled[index - 1];
    const current = enabled[index];
    if (previous && current && previous.tier > current.tier)
      issues.push(
        issue(
          "error",
          "tier-order",
          `${current.name} (Tier ${String(current.tier)}) must be above ${previous.name} (Tier ${String(previous.tier)}).`,
          current.name
        )
      );
  }
  const byName = new Map(plugins.map((plugin) => [plugin.name, plugin]));
  for (const plugin of enabled) {
    for (const base of plugin.metadata.bases)
      validateDependency(issues, plugin, base, byName);
    for (const after of plugin.metadata.orderAfter)
      validateOrder(issues, plugin, after, byName, "after");
    for (const before of plugin.metadata.orderBefore)
      validateOrder(issues, plugin, before, byName, "before");
  }
  return issues;
}

function validateDependency(
  issues: VisuStellaValidationIssue[],
  plugin: VisuStellaPluginInspection,
  baseName: string,
  plugins: Map<string, VisuStellaPluginInspection>
): void {
  const base = plugins.get(baseName);
  if (!base?.configured)
    issues.push(
      issue(
        "error",
        "missing-base",
        `${plugin.name} requires ${baseName}.`,
        plugin.name
      )
    );
  else if (!base.enabled)
    issues.push(
      issue(
        "error",
        "disabled-base",
        `${plugin.name} requires enabled base plugin ${baseName}.`,
        plugin.name
      )
    );
  else if ((base.position ?? Infinity) > (plugin.position ?? -1))
    issues.push(
      issue(
        "error",
        "dependency-order",
        `${baseName} must be above ${plugin.name}.`,
        plugin.name
      )
    );
}

function validateOrder(
  issues: VisuStellaValidationIssue[],
  plugin: VisuStellaPluginInspection,
  otherName: string,
  plugins: Map<string, VisuStellaPluginInspection>,
  relation: "after" | "before"
): void {
  const other = plugins.get(otherName);
  if (
    !other?.enabled ||
    other.position === undefined ||
    plugin.position === undefined
  )
    return;
  const valid =
    relation === "after"
      ? plugin.position > other.position
      : plugin.position < other.position;
  if (!valid)
    issues.push(
      issue(
        "error",
        "dependency-order",
        `${plugin.name} must load ${relation} ${otherName}.`,
        plugin.name
      )
    );
}

function issue(
  severity: "error" | "warning",
  code: VisuStellaValidationIssue["code"],
  message: string,
  plugin?: string
): VisuStellaValidationIssue {
  return { severity, code, message, ...(plugin ? { plugin } : {}) };
}

function comparePlugins(
  a: VisuStellaPluginInspection,
  b: VisuStellaPluginInspection
): number {
  return (
    (a.position ?? Number.MAX_SAFE_INTEGER) -
      (b.position ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)
  );
}

function isVisuStellaPluginName(name: string): boolean {
  return visuNamePattern.test(name);
}

function tierFromName(name: string): VisuStellaTier {
  const value = Number(visuNamePattern.exec(name)?.[1]);
  if (!Number.isInteger(value) || value < 0 || value > 5)
    throw new Error(`${name} is not a VisuStella MZ plugin filename.`);
  return value as VisuStellaTier;
}

async function readConfigurations(
  root: string
): Promise<VisuStellaPluginConfiguration[]> {
  const source = await readFile(path.join(root, "js", "plugins.js"), "utf8");
  const start = source.indexOf("[");
  const end = source.lastIndexOf("]");
  if (start < 0 || end < start)
    throw new Error("js/plugins.js does not contain a plugin array.");
  const parsed: unknown = JSON.parse(source.slice(start, end + 1));
  if (!Array.isArray(parsed))
    throw new Error("js/plugins.js plugin configuration must be an array.");
  return parsed.flatMap((value, position): VisuStellaPluginConfiguration[] => {
    if (!isObject(value) || typeof value.name !== "string") return [];
    const rawParameters = isObject(value.parameters) ? value.parameters : {};
    const parameters = Object.fromEntries(
      Object.entries(rawParameters).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    );
    return [
      {
        name: value.name,
        status: typeof value.status === "boolean" ? value.status : false,
        description:
          typeof value.description === "string" ? value.description : "",
        parameters,
        position
      }
    ];
  });
}

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} contains invalid JSON.`);
  }
}

function finiteNumber(value: string): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function setFiniteNumber(
  field: MetadataField,
  key: "min" | "max" | "decimals",
  raw: string
): void {
  const value = finiteNumber(raw);
  if (value !== undefined) field[key] = value;
}

function isNumberType(type: string): boolean {
  return [
    "number",
    "actor",
    "class",
    "skill",
    "item",
    "weapon",
    "armor",
    "enemy",
    "troop",
    "state",
    "animation",
    "tileset",
    "common_event",
    "switch",
    "variable"
  ].includes(type.toLowerCase());
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
