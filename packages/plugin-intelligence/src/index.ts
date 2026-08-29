import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

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

export interface PluginHeaderLocale {
  description?: string;
  help?: string;
  parameters: Record<string, Pick<MetadataField, "text" | "description">>;
  commands: Record<string, Pick<PluginCommandMetadata, "text" | "description">>;
}

/** Public metadata declared in RPG Maker MZ comment headers. */
export interface PluginHeaderMetadata {
  target?: string;
  description?: string;
  author?: string;
  url?: string;
  help?: string;
  bases: string[];
  dependencies: string[];
  orderAfter: string[];
  orderBefore: string[];
  parameters: MetadataField[];
  commands: PluginCommandMetadata[];
  structs: Record<string, MetadataField[]>;
  locales: Record<string, PluginHeaderLocale>;
}

export interface PluginConfiguration {
  name: string;
  status: boolean;
  description: string;
  parameters: Record<string, string>;
  position: number;
}

export type EvidenceSourceKind =
  | "file-system"
  | "plugins-js"
  | "public-mz-header"
  | "static-js-literal"
  | "static-json-scan"
  | "static-documentation";

export type EvidenceLabel = "declared" | "observed" | "documented" | "inferred";

export interface Evidence {
  label: EvidenceLabel;
  sourceKind: EvidenceSourceKind;
  detail: string;
}

/** A safe, literal-only observation from code. No code is parsed or run. */
export interface StaticPluginObservation {
  kind: "registered-command" | "parameter-access" | "version" | "url";
  plugin?: string;
  commandName?: string;
  value?: string;
  evidence: Evidence;
}

export interface PluginIssue {
  severity: "error" | "warning";
  code:
    | "missing-file"
    | "not-configured"
    | "duplicate-configuration"
    | "missing-dependency"
    | "disabled-dependency"
    | "dependency-order"
    | "parameter-decode"
    | "unknown-parameter"
    | "invalid-configuration";
  message: string;
  plugin?: string;
  parameter?: string;
}

/** A source-free profile derived without evaluating plugin JavaScript. */
export interface PluginProfile {
  name: string;
  installed: boolean;
  configured: boolean;
  enabled: boolean;
  position?: number;
  file?: { path: string; sha256: string };
  configurationFile?: { path: string; sha256: string };
  configuration?: PluginConfiguration;
  metadata: PluginHeaderMetadata;
  observations: StaticPluginObservation[];
  decodedParameters: Record<string, unknown>;
  evidence: Evidence[];
  issues: PluginIssue[];
}

export interface PluginProjectInspection {
  projectRoot: string;
  pluginConfigurationPath: string;
  /** Installed/configured plugins, represented as source-free profiles. */
  plugins: PluginProfile[];
  /** @deprecated Use plugins. Kept as a descriptive alias for callers. */
  profiles: PluginProfile[];
  dependencyGraph: {
    plugin: string;
    dependencies: string[];
    orderAfter: string[];
    orderBefore: string[];
  }[];
  issues: PluginIssue[];
  valid: boolean;
  guarantee: string;
}

export interface CompiledPluginCommand {
  code: 357;
  indent: 0;
  parameters: [string, string, string, Record<string, string>];
}

export interface PluginUsage {
  kind: "command" | "note" | "comment";
  plugin?: string;
  commandName?: string;
  path: string;
  jsonPath: string;
  evidence: Evidence;
}

export interface PluginDocumentation {
  name: string;
  help?: string;
  locales: Record<string, Pick<PluginHeaderLocale, "description" | "help">>;
  url?: string;
  documents: {
    path: string;
    sha256: string;
    size: number;
    sections: string[];
  }[];
  evidence: Evidence[];
}

interface InstalledPlugin {
  name: string;
  absolutePath: string;
  relativePath: string;
}

