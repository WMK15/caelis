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
});
