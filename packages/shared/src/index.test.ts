import { describe, expect, it } from "vitest";

import { normalizePath, ok, sha256 } from "./index.js";

describe("shared utilities", () => {
  it("hashes content with sha256", () => {
    expect(sha256("caelis")).toHaveLength(64);
  });

  it("creates success results", () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });

  it("normalizes path separators", () => {
    expect(normalizePath("a/b")).toBe("a/b");
  });
});