/** Parse only public MZ comment headers. This function never evaluates JavaScript. */
export function parsePluginHeaders(source: string): PluginHeaderMetadata {
  const metadata = emptyMetadata();
  const blocks = source.match(/\/\*[\s\S]*?\*\//g) ?? [];
  for (const block of blocks) {
    const first = block.split(/\r?\n/, 1)[0]?.trim() ?? "";
    const struct = /^\/\*~struct~([^:]+):\s*$/.exec(first)?.[1];
    if (struct) {
      metadata.structs[struct] = parseFields(block);
      continue;
    }
    const language = /^\/\*:([A-Za-z][A-Za-z0-9_-]*)?\s*$/.exec(first)?.[1];
    if (language === undefined && !/^\/\*:\s*$/.test(first)) continue;
    const locale = language ? emptyLocale() : undefined;
    parseHeaderBlock(block, language ? undefined : metadata, locale);
    if (language && locale) metadata.locales[language] = locale;
  }
  metadata.dependencies = [...metadata.bases];
  return metadata;
}

/** Decode an MZ parameter string using public type metadata. */
export function decodePluginMetadataValue(
  raw: string,
  field: MetadataField,
  structs: Record<string, MetadataField[]>
): unknown {
  const type = parseType(field.type);
  if (type.array) {
    const parsed = parseJson(raw, `${field.name} array`);
    if (!Array.isArray(parsed))
      throw new Error(`${field.name} must be an array.`);
    return parsed.map((item) =>
      decodeScalar(
        typeof item === "string" ? item : JSON.stringify(item),
        type.base,
        field,
        structs
      )
    );
  }
  return decodeScalar(raw, type.base, field, structs);
}

/** Encode a typed parameter value to the string storage format expected by plugins.js. */
export function encodePluginMetadataValue(
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

/** Inspect all installed and configured plugins without executing any JavaScript. */
export async function inspectPluginProject(
  projectRoot: string
): Promise<PluginProjectInspection> {
  const root = path.resolve(projectRoot);
  const configurationPath = path.join(root, "js", "plugins.js");
  const installed = await findPlugins(root);
  let configurations: PluginConfiguration[] = [];
  let configurationFile: PluginProfile["configurationFile"];
  let configurationError: PluginIssue | undefined;
  try {
    configurations = await readConfigurations(configurationPath);
    const source = await readFile(configurationPath, "utf8");
    configurationFile = {
      path: "js/plugins.js",
      sha256: createHash("sha256").update(source).digest("hex")
    };
  } catch (error) {
    configurationError = makeIssue(
      "error",
      "invalid-configuration",
      errorMessage(error)
    );
  }
  const byName = new Map(installed.map((file) => [file.name, file]));
  const names = [
    ...new Set([
      ...installed.map((file) => file.name),
      ...configurations.map((entry) => entry.name)
    ])
  ];
  const profiles = await Promise.all(
    names.map(async (name) =>
      profileFor(name, byName.get(name), configurations, configurationFile)
    )
  );
  const issues = validateProfiles(profiles, configurations);
  if (configurationError) issues.unshift(configurationError);
  for (const profile of profiles)
    profile.issues = issues.filter((issue) => issue.plugin === profile.name);
  return {
    projectRoot: root,
    pluginConfigurationPath: "js/plugins.js",
    plugins: profiles.sort(compareProfiles),
    profiles: profiles.sort(compareProfiles),
    dependencyGraph: profiles.map((profile) => ({
      plugin: profile.name,
      dependencies: [...profile.metadata.dependencies],
      orderAfter: [...profile.metadata.orderAfter],
      orderBefore: [...profile.metadata.orderBefore]
    })),
    issues,
    valid: !issues.some((issue) => issue.severity === "error"),
    guarantee:
      "Caelis reads files and public RPG Maker MZ comment headers only. It never executes plugin JavaScript and cannot certify undocumented plugin behavior or every plugin combination."
  };
}

export async function getPluginProfile(
  projectRoot: string,
  name: string
): Promise<PluginProfile> {
  const inspection = await inspectPluginProject(projectRoot);
  const profile = inspection.plugins.find((entry) => entry.name === name);
  if (!profile) throw new Error(`Plugin ${name} was not found.`);
  return profile;
}

export async function encodePluginParameterPatch(
  projectRoot: string,
  name: string,
  values: Record<string, unknown>
): Promise<Record<string, string>> {
  const profile = await getPluginProfile(projectRoot, name);
  const fields = new Map(
    profile.metadata.parameters.map((field) => [field.name, field])
  );
  return Object.fromEntries(
    Object.entries(values).map(([parameter, value]) => {
      const field = fields.get(parameter);
      if (!field)
        throw new Error(`Unknown parameter ${parameter} for ${name}.`);
      return [
        parameter,
        encodePluginMetadataValue(value, field, profile.metadata.structs)
      ];
    })
  );
}

export async function compilePluginCommand(
  projectRoot: string,
  name: string,
  commandName: string,
  args: Record<string, unknown>
): Promise<CompiledPluginCommand> {
  const profile = await getPluginProfile(projectRoot, name);
  const command = profile.metadata.commands.find(
    (entry) => entry.name === commandName
  );
  if (!command) throw new Error(`Unknown command ${commandName} for ${name}.`);
  const fields = new Map(command.arguments.map((field) => [field.name, field]));
  for (const argument of Object.keys(args))
    if (!fields.has(argument))
      throw new Error(
        `Unknown argument ${argument} for ${name}:${commandName}.`
      );
  const encoded = Object.fromEntries(
    command.arguments.map((field) => {
      const value = args[field.name] ?? field.default ?? "";
      return [
        field.name,
        encodePluginMetadataValue(value, field, profile.metadata.structs)
      ];
    })
  );
  return {
    code: 357,
    indent: 0,
    parameters: [name, commandName, command.text ?? commandName, encoded]
  };
}

/** Statically scan RPG Maker JSON for command 357 records, notes, and event comments. */
export async function scanPluginUsage(
  projectRoot: string,
  name?: string
): Promise<PluginUsage[]> {
  const root = path.resolve(projectRoot);
  const dataRoot = path.join(root, "data");
  const files = await findFiles(
    dataRoot,
    (relative) => relative.endsWith(".json"),
    root
  );
  const usages: PluginUsage[] = [];
  for (const file of files) {
    let data: unknown;
    try {
      data = JSON.parse(await readFile(file.absolutePath, "utf8")) as unknown;
    } catch {
      continue;
    }
    collectUsage(data, file.relativePath, "$", name, usages);
  }
  return usages;
}

/** Discover public header help plus nearby static Markdown/text documentation. */
export async function discoverPluginDocumentation(
  projectRoot: string,
  name: string
): Promise<PluginDocumentation> {
  const root = path.resolve(projectRoot);
  const profile = await getPluginProfile(root, name);
  const files: {
    path: string;
    sha256: string;
    size: number;
    sections: string[];
  }[] = [];
  if (profile.file) {
    const absolute = path.join(root, profile.file.path);
    const directory = path.dirname(absolute);
    const base = path.basename(absolute, ".js").toLowerCase();
    const siblings = await readdir(directory, { withFileTypes: true }).catch(
      () => []
    );
    for (const entry of siblings) {
      if (!entry.isFile() || !/\.(md|markdown|txt)$/i.test(entry.name))
        continue;
      const stem = path
        .basename(entry.name, path.extname(entry.name))
        .toLowerCase();
      if (stem !== base && stem !== "readme") continue;
      const content = await readFile(path.join(directory, entry.name), "utf8");
      files.push({
        path: toProjectPath(root, path.join(directory, entry.name)),
        sha256: createHash("sha256").update(content).digest("hex"),
        size: Buffer.byteLength(content),
        sections: documentSections(content)
      });
    }
  }
  const locales = Object.fromEntries(
    Object.entries(profile.metadata.locales).map(([language, value]) => [
      language,
      {
        ...(value.description ? { description: value.description } : {}),
        ...(value.help ? { help: value.help } : {})
      }
    ])
  );
  return {
    name,
    ...(profile.metadata.help ? { help: profile.metadata.help } : {}),
    locales,
    ...(profile.metadata.url ? { url: profile.metadata.url } : {}),
    documents: files,
    evidence: [
      {
        label: "declared",
        sourceKind: "public-mz-header",
        detail: "Public plugin header metadata"
      },
      ...(files.length > 0
        ? [
            {
              label: "documented" as const,
              sourceKind: "static-documentation" as const,
              detail: "Static documentation files adjacent to the plugin"
            }
          ]
        : [])
    ]
  };
}

function emptyMetadata(): PluginHeaderMetadata {
  return {
    bases: [],
    dependencies: [],
    orderAfter: [],
    orderBefore: [],
    parameters: [],
    commands: [],
    structs: {},
    locales: {}
  };
}

function emptyLocale(): PluginHeaderLocale {
  return { parameters: {}, commands: {} };
}

function parseHeaderBlock(
  block: string,
  metadata: PluginHeaderMetadata | undefined,
  locale: PluginHeaderLocale | undefined
): void {
  let command: PluginCommandMetadata | undefined;
  let field: MetadataField | undefined;
  let option: MetadataOption | undefined;
  for (const annotation of annotations(block)) {
    if (locale) {
      if (annotation.key === "plugindesc")
        locale.description = annotation.value;
      else if (annotation.key === "help") locale.help = annotation.value;
      else if (annotation.key === "param") {
        field = newField(annotation.value);
        locale.parameters[field.name] = {};
        command = undefined;
      } else if (annotation.key === "command") {
        command = { name: annotation.value, arguments: [] };
        locale.commands[command.name] = {};
        field = undefined;
      } else if (annotation.key === "arg" && command) {
        field = newField(annotation.value);
      } else if (annotation.key === "text" && field)
        locale.parameters[field.name] = {
          ...locale.parameters[field.name],
          text: annotation.value
        };
      else if (annotation.key === "desc" && field)
        locale.parameters[field.name] = {
          ...locale.parameters[field.name],
          description: annotation.value
        };
      else if (annotation.key === "text" && command)
        locale.commands[command.name] = {
          ...locale.commands[command.name],
          text: annotation.value
        };
      else if (annotation.key === "desc" && command)
        locale.commands[command.name] = {
          ...locale.commands[command.name],
          description: annotation.value
        };
      continue;
    }
    if (!metadata) continue;
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
        field = newField(annotation.value);
        metadata.parameters.push(field);
        command = undefined;
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
    } else if (field) option = applyFieldAnnotation(field, annotation, option);
  }
  return fields;
}

function annotations(block: string): { key: string; value: string }[] {
  const result: { key: string; value: string }[] = [];
  let current: { key: string; value: string } | undefined;
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine
      .replace(/\*\/\s*$/, "")
      .replace(/^\s*\/\*:?\s?/, "")
      .replace(/^\s*\*?\s?/, "");
    const match = /^@([A-Za-z][A-Za-z0-9_-]*)\s*(.*)$/.exec(line);
    if (match?.[1]) {
      current = { key: match[1].toLowerCase(), value: match[2]?.trim() ?? "" };
      result.push(current);
    } else if (current && line.trim())
      current.value += `${current.value ? "\n" : ""}${line.trim()}`;
  }
  return result;
}

