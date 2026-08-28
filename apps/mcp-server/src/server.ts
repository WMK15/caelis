import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getCodexEntity } from "./tools/codex-get-entity.js";
import { searchCodex } from "./tools/codex-search.js";
import { getCodexStatus } from "./tools/codex-status.js";
import {
  actorCreatePlanShape,
  actorCreatePlanTool,
  changeApplyShape,
  changeApplyTool,
  changePlanGetShape,
  changePlanGetTool,
  toJsonToolResponse
} from "./tools/change-plan-tools.js";
import { getProjectScan } from "./tools/project-scan.js";
import { getProjectSummary } from "./tools/project-summary.js";
import { getValidationReport } from "./tools/validation-report.js";
import {
  characterGeneratorLaunchShape,
  characterGeneratorLaunchTool,
  characterGeneratorStatusShape,
  characterGeneratorStatusTool,
  databaseCreatePlanShape,
  databaseCreatePlanTool,
  databaseGetShape,
  databaseGetTool,
  databaseListShape,
  databaseListTool,
  databaseUpdatePlanShape,
  databaseUpdatePlanTool,
  eventCompileShape,
  eventCompileTool,
  mapEventGetShape,
  mapEventGetTool,
  mapEventUpsertPlanShape,
  mapEventUpsertPlanTool,
  mapGetShape,
  mapGetTool,
  pluginConfigurePlanShape,
  pluginConfigurePlanTool,
  pluginCreatePlanShape,
  pluginCreatePlanTool,
  pluginGetShape,
  pluginGetTool,
  pluginListShape,
  pluginListTool,
  systemGetShape,
  systemGetTool,
  systemUpdatePlanShape,
  systemUpdatePlanTool,
  visuStellaCommandCompileShape,
  visuStellaCommandCompileTool,
  visuStellaGetShape,
  visuStellaGetTool,
  visuStellaParameterPlanShape,
  visuStellaParameterPlanTool,
  visuStellaStatusShape,
  visuStellaStatusTool
} from "./tools/project-operations-tools.js";

const projectRootShape = {
  projectRoot: z
    .string()
    .min(1)
    .describe("Absolute or relative RPG Maker MZ project root path.")
};

const codexSearchShape = {
  projectRoot: projectRootShape.projectRoot,
  query: z.string().min(1),
  documentTypes: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(50).optional()
};

const codexGetEntityShape = {
  projectRoot: projectRootShape.projectRoot,
  entityId: z.string().optional(),
  canonicalKey: z.string().optional()
};

