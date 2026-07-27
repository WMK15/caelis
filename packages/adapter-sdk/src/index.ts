/** Context supplied to adapters during plugin or engine detection. */
export interface AdapterDetectionContext {
  projectRoot: string;
  pluginFiles: string[];
  dataFiles: string[];
}

/** Plugin command exposed through a supported adapter. */
export interface PluginCommandDefinition {
  pluginName: string;
  commandName: string;
  arguments: PluginCommandArgument[];
}

export interface PluginCommandArgument {
  name: string;
  type: "string" | "number" | "boolean" | "select" | "json";
  required: boolean;
}

export interface NotetagDefinition {
  name: string;
  appliesTo: string[];
  description: string;
}

export interface PluginDependency {
  id: string;
  optional: boolean;
  versionRange?: string;
}

export interface AdapterValidationIssue {
  severity: "error" | "warning";
  message: string;
  sourcePath?: string;
}

/** Capability category reported by plugin adapters. */
export interface PluginCapability {
  id: string;
  kind:
    | "switches"
    | "variables"
    | "common-events"
    | "map-events"
    | "plugin-commands"
    | "script-commands"
    | "database-records"
    | "notetags";
  displayName: string;
  pluginCommands?: PluginCommandDefinition[];
  notetags?: NotetagDefinition[];
  dependencies?: PluginDependency[];
}

/** Adapter boundary for native and third-party RPG Maker plugin support. */
export interface PluginAdapter {
  id: string;
  displayName: string;
  detect(context: AdapterDetectionContext): Promise<boolean>;
  getCapabilities(): PluginCapability[];
}
