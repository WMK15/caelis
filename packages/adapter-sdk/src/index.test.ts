import { describe, expect, it } from "vitest";

import type { PluginCapability } from "./index.js";

describe("adapter sdk", () => {
  it("describes plugin capabilities", () => {
    const capability: PluginCapability = {
      id: "switches",
      kind: "switches",
      displayName: "Switches"
    };

    expect(capability.kind).toBe("switches");
  });
});