/** Create the Caelis MCP server with inspection, planning, and confirmed apply tools. */
export function createCaelisMcpServer(): McpServer {
  const server = new McpServer({
    name: "caelis",
    version: "0.0.0"
  });

  server.registerTool(
    "project_scan",
    {
      description: "Read-only scan of an RPG Maker MZ project.",
      inputSchema: projectRootShape
    },
    async ({ projectRoot }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await getProjectScan(projectRoot), null, 2)
        }
      ]
    })
  );

  server.registerTool(
    "project_summary",
    {
      description: "Concise summary of an RPG Maker MZ project.",
      inputSchema: projectRootShape
    },
    async ({ projectRoot }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await getProjectSummary(projectRoot), null, 2)
        }
      ]
    })
  );

  server.registerTool(
    "validation_report",
    {
      description: "Read-only project validation report.",
      inputSchema: projectRootShape
    },
    async ({ projectRoot }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await getValidationReport(projectRoot), null, 2)
        }
      ]
    })
  );

  server.registerTool(
    "codex_status",
    {
      description: "Read-only status for the local Caelis Codex database.",
      inputSchema: projectRootShape
    },
    async ({ projectRoot }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await getCodexStatus(projectRoot), null, 2)
        }
      ]
    })
  );

  server.registerTool(
    "codex_search",
    {
      description:
        "Read-only full-text search over local Caelis Codex documents.",
      inputSchema: codexSearchShape
    },
    async ({ projectRoot, query, documentTypes, limit }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await searchCodex({
              projectRoot,
              query,
              ...(documentTypes !== undefined ? { documentTypes } : {}),
              ...(limit !== undefined ? { limit } : {})
            }),
            null,
            2
          )
        }
      ]
    })
  );

  server.registerTool(
    "codex_get_entity",
    {
      description:
        "Read-only lookup for a Codex entity by ID or canonical key.",
      inputSchema: codexGetEntityShape
    },
    async ({ projectRoot, entityId, canonicalKey }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await getCodexEntity({
              projectRoot,
              ...(entityId !== undefined ? { entityId } : {}),
              ...(canonicalKey !== undefined ? { canonicalKey } : {})
            }),
            null,
            2
          )
        }
      ]
    })
  );

  server.registerTool(
    "actor_create_plan",
    {
      description:
        "Plan a safe RPG Maker MZ actor creation without modifying project files.",
      inputSchema: actorCreatePlanShape
    },
    async (input) => toJsonToolResponse(await actorCreatePlanTool(input))
  );

  server.registerTool(
    "database_list",
    {
      description:
        "List records from any RPG Maker MZ database collection without modifying files.",
      inputSchema: databaseListShape
    },
    async (input) => toJsonToolResponse(await databaseListTool(input))
  );

  server.registerTool(
    "database_get",
    {
      description:
        "Get a complete RPG Maker MZ database record by collection and ID.",
      inputSchema: databaseGetShape
    },
    async (input) => toJsonToolResponse(await databaseGetTool(input))
  );

  server.registerTool(
    "database_record_create_plan",
    {
      description:
        "Plan creation of any database record. Optionally clone templateId before applying record fields.",
      inputSchema: databaseCreatePlanShape
    },
    async (input) => toJsonToolResponse(await databaseCreatePlanTool(input))
  );

  server.registerTool(
    "database_record_update_plan",
    {
      description:
        "Plan a recursive patch or complete replacement of any database record, including troop event pages and common events.",
      inputSchema: databaseUpdatePlanShape
    },
    async (input) => toJsonToolResponse(await databaseUpdatePlanTool(input))
  );

  server.registerTool(
    "system_get",
    {
      description:
        "Read System.json, including switches, variables, Types and Terms.",
      inputSchema: systemGetShape
    },
    async ({ projectRoot }) =>
      toJsonToolResponse(await systemGetTool(projectRoot))
  );

  server.registerTool(
    "system_update_plan",
    {
      description: "Plan a recursive patch or replacement of System.json.",
      inputSchema: systemUpdatePlanShape
    },
    async (input) => toJsonToolResponse(await systemUpdatePlanTool(input))
  );

  server.registerTool(
    "map_get",
    {
      description:
        "Read complete map data, including every map event and page.",
      inputSchema: mapGetShape
    },
    async ({ projectRoot, mapId }) =>
      toJsonToolResponse(await mapGetTool(projectRoot, mapId))
  );

  server.registerTool(
    "map_event_get",
    {
      description:
        "Read one map event with all of its pages and command lists.",
      inputSchema: mapEventGetShape
    },
    async ({ projectRoot, mapId, eventId }) =>
      toJsonToolResponse(await mapEventGetTool(projectRoot, mapId, eventId))
  );

  server.registerTool(
    "map_event_upsert_plan",
    {
      description:
        "Plan creation or editing of a map event. The event may contain any number of complete RPG Maker MZ pages.",
      inputSchema: mapEventUpsertPlanShape
    },
    async (input) => toJsonToolResponse(await mapEventUpsertPlanTool(input))
  );

  server.registerTool(
    "event_compile",
    {
      description:
        "Compile Caelis event AST nodes (dialogue, choices, branches, switches, variables, transfers, common events, scripts and plugin commands) into RPG Maker MZ commands.",
      inputSchema: eventCompileShape
    },
    async (input) => toJsonToolResponse(await eventCompileTool(input))
  );

  server.registerTool(
    "plugin_list",
    {
      description:
        "List plugin files and public header metadata without executing plugin JavaScript.",
      inputSchema: pluginListShape
    },
    async ({ projectRoot }) =>
      toJsonToolResponse(await pluginListTool(projectRoot))
  );

  server.registerTool(
    "plugin_get",
    {
      description:
        "Inspect one plugin's configuration, public parameters and public commands without executing it.",
      inputSchema: pluginGetShape
    },
    async ({ projectRoot, name }) =>
      toJsonToolResponse(await pluginGetTool(projectRoot, name))
  );

  server.registerTool(
    "plugin_configure_plan",
    {
      description:
        "Plan enabling, disabling, reordering or updating parameters for a plugin in js/plugins.js.",
      inputSchema: pluginConfigurePlanShape
    },
    async (input) => toJsonToolResponse(await pluginConfigurePlanTool(input))
  );

  server.registerTool(
    "plugin_create_plan",
    {
      description:
        "Plan creation and registration of a local RPG Maker MZ plugin source file, from supplied source or a command scaffold.",
      inputSchema: pluginCreatePlanShape
    },
    async (input) => toJsonToolResponse(await pluginCreatePlanTool(input))
  );

  server.registerTool(
    "visustella_status",
    {
      description:
        "Inspect installed VisuStella MZ plugins and validate tier order, public dependencies, and parameter encoding without executing plugin code.",
      inputSchema: visuStellaStatusShape
    },
    async (input) => toJsonToolResponse(await visuStellaStatusTool(input))
  );

  server.registerTool(
    "visustella_plugin_get",
    {
      description:
        "Inspect one VisuStella plugin's public typed parameters, nested structs, commands, dependencies, and decoded configuration.",
      inputSchema: visuStellaGetShape
    },
    async (input) => toJsonToolResponse(await visuStellaGetTool(input))
  );

  server.registerTool(
    "visustella_parameter_update_plan",
    {
      description:
        "Validate and encode a typed partial VisuStella parameter object, including nested structs and arrays, then create a guarded plugins.js plan.",
      inputSchema: visuStellaParameterPlanShape
    },
    async (input) =>
      toJsonToolResponse(await visuStellaParameterPlanTool(input))
  );

  server.registerTool(
    "visustella_command_compile",
    {
      description:
        "Validate typed arguments against an installed VisuStella command header and compile RPG Maker MZ event command code 357.",
      inputSchema: visuStellaCommandCompileShape
    },
    async (input) =>
      toJsonToolResponse(await visuStellaCommandCompileTool(input))
  );

  server.registerTool(
    "character_generator_status",
    {
      description:
        "Locate the RPG Maker MZ editor and built-in Character Generator assets.",
      inputSchema: characterGeneratorStatusShape
    },
    async (input) =>
      toJsonToolResponse(await characterGeneratorStatusTool(input))
  );

  server.registerTool(
    "character_generator_launch",
    {
      description:
        "Launch the RPG Maker MZ project editor with explicit confirmation. Choose Tools > Character Generator after it opens.",
      inputSchema: characterGeneratorLaunchShape
    },
    async (input) =>
      toJsonToolResponse(await characterGeneratorLaunchTool(input))
  );

  server.registerTool(
    "change_plan_get",
    {
      description: "Read a persisted Caelis change plan without applying it.",
      inputSchema: changePlanGetShape
    },
    async (input) => toJsonToolResponse(await changePlanGetTool(input))
  );

  server.registerTool(
    "change_apply",
    {
      description:
        "Apply a previously reviewed Caelis change plan with explicit confirmation, backup, validation, and rollback.",
      inputSchema: changeApplyShape
    },
    async (input) => toJsonToolResponse(await changeApplyTool(input))
  );

  server.registerResource(
    "about",
    "caelis://about",
    { title: "About Caelis", mimeType: "text/markdown" },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: "# Caelis\n\nCaelis is a local-first development intelligence and automation toolkit for RPG Maker MZ."
        }
      ]
    })
  );

  server.registerResource(
    "architecture",
    "caelis://product/architecture",
    { title: "Caelis Architecture", mimeType: "text/markdown" },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: "# Caelis Architecture\n\nThe MCP server exposes read-only inspection tools, planning tools that persist proposed database, system, map-event, and plugin changes without writing RPG Maker data, and an explicit change_apply tool that requires a reviewed plan ID and confirmation."
        }
      ]
    })
  );

  return server;
}

/** Start the stdio MCP server. */
export async function startServer(): Promise<void> {
  const server = createCaelisMcpServer();
  await server.connect(new StdioServerTransport());
}
