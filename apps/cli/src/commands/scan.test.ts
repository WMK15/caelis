import { describe, expect, it } from "vitest";

import { formatAssetCountsForOutput } from "./scan.js";

describe("scan command output", () => {
  it("renders each normalized asset path once", () => {
    expect(
      formatAssetCountsForOutput([
        { folder: "audio", count: 10 },
        { folder: "audio/bgm", count: 5 },
        { folder: "audio/bgm", count: 5 },
        { folder: "img\\characters", count: 3 },
        { folder: "img/characters", count: 3 }
      ])
    ).toEqual([
      { folder: "audio", count: 10 },
      { folder: "audio/bgm", count: 5 },
      { folder: "img/characters", count: 3 }
    ]);
  });

  it("keeps different asset paths with identical counts", () => {
    expect(
      formatAssetCountsForOutput([
        { folder: "img/characters", count: 1 },
        { folder: "img/enemies", count: 1 }
      ])
    ).toEqual([
      { folder: "img/characters", count: 1 },
      { folder: "img/enemies", count: 1 }
    ]);
  });
});
