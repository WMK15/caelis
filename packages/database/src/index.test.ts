import { describe, expect, it } from "vitest";

import type { DatabaseOperation } from "./index.js";

describe("database operations", () => {
  it("describes semantic database updates without writing files", () => {
    const operation: DatabaseOperation = {
      type: "deprecate-database-record",
      collection: "items",
      id: 1,
      reason: "Replaced by Potion+"
    };

    expect(operation.type).toBe("deprecate-database-record");
  });
});
