import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import { createCaelisMcpServer } from "./server.js";

describe("mcp server", () => {
  it("creates a server instance", () => {
    expect(createCaelisMcpServer()).toBeDefined();
  });

  it("exposes the complete project editing surface over MCP", async () => {
    const server = createCaelisMcpServer();
    const client = new Client({ name: "caelis-test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport)
    ]);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          "database_list",
          "database_record_create_plan",
          "database_record_update_plan",
          "system_update_plan",
          "map_event_upsert_plan",
          "event_compile",
          "plugin_configure_plan",
          "plugin_create_plan",
          "plugin_inventory",
          "plugin_inspect",
          "plugin_validate",
          "plugin_usage_scan",
          "plugin_dependency_graph",
          "plugin_parameter_get",
          "plugin_parameter_update_plan",
          "plugin_command_list",
          "plugin_command_describe",
          "plugin_command_compile",
          "plugin_documentation_sources",
          "visustella_status",
          "visustella_plugin_get",
          "visustella_parameter_update_plan",
          "visustella_command_compile",
          "character_generator_launch",
          "change_apply"
        ])
      );

      const result = await client.callTool({
        name: "event_compile",
        arguments: {
          nodes: [{ type: "dialogue", speaker: "Hero", text: "Hello" }]
        }
      });
      const serialized = JSON.stringify(result.content);
      expect(serialized).toContain('\\"code\\": 101');
      expect(serialized).toContain('\\"code\\": 401');
      expect(serialized).toContain('\\"code\\": 0');
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("inspects and compiles generic plugin metadata without executing it", async () => {
    const root = await createPluginProject();
    const server = createCaelisMcpServer();
    const client = new Client({ name: "caelis-test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport)
    ]);
    try {
      const inventory = await client.callTool({
        name: "plugin_inventory",
        arguments: { projectRoot: root }
      });
      const compiled = await client.callTool({
        name: "plugin_command_compile",
        arguments: {
          projectRoot: root,
          name: "ExamplePlugin",
          commandName: "ShowMessage",
          args: { text: "Hello" }
        }
      });

      expect(JSON.stringify(inventory.content)).toContain("ExamplePlugin");
      expect(JSON.stringify(compiled.content)).toContain('\\"code\\": 357');
      expect(JSON.stringify(compiled.content)).toContain("Hello");
    } finally {
      await client.close();
      await server.close();
      await rm(root, { force: true, recursive: true });
    }
  });
});

async function createPluginProject(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "caelis-plugin-mcp-"));
  await mkdir(path.join(root, "js", "plugins"), { recursive: true });
  await writeFile(
    path.join(root, "js", "plugins.js"),
    'var $plugins = [{"name":"ExamplePlugin","status":true,"description":"Example","parameters":{"Speed":"3"}}];\n',
    "utf8"
  );
  await writeFile(
    path.join(root, "js", "plugins", "ExamplePlugin.js"),
    `/*:
 * @target MZ
 * @plugindesc Generic example plugin
 * @param Speed
 * @type number
 * @default 1
 * @command ShowMessage
 * @text Show Message
 * @arg text
 * @type string
 * @default Hello
 */\n`,
    "utf8"
  );
  return root;
}
