import { describe, expect, it } from "vitest";

import { InMemoryProjectGraph } from "./index.js";

describe("project graph", () => {
  it("stores entities and relationships", () => {
    const graph = new InMemoryProjectGraph();
    graph.addEntity({
      key: "actor:1",
      type: "actor",
      name: "Hero",
      sourcePath: "data/Actors.json"
    });
    graph.addEntity({
      key: "class:1",
      type: "class",
      name: "Warrior",
      sourcePath: "data/Classes.json"
    });
    graph.addRelationship({
      from: "actor:1",
      type: "uses-class",
      to: "class:1"
    });

    expect(graph.getNeighbours("actor:1")?.outgoing).toHaveLength(1);
    expect(graph.getEntities()).toHaveLength(2);
  });
});
