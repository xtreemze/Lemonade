import { Scene } from "three";
import { describe, expect, it } from "vitest";

import { populateNeighborhood } from "../src/neighborhood.js";

describe("neighborhood world scale", () => {
  it("extends the world with LOD scenery beyond the cinematic camera envelope", () => {
    const scene = new Scene();
    const stats = populateNeighborhood(scene);

    expect(stats.worldSpan).toBeGreaterThanOrEqual(140);
    expect(stats.houseLods).toBeGreaterThanOrEqual(16);
    expect(stats.treeLods).toBeGreaterThanOrEqual(40);
    expect(stats.roadSegments).toBeGreaterThanOrEqual(6);

    let lodCount = 0;
    scene.traverse((object) => {
      if (object.userData["lodMode"] === "distance-two-level") lodCount += 1;
    });
    expect(lodCount).toBe(stats.houseLods + stats.treeLods);
  });
});