function newField(name: string): MetadataField {
  return { name, type: "string", options: [] };
}

function applyFieldAnnotation(
  field: MetadataField,
  annotation: { key: string; value: string },
  current: MetadataOption | undefined
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
      if (current) current.value = annotation.value;
      break;
  }
  return current;
}

async function profileFor(
  name: string,
  installed: InstalledPlugin | undefined,
  configurations: PluginConfiguration[],
  configurationFile: PluginProfile["configurationFile"]
): Promise<PluginProfile> {
  const configuration = configurations.find((entry) => entry.name === name);
  let metadata = emptyMetadata();
  let file: PluginProfile["file"];
  let observations: StaticPluginObservation[] = [];
  if (installed) {
    const source = await readFile(installed.absolutePath, "utf8");
    metadata = parsePluginHeaders(source);
    observations = inspectStaticLiterals(source);
    file = {
      path: installed.relativePath,
      sha256: createHash("sha256").update(source).digest("hex")
    };
  }
  const decodedParameters: Record<string, unknown> = {};
  if (configuration)
    for (const [parameter, raw] of Object.entries(configuration.parameters)) {
      const field = metadata.parameters.find(
        (entry) => entry.name === parameter
      );
      if (!field) decodedParameters[parameter] = raw;
      else {
        try {
          decodedParameters[parameter] = decodePluginMetadataValue(
            raw,
            field,
            metadata.structs
          );
        } catch {
          decodedParameters[parameter] = raw;
        }
      }
    }
  return {
    name,
    installed: installed !== undefined,
    configured: configuration !== undefined,
    enabled: configuration?.status ?? false,
    ...(configuration?.position !== undefined
      ? { position: configuration.position }
      : {}),
    ...(file ? { file } : {}),
    ...(configurationFile && configuration ? { configurationFile } : {}),
    ...(configuration ? { configuration } : {}),
    metadata,
    observations,
    decodedParameters,
    evidence: [
      ...(installed
        ? [
            {
              label: "observed" as const,
              sourceKind: "file-system" as const,
              detail: installed.relativePath
            },
            {
              label: "declared" as const,
              sourceKind: "public-mz-header" as const,
              detail: "Parsed public MZ header comments"
            }
          ]
        : []),
      ...(configuration
        ? [
            {
              label: "declared" as const,
              sourceKind: "plugins-js" as const,
              detail: "js/plugins.js entry"
            }
          ]
        : []),
      ...(observations.length > 0
        ? [
            {
              label: "observed" as const,
              sourceKind: "static-js-literal" as const,
              detail: "Safe literal-only plugin API observations"
            }
          ]
        : [])
    ],
    issues: []
  };
}

