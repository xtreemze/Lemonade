import { Scene } from "three";
import { describe, expect, it } from "vitest";

import {
  FRONT_PROPERTY_LAYOUT,
  populateNeighborhood,
  updateNeighborhoodWind,
  windStrengthForWeather,
} from "../src/neighborhood.js";
import { STAND_LAYOUT } from "../src/stand-layout.js";

describe("neighborhood world scale", () => {
  it("extends the world with LOD scenery beyond the cinematic camera envelope", () => {
    const scene = new Scene();
    const stats = populateNeighborhood(scene);

    expect(stats.worldSpan).toBeGreaterThanOrEqual(140);
    expect(stats.houseLods).toBeGreaterThanOrEqual(24);
    expect(stats.featuredHomes).toBe(1);
    expect(stats.frontProperties).toBeGreaterThanOrEqual(7);
    expect(stats.driveways).toBe(stats.frontProperties);
    expect(stats.treeLods).toBeGreaterThanOrEqual(40);
    expect(stats.flowers).toBeGreaterThanOrEqual(4);
    expect(stats.yardDetails).toBeGreaterThanOrEqual(14);
    expect(stats.roadSegments).toBeGreaterThanOrEqual(13);

    let lodCount = 0;
    let standHomeCount = 0;
    let standNeighborCount = 0;
    let sidewalkCount = 0;
    let pavedRoadCount = 0;
    let flowerCount = 0;
    scene.traverse((object) => {
      if (object.userData["lodMode"] === "distance-two-level") lodCount += 1;
      if (object.userData["sceneRole"] === "stand-home") standHomeCount += 1;
      if (object.userData["sceneRole"] === "stand-neighbor") standNeighborCount += 1;
      if (object.userData["sceneRole"] === "sidewalk") sidewalkCount += 1;
      if (object.userData["sceneRole"] === "paved-road") pavedRoadCount += 1;
      if (object.userData["sceneRole"] === "garden-flowers") flowerCount += 1;
    });
    expect(lodCount).toBe(stats.houseLods + stats.treeLods);
    expect(standHomeCount).toBe(1);
    expect(standNeighborCount).toBe(1);
    expect(sidewalkCount).toBe(2);
    expect(pavedRoadCount).toBeGreaterThanOrEqual(10);
    expect(flowerCount).toBe(stats.flowers);
  });

  it("puts the stand in the featured garden beside its driveway and near the next property", () => {
    const standHome = FRONT_PROPERTY_LAYOUT.find(
      (property) => property.role === "stand-home",
    );
    const neighbor = FRONT_PROPERTY_LAYOUT.find(
      (property) => property.role === "stand-neighbor",
    );
    expect(standHome).toBeDefined();
    expect(neighbor).toBeDefined();
    if (standHome === undefined || neighbor === undefined) return;

    const sharedBoundaryX = (standHome.houseX + neighbor.houseX) / 2;
    const standRightEdge = STAND_LAYOUT.body.size[0] / 2;

    expect(standHome.houseX).toBeLessThan(-3);
    expect(standHome.drivewayX).toBeLessThan(standHome.houseX);
    expect(sharedBoundaryX).toBeGreaterThan(standRightEdge);
    expect(sharedBoundaryX - standRightEdge).toBeLessThan(0.75);
  });

  it("moves vegetation subtly with stronger storm wind", () => {
    const scene = new Scene();
    populateNeighborhood(scene);
    const vegetation = scene.children.find(
      (object) => object.userData["sceneRole"] === "wind-vegetation",
    );
    expect(vegetation).toBeDefined();

    updateNeighborhoodWind(scene, 1.25, windStrengthForWeather("sunny"));
    const sunnyTilt = Math.abs(vegetation?.rotation.z ?? 0);
    updateNeighborhoodWind(scene, 1.25, windStrengthForWeather("thunderstorm"));
    const stormTilt = Math.abs(vegetation?.rotation.z ?? 0);

    expect(windStrengthForWeather("thunderstorm"))
      .toBeGreaterThan(windStrengthForWeather("sunny"));
    expect(stormTilt).toBeGreaterThan(sunnyTilt);
  });

  it("avoids mirrored front-property repetition", () => {
    const xs = FRONT_PROPERTY_LAYOUT.map((property) => property.houseX);
    const mirrored = xs.filter((x) =>
      xs.some((candidate) => Math.abs(candidate + x) < 0.25),
    );

    expect(mirrored).toHaveLength(0);
    expect(new Set(FRONT_PROPERTY_LAYOUT.map((property) => property.houseZ)).size)
      .toBeGreaterThanOrEqual(5);
  });
});
