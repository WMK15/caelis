import { NotImplementedError } from "@caelis/core";
import { describe, expect, it } from "vitest";

import { applyChangeSet, planChangeSet, validateChangeSet } from "./index.js";

describe("guard", () => {
  it("plans and validates change sets without writes", () => {
    const changeSet = planChangeSet({
      id: "cs1",
      description: "Create note",
      operations: [
        { type: "create-file", path: "notes/example.md", content: "Hello" }
      ]
    });

    expect(changeSet.status).toBe("planned");
    expect(validateChangeSet(changeSet).valid).toBe(true);
  });

  it("rejects unsafe paths", () => {
    const changeSet = planChangeSet({
      id: "cs2",
      description: "Unsafe",
      operations: [{ type: "delete-file", path: "../System.json" }]
    });

    expect(validateChangeSet(changeSet).valid).toBe(false);
  });

  it("does not implement apply yet", async () => {
    await expect(
      applyChangeSet(
        planChangeSet({ id: "cs3", description: "Noop", operations: [] })
      )
    ).rejects.toThrow(NotImplementedError);
  });
});