function validateProfiles(
  profiles: PluginProfile[],
  configurations: PluginConfiguration[]
): PluginIssue[] {
  const issues: PluginIssue[] = [];
  const byName = new Map(profiles.map((profile) => [profile.name, profile]));
  for (const profile of profiles) {
    if (profile.enabled && !profile.installed)
      issues.push(
        makeIssue(
          "error",
          "missing-file",
          `${profile.name} is enabled but its JavaScript file is missing.`,
          profile.name
        )
      );
    if (profile.installed && !profile.configured)
      issues.push(
        makeIssue(
          "warning",
          "not-configured",
          `${profile.name} is installed but absent from plugins.js.`,
          profile.name
        )
      );
    if (!profile.configuration) continue;
    for (const [parameter, raw] of Object.entries(
      profile.configuration.parameters
    )) {
      const field = profile.metadata.parameters.find(
        (entry) => entry.name === parameter
      );
      if (!field) {
        issues.push({
          ...makeIssue(
            "warning",
            "unknown-parameter",
            `${profile.name} has no public header definition for ${parameter}.`,
            profile.name
          ),
          parameter
        });
        continue;
      }
      try {
        decodePluginMetadataValue(raw, field, profile.metadata.structs);
      } catch (error) {
        issues.push({
          ...makeIssue(
            "error",
            "parameter-decode",
            errorMessage(error),
            profile.name
          ),
          parameter
        });
      }
    }
  }
  for (const configuration of configurations)
    if (
      configurations.filter(
        (candidate) => candidate.name === configuration.name
      ).length > 1
    )
      issues.push(
        makeIssue(
          "error",
          "duplicate-configuration",
          `${configuration.name} appears more than once in plugins.js.`,
          configuration.name
        )
      );
  for (const profile of profiles.filter((entry) => entry.enabled)) {
    for (const dependency of profile.metadata.dependencies) {
      const required = byName.get(dependency);
      if (!required?.configured)
        issues.push(
          makeIssue(
            "error",
            "missing-dependency",
            `${profile.name} requires ${dependency}.`,
            profile.name
          )
        );
      else if (!required.enabled)
        issues.push(
          makeIssue(
            "error",
            "disabled-dependency",
            `${profile.name} requires enabled plugin ${dependency}.`,
            profile.name
          )
        );
      else if (
        (required.position ?? Number.MAX_SAFE_INTEGER) >
        (profile.position ?? -1)
      )
        issues.push(
          makeIssue(
            "error",
            "dependency-order",
            `${dependency} must load above ${profile.name}.`,
            profile.name
          )
        );
    }
    for (const other of profile.metadata.orderAfter)
      validateOrder(issues, profile, byName.get(other), "after");
    for (const other of profile.metadata.orderBefore)
      validateOrder(issues, profile, byName.get(other), "before");
  }
  return issues;
}

