import { describe, expect, it } from "vitest";

import { rmmzNativeAdapter } from "./index.js";

describe("rmmz native adapter", () => {
  it("declares native RPG Maker MZ capabilities", () => {
    expect(
      rmmzNativeAdapter.getCapabilities().map((capability) => capability.kind)
    ).toEqual([
      "switches",
      "variables",
      "common-events",
      "map-events",
      "plugin-commands",
      "script-commands",
      "database-records"
    ]);
  });
});
