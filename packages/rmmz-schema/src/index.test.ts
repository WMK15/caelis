import { describe, expect, it } from "vitest";

import { eventCommandSchema, mapSchema, systemSchema } from "./index.js";

describe("rmmz schemas", () => {
  it("preserves unknown System.json fields", () => {
    const parsed = systemSchema.parse({ gameTitle: "Demo", custom: true });

    expect(parsed).toMatchObject({ gameTitle: "Demo", custom: true });
  });

  it("parses minimal event commands", () => {
    expect(eventCommandSchema.parse({ code: 0 })).toEqual({
      code: 0,
      indent: 0,
      parameters: []
    });
  });

  it("parses a minimal map", () => {
    expect(mapSchema.parse({ events: [] }).events).toEqual([]);
  });
});