function validateOrder(
  issues: PluginIssue[],
  profile: PluginProfile,
  other: PluginProfile | undefined,
  relation: "after" | "before"
): void {
  if (
    !other?.enabled ||
    other.position === undefined ||
    profile.position === undefined
  )
    return;
  const valid =
    relation === "after"
      ? profile.position > other.position
      : profile.position < other.position;
  if (!valid)
    issues.push(
      makeIssue(
        "error",
        "dependency-order",
        `${profile.name} must load ${relation} ${other.name}.`,
        profile.name
      )
    );
}

function makeIssue(
  severity: PluginIssue["severity"],
  code: PluginIssue["code"],
  message: string,
  plugin?: string
): PluginIssue {
  return { severity, code, message, ...(plugin ? { plugin } : {}) };
}

async function findPlugins(root: string): Promise<InstalledPlugin[]> {
  const pluginRoot = path.join(root, "js", "plugins");
  const files = await findFiles(
    pluginRoot,
    (relative) => relative.endsWith(".js"),
    root
  );
  return files.map((file) => ({
    name: file.relativePath.slice("js/plugins/".length, -3),
    absolutePath: file.absolutePath,
    relativePath: file.relativePath
  }));
}

async function findFiles(
  root: string,
  include: (relative: string) => boolean,
  projectRoot: string
): Promise<{ absolutePath: string; relativePath: string }[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const found: { absolutePath: string; relativePath: string }[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory())
      found.push(...(await findFiles(absolutePath, include, projectRoot)));
    else if (entry.isFile()) {
      const relativePath = toProjectPath(projectRoot, absolutePath);
      if (include(relativePath)) found.push({ absolutePath, relativePath });
    }
  }
  return found;
}

