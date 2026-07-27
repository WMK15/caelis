import { describe, expect, it } from "vitest";

import { bridgeRequestSchema } from "./index.js";

describe("bridge protocol", () => {
  it("parses handshake requests", () => {
    const parsed = bridgeRequestSchema.parse({
      id: "1",
      timestamp: "2026-01-01T00:00:00.000Z",
      type: "handshake",
      token: "dev"
    });

    expect(parsed.type).toBe("handshake");
  });
});
