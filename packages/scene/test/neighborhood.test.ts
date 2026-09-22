import { Box3, Scene } from "three";
import { describe, expect, it } from "vitest";

import {
  FRONT_PROPERTY_LAYOUT,
  populateNeighborhood,
  weatherWindStrength,
} from "../src/neighborhood.js";
import {
  DEFAULT_RESIDENTIAL_SEED,
  generateResidentialLayout,
  residentialFootprintIntersectsHardscape,
  residentialPointIsBlocked,
} from "../src/residential-layout.js";
import { STAND_LAYOUT } from "../src/stand-layout.js";
import { gardenSignPosition, STREET_LAYOUT } from "../src/street-layout.js";

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
    const treeVariants = new Set<number>();
    const shrubVariants = new Set<number>();
    scene.traverse((object) => {
      if (object.userData["lodMode"] === "distance-two-level") lodCount += 1;
      if (object.userData["sceneRole"] === "stand-home") standHomeCount += 1;
      if (object.userData["sceneRole"] === "stand-neighbor") standNeighborCount += 1;
      if (object.userData["sceneRole"] === "paved-road") pavedRoadCount += 1;
      if (object.userData["sceneRole"] === "garden-flower") flowerCount += 1;
      const variant: unknown = object.userData["plantVariant"];
      if (
        object.userData["sceneRole"] === "procedural-tree" &&
        typeof variant === "number"
      ) {
        treeVariants.add(variant);
      }
      if (
        object.userData["sceneRole"] === "procedural-shrub" &&
        typeof variant === "number"
      ) {
        shrubVariants.add(variant);
      }
    });
    expect(lodCount).toBe(stats.houseLods + stats.treeLods + stats.shrubs);
    expect(standHomeCount).toBe(1);
    expect(standNeighborCount).toBe(1);
    expect(pavedRoadCount).toBe(stats.pavedRoads);
    expect(flowerCount).toBe(stats.flowers);
    expect(treeVariants.size).toBeGreaterThan(8);
    expect(shrubVariants.size).toBeGreaterThan(4);
  });

  it("keeps rendered static scenery and signs off roads, sidewalks, and driveways", () => {
    const layout = generateResidentialLayout(DEFAULT_RESIDENTIAL_SEED);
    const scene = new Scene();
    populateNeighborhood(scene, DEFAULT_RESIDENTIAL_SEED);

    const checkedRoles = new Set([
      "procedural-tree",
      "procedural-shrub",
      "garden-flower",
      "mailbox",
      "fence",
    ]);
    let checkedScenery = 0;

    scene.updateMatrixWorld(true);
    scene.traverse((object) => {
      const role: unknown = object.userData["sceneRole"];
      if (typeof role !== "string" || !checkedRoles.has(role)) return;

      const bounds = new Box3().setFromObject(object);
      const centerX = (bounds.min.x + bounds.max.x) / 2;
      const centerZ = (bounds.min.z + bounds.max.z) / 2;
      const halfWidth = (bounds.max.x - bounds.min.x) / 2;
      const halfDepth = (bounds.max.z - bounds.min.z) / 2;

      expect(
        residentialFootprintIntersectsHardscape(
          { x: centerX, z: centerZ },
          layout,
          halfWidth,
          halfDepth,
        ),
      ).toBe(false);

      if (role === "procedural-tree") {
        expect(
          residentialPointIsBlocked(
            { x: object.position.x, z: object.position.z },
            layout,
            Math.max(halfWidth, halfDepth),
          ),
        ).toBe(false);
      }
      checkedScenery += 1;
    });

    expect(checkedScenery).toBeGreaterThanOrEqual(80);

    for (let index = 0; index < 40; index += 1) {
      const sign = gardenSignPosition(index);
      expect(sign.z).toBeLessThan(STREET_LAYOUT.nearSidewalk.minZ);
      expect(
        residentialFootprintIntersectsHardscape(
          { x: sign.x, z: sign.z },
          layout,
          0.48,
          0.12,
        ),
      ).toBe(false);
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

  it("faces every mailbox toward the street independent of house orientation", () => {
    const scene = new Scene();
    populateNeighborhood(scene, 0x5eed);
    const mailboxes = scene.children.filter(
      (object) => object.userData["sceneRole"] === "mailbox",
    );
    const expectedCount = FRONT_PROPERTY_LAYOUT.filter(
      (property) => property.mailboxX !== null,
    ).length;

    expect(mailboxes).toHaveLength(expectedCount);
    expect(
      FRONT_PROPERTY_LAYOUT.some((property) => Math.abs(property.rotationY) > 0.02),
    ).toBe(true);
    for (const mailbox of mailboxes) {
      expect(mailbox.rotation.y).toBeCloseTo(0);
      const streetFacingYaw: unknown = mailbox.userData["streetFacingYaw"];
      expect(streetFacingYaw).toBe(0);
    }
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