async function readConfigurations(
  configurationPath: string
): Promise<PluginConfiguration[]> {
  const source = await readFile(configurationPath, "utf8");
  const start = source.indexOf("[");
  const end = source.lastIndexOf("]");
  if (start < 0 || end < start)
    throw new Error("js/plugins.js does not contain a JSON plugin array.");
  const parsed = JSON.parse(source.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed))
    throw new Error("js/plugins.js plugin configuration must be an array.");
  return parsed.flatMap((value, position) => {
    if (!isObject(value) || typeof value.name !== "string") return [];
    const raw = isObject(value.parameters) ? value.parameters : {};
    const parameters = Object.fromEntries(
      Object.entries(raw).filter(
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

function collectUsage(
  value: unknown,
  file: string,
  location: string,
  name: string | undefined,
  usages: PluginUsage[]
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectUsage(item, file, `${location}[${String(index)}]`, name, usages);
    });
    return;
  }
  if (!isObject(value)) return;
  if (
    value.code === 357 &&
    Array.isArray(value.parameters) &&
    typeof value.parameters[0] === "string"
  ) {
    const plugin = value.parameters[0];
    if (!name || plugin === name)
      usages.push({
        kind: "command",
        plugin,
        ...(typeof value.parameters[1] === "string"
          ? { commandName: value.parameters[1] }
          : {}),
        path: file,
        jsonPath: location,
        evidence: staticJsonEvidence()
      });
  }
  if (
    (value.code === 108 || value.code === 408) &&
    Array.isArray(value.parameters) &&
    typeof value.parameters[0] === "string" &&
    (!name || value.parameters[0].includes(name))
  )
    usages.push({
      kind: "comment",
      path: file,
      jsonPath: location,
      evidence: staticJsonEvidence()
    });
  for (const [key, child] of Object.entries(value)) {
    if (
      key.toLowerCase() === "note" &&
      typeof child === "string" &&
      child.trim().length > 0 &&
      (name ? child.includes(name) : /<[^>]+>/.test(child))
    )
      usages.push({
        kind: "note",
        path: file,
        jsonPath: `${location}.${key}`,
        evidence: staticJsonEvidence()
      });
    collectUsage(child, file, `${location}.${key}`, name, usages);
  }
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
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => {
        const definition = structs[struct]?.find(
          (entry) => entry.name === name
        );
        return [
          name,
          definition && typeof item === "string"
            ? decodePluginMetadataValue(item, definition, structs)
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
  )
    throw new Error(`${field.name} is not one of its declared options.`);
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
    const fields = new Map(
      (structs[struct] ?? []).map((entry) => [entry.name, entry])
    );
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(value).map(([name, item]) => {
          const definition = fields.get(name);
          if (!definition)
            throw new Error(`Unknown field ${name} in struct ${struct}.`);
          return [name, encodePluginMetadataValue(item, definition, structs)];
        })
      )
    );
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
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    const encoded = String(value);
    if (
      field.options.length > 0 &&
      !field.options.some((option) => option.value === encoded)
    )
      throw new Error(`${field.name} is not one of its declared options.`);
    return encoded;
  }
  throw new Error(`${field.name} must be a scalar value.`);
}

