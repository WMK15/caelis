import { describe, expect, it } from "vitest";

import { createCaelisMcpServer } from "./server.js";

describe("mcp server", () => {
  it("creates a server instance", () => {
    expect(createCaelisMcpServer()).toBeDefined();
  });
});
