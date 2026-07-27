import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("CaelisBridge plugin source", () => {
  it("contains RPG Maker MZ plugin metadata", async () => {
    const source = await readFile(
      path.join(import.meta.dirname, "CaelisBridge.ts"),
      "utf8"
    );

    expect(source).toContain("@target MZ");
    expect(source).toContain("@command ReportStatus");
    expect(source).toContain("development-only");
  });
});
