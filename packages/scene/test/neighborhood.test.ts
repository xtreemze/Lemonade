import { Scene } from "three";
import { describe, expect, it } from "vitest";

import { populateNeighborhood } from "../src/neighborhood.js";

describe("neighborhood world scale", () => {
  it("extends the world with LOD scenery beyond the cinematic camera envelope", () => {
    const scene = new Scene();
    const stats = populateNeighborhood(scene);

    expect(stats.worldSpan).toBeGreaterThanOrEqual(140);
    expect(stats.houseLods).toBeGreaterThanOrEqual(17);
    expect(stats.featuredHomes).toBe(1);
    expect(stats.treeLods).toBeGreaterThanOrEqual(40);
    expect(stats.yardDetails).toBeGreaterThanOrEqual(3);
    expect(stats.roadSegments).toBeGreaterThanOrEqual(7);

    let lodCount = 0;
    let standHomeCount = 0;
    scene.traverse((object) => {
      if (object.userData["lodMode"] === "distance-two-level") lodCount += 1;
      if (object.userData["sceneRole"] === "stand-home") standHomeCount += 1;
    });
    expect(lodCount).toBe(stats.houseLods + stats.treeLods);
    expect(standHomeCount).toBe(1);
  });
});
