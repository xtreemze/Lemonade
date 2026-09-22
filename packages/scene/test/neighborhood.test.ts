import { Scene } from "three";
import { describe, expect, it } from "vitest";

import {
  populateNeighborhood,
  weatherWindStrength,
} from "../src/neighborhood.js";

describe("neighborhood world scale", () => {
  it("extends the world with LOD scenery, paved streets, gardens, and wind-responsive planting", () => {
    const scene = new Scene();
    const stats = populateNeighborhood(scene);

    expect(stats.worldSpan).toBeGreaterThanOrEqual(140);
    expect(stats.houseLods).toBeGreaterThanOrEqual(17);
    expect(stats.featuredHomes).toBe(1);
    expect(stats.treeLods).toBeGreaterThanOrEqual(40);
    expect(stats.yardDetails).toBeGreaterThanOrEqual(3);
    expect(stats.flowers).toBeGreaterThanOrEqual(8);
    expect(stats.pavedRoads).toBeGreaterThanOrEqual(3);
    expect(stats.windResponsive).toBeGreaterThanOrEqual(stats.treeLods + stats.shrubs);
    expect(stats.roadSegments).toBeGreaterThanOrEqual(7);

    let lodCount = 0;
    let standHomeCount = 0;
    let pavedRoadCount = 0;
    let flowerCount = 0;
    scene.traverse((object) => {
      if (object.userData["lodMode"] === "distance-two-level") lodCount += 1;
      if (object.userData["sceneRole"] === "stand-home") standHomeCount += 1;
      if (object.userData["sceneRole"] === "paved-road") pavedRoadCount += 1;
      if (object.userData["sceneRole"] === "garden-flower") flowerCount += 1;
    });
    expect(lodCount).toBe(stats.houseLods + stats.treeLods);
    expect(standHomeCount).toBe(1);
    expect(pavedRoadCount).toBe(stats.pavedRoads);
    expect(flowerCount).toBe(stats.flowers);
  });

  it("makes storm wind materially stronger than ordinary weather", () => {
    expect(weatherWindStrength("sunny")).toBeGreaterThan(0);
    expect(weatherWindStrength("thunderstorm")).toBeGreaterThan(
      weatherWindStrength("cloudy") * 2,
    );
  });
});
