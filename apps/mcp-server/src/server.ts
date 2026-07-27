import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getCodexEntity } from "./tools/codex-get-entity.js";
import { searchCodex } from "./tools/codex-search.js";
import { getCodexStatus } from "./tools/codex-status.js";
import { getProjectScan } from "./tools/project-scan.js";
import { getProjectSummary } from "./tools/project-summary.js";
import { getValidationReport } from "./tools/validation-report.js";

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

/** Create the Caelis MCP server with read-only tools and resources. */
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
          text: "# Caelis Architecture\n\nThe initial MCP server exposes read-only project scan, summary, and validation tools over stdio."
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