function parseType(type: string): { base: string; array: boolean } {
  const trimmed = type.trim() || "string";
  return trimmed.endsWith("[]")
    ? { base: trimmed.slice(0, -2), array: true }
    : { base: trimmed, array: false };
}
function staticJsonEvidence(): Evidence {
  return {
    label: "observed",
    sourceKind: "static-json-scan",
    detail: "Static RPG Maker JSON scan"
  };
}
function inspectStaticLiterals(source: string): StaticPluginObservation[] {
  const observations: StaticPluginObservation[] = [];
  const evidence = (): Evidence => ({
    label: "observed",
    sourceKind: "static-js-literal",
    detail: "Literal-only static JavaScript scan"
  });
  const command =
    /PluginManager\.registerCommand\s*\(\s*(["'])((?:\\.|(?!\1)[^\\])*)\1\s*,\s*(["'])((?:\\.|(?!\3)[^\\])*)\3/g;
  for (const match of source.matchAll(command))
    observations.push({
      kind: "registered-command",
      plugin: safeLiteral(match[2] ?? ""),
      commandName: safeLiteral(match[4] ?? ""),
      evidence: evidence()
    });
  const parameters =
    /PluginManager\.parameters\s*\(\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g;
  for (const match of source.matchAll(parameters))
    observations.push({
      kind: "parameter-access",
      plugin: safeLiteral(match[2] ?? ""),
      evidence: evidence()
    });
  const version =
    /\b(?:version|VERSION)\s*[:=]\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g;
  for (const match of source.matchAll(version))
    observations.push({
      kind: "version",
      value: safeLiteral(match[2] ?? ""),
      evidence: evidence()
    });
  const urls = /\bhttps?:\/\/[^\s"'`<>]+/g;
  for (const match of source.matchAll(urls))
    observations.push({ kind: "url", value: match[0], evidence: evidence() });
  return observations;
}
function safeLiteral(value: string): string {
  return value.replace(
    /\\([\\'"nrt])/g,
    (_match, character: string) =>
      ({ n: "\n", r: "\r", t: "\t" })[character] ?? character
  );
}
function documentSections(content: string): string[] {
  return content
    .split(/\r?\n/)
    .flatMap((line) => /^#{1,6}\s+(.+)$/.exec(line)?.[1]?.trim() ?? [])
    .filter(Boolean)
    .slice(0, 20)
    .map((section) => section.slice(0, 160));
}
function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label} contains invalid JSON.`);
  }
}
function setFiniteNumber(
  field: MetadataField,
  key: "min" | "max" | "decimals",
  raw: string
): void {
  const value = Number(raw);
  if (Number.isFinite(value)) field[key] = value;
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
function toProjectPath(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join("/");
}
function compareProfiles(a: PluginProfile, b: PluginProfile): number {
  return (
    (a.position ?? Number.MAX_SAFE_INTEGER) -
      (b.position ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)
  );
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
