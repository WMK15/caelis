import { describe, expect, it } from "vitest";

import { ProjectNotFoundError } from "./index.js";

describe("core errors", () => {
  it("creates typed actionable errors", () => {
    const error = new ProjectNotFoundError("/tmp/missing");

    expect(error.code).toBe("PROJECT_NOT_FOUND");
    expect(error.details).toEqual({ projectRoot: "/tmp/missing" });
  });
});
