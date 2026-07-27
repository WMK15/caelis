import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ConfigurationError } from "@caelis/core";
import YAML from "yaml";
import { z } from "zod";

/** Supported write modes for guarded future mutations. */
export const writeModeSchema = z.enum(["read-only", "preview", "apply"]);

/** Runtime schema for `.caelis/config.yaml`. */
export const caelisConfigSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    engine: z.literal("RPG_MAKER_MZ")
  }),
  writes: z.object({
    defaultMode: writeModeSchema.default("preview")
  }),
  runtimeBridge: z.object({
    enabled: z.boolean().default(false)
  }),
  permissions: z.object({
    pluginCommandsAllowed: z.boolean().default(false),
    scriptCommandsAllowed: z.boolean().default(false)
  }),
  memory: z.object({
    enabled: z.boolean().default(true),
    database: z.string().default(".caelis/caelis.sqlite3"),
    fullTextSearch: z.boolean().default(true),
    semanticSearch: z.boolean().default(false),
    autoApproveObservedFacts: z.boolean().default(false),
    retainSessionMemoryDays: z.number().int().positive().default(30)
  }),
  git: z.object({
    enabled: z.boolean().default(true)
  })
});

/** Parsed Caelis project configuration. */
export type CaelisConfig = z.infer<typeof caelisConfigSchema>;

/** Return the conventional Caelis config path for a project root. */
export function getConfigPath(projectRoot: string): string {
  return path.join(projectRoot, ".caelis", "config.yaml");
}

/** Create the default configuration file and return the parsed configuration. */
export async function createDefaultConfig(
  projectRoot: string
): Promise<CaelisConfig> {
  const config: CaelisConfig = {
    project: {
      name: path.basename(path.resolve(projectRoot)),
      engine: "RPG_MAKER_MZ"
    },
    writes: { defaultMode: "preview" },
    runtimeBridge: { enabled: false },
    permissions: {
      pluginCommandsAllowed: false,
      scriptCommandsAllowed: false
    },
    memory: {
      enabled: true,
      database: ".caelis/caelis.sqlite3",
      fullTextSearch: true,
      semanticSearch: false,
      autoApproveObservedFacts: false,
      retainSessionMemoryDays: 30
    },
    git: { enabled: true }
  };

  const configPath = getConfigPath(projectRoot);
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, YAML.stringify(config), "utf8");
  return config;
}

/** Load and validate `.caelis/config.yaml` from a project root. */
export async function loadConfig(projectRoot: string): Promise<CaelisConfig> {
  const configPath = getConfigPath(projectRoot);
  let raw: string;

  try {
    raw = await readFile(configPath, "utf8");
  } catch (cause) {
    throw new ConfigurationError("Caelis config file could not be read.", {
      configPath,
      cause: cause instanceof Error ? cause.message : String(cause)
    });
  }

  const parsedYaml = YAML.parse(raw) as unknown;
  const result = caelisConfigSchema.safeParse(parsedYaml);
  if (!result.success) {
    throw new ConfigurationError("Caelis config file is invalid.", {
      configPath,
      issues: result.error.issues
    });
  }

  validateMemoryDatabasePath(projectRoot, result.data.memory.database);

  return result.data;
}

function validateMemoryDatabasePath(
  projectRoot: string,
  configuredPath: string
): void {
  const root = path.resolve(projectRoot);
  const databasePath = path.resolve(root, configuredPath);
  const relative = path.relative(root, databasePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ConfigurationError(
      "Caelis memory database path must remain inside the project root.",
      {
        configuredPath
      }
    );
  }
}
