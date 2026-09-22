import { Scene } from "three";
import { describe, expect, it } from "vitest";

import {
  FRONT_PROPERTY_LAYOUT,
  blocksFrontHouseFacade,
  populateNeighborhood,
  staticFootprintPlacementAllowed,
  staticSceneryPlacementAllowed,
  weatherWindStrength,
} from "../src/neighborhood.js";
import { STAND_LAYOUT } from "../src/stand-layout.js";
import { gardenSignPosition } from "../src/street-layout.js";

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
    expect(stats.yardDetails).toBeGreaterThanOrEqual(10);
    expect(stats.flowers).toBeGreaterThanOrEqual(8);
    expect(stats.pavedRoads).toBeGreaterThanOrEqual(3);
    expect(stats.windResponsive).toBeGreaterThanOrEqual(stats.treeLods + stats.shrubs);
    expect(stats.roadSegments).toBeGreaterThanOrEqual(13);

    let lodCount = 0;
    let standHomeCount = 0;
    let standNeighborCount = 0;
    let pavedRoadCount = 0;
    let flowerCount = 0;
    scene.traverse((object) => {
      if (object.userData["lodMode"] === "distance-two-level") lodCount += 1;
      if (object.userData["sceneRole"] === "stand-home") standHomeCount += 1;
      if (object.userData["sceneRole"] === "stand-neighbor") standNeighborCount += 1;
      if (object.userData["sceneRole"] === "paved-road") pavedRoadCount += 1;
      if (object.userData["sceneRole"] === "garden-flower") flowerCount += 1;
    });
    expect(lodCount).toBe(stats.houseLods + stats.treeLods);
    expect(standHomeCount).toBe(1);
    expect(standNeighborCount).toBe(1);
    expect(pavedRoadCount).toBe(stats.pavedRoads);
    expect(flowerCount).toBe(stats.flowers);
  });

  it("keeps scenery and advertising clear of roads, sidewalks, and driveways", () => {
    const scene = new Scene();
    populateNeighborhood(scene);
    const checkedRoles = new Set([
      "tree",
      "garden-shrub",
      "garden-flower",
      "mailbox",
      "fence",
    ]);
    let checkedScenery = 0;

    scene.traverse((object) => {
      const userData = object.userData as Record<string, unknown>;
      const role = userData["sceneRole"];
      if (typeof role !== "string" || !checkedRoles.has(role)) return;
      const clearanceHalfWidth = userData["clearanceHalfWidth"];
      const clearanceHalfDepth = userData["clearanceHalfDepth"];
      if (
        typeof clearanceHalfWidth === "number" &&
        typeof clearanceHalfDepth === "number"
      ) {
        expect(
          staticFootprintPlacementAllowed(
            object.position.x,
            object.position.z,
            clearanceHalfWidth,
            clearanceHalfDepth,
          ),
        ).toBe(true);
      } else {
        const clearanceRadiusValue = userData["clearanceRadius"];
        const clearanceRadius =
          typeof clearanceRadiusValue === "number" ? clearanceRadiusValue : 0;
        expect(
          staticSceneryPlacementAllowed(
            object.position.x,
            object.position.z,
            clearanceRadius,
          ),
        ).toBe(true);
      }
      if (role === "tree") {
        const clearanceRadiusValue = userData["clearanceRadius"];
        const clearanceRadius =
          typeof clearanceRadiusValue === "number" ? clearanceRadiusValue : 0;
        expect(
          blocksFrontHouseFacade(
            object.position.x,
            object.position.z,
            clearanceRadius,
          ),
        ).toBe(false);
      }
      checkedScenery += 1;
    });

    expect(checkedScenery).toBeGreaterThanOrEqual(73);

    for (let index = 0; index < 40; index += 1) {
      const sign = gardenSignPosition(index);
      expect(staticSceneryPlacementAllowed(sign.x, sign.z, 0.48)).toBe(true);
    }

    for (const property of FRONT_PROPERTY_LAYOUT) {
      expect(
        staticSceneryPlacementAllowed(property.mailboxX, -0.3, 0.3),
      ).toBe(true);
      expect(
        staticSceneryPlacementAllowed(property.drivewayX, -2.55, 0.1),
      ).toBe(false);

      const houseHalfWidth = (5.95 * property.scale) / 2;
      expect(Math.abs(property.houseX - property.drivewayX)).toBeGreaterThan(
        houseHalfWidth + 2.15 / 2,
      );
      expect(property.houseZ + (4.62 * property.scale) / 2).toBeLessThan(
        0.45,
      );
    }
  });

  it("makes storm wind materially stronger than ordinary weather", () => {
    expect(weatherWindStrength("sunny")).toBeGreaterThan(0);
    expect(weatherWindStrength("thunderstorm")).toBeGreaterThan(
      weatherWindStrength("cloudy") * 2,
    );
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
