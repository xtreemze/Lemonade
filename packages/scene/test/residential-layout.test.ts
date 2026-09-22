import { describe, expect, it } from "vitest";

import {
  DEFAULT_RESIDENTIAL_SEED,
  DRIVEWAY_HALF_WIDTH,
  HOUSE_FOOTPRINT_DEPTH,
  HOUSE_FOOTPRINT_WIDTH,
  generateResidentialLayout,
  residentialFootprintIntersectsHardscape,
  residentialPointIsBlocked,
} from "../src/residential-layout.js";
import { STAND_LAYOUT } from "../src/stand-layout.js";

describe("procedural residential layout", () => {
  it("is deterministic per seed and varies non-featured properties across seeds", () => {
    const first = generateResidentialLayout(DEFAULT_RESIDENTIAL_SEED);
    expect(generateResidentialLayout(DEFAULT_RESIDENTIAL_SEED)).toEqual(first);

    const alternate = generateResidentialLayout(DEFAULT_RESIDENTIAL_SEED + 1);
    expect(alternate.middleProperties).not.toEqual(first.middleProperties);
    expect(alternate.trees).not.toEqual(first.trees);
  });

  it("keeps the featured stand property stable beside its driveway and neighbor", () => {
    const layout = generateResidentialLayout(1234);
    const standHome = layout.frontProperties.find((property) => property.role === "stand-home");
    const neighbor = layout.frontProperties.find((property) => property.role === "stand-neighbor");
    expect(standHome).toBeDefined();
    expect(neighbor).toBeDefined();
    if (standHome === undefined || neighbor === undefined) return;

    const sharedBoundaryX = (standHome.houseX + neighbor.houseX) / 2;
    const standRightEdge = STAND_LAYOUT.body.size[0] / 2;
    expect(standHome.drivewayX).not.toBeNull();
    expect(standHome.drivewayX ?? 0).toBeLessThan(standHome.houseX);
    expect(sharedBoundaryX).toBeGreaterThan(standRightEdge);
    expect(sharedBoundaryX - standRightEdge).toBeLessThan(0.75);
  });

  it("keeps mailbox anchors outside their driveway footprints", () => {
    const layout = generateResidentialLayout(4321);

    for (const property of layout.frontProperties) {
      if (property.drivewayX === null || property.mailboxX === null) continue;
      expect(Math.abs(property.mailboxX - property.drivewayX)).toBeGreaterThan(
        DRIVEWAY_HALF_WIDTH + 0.3,
      );
      expect(
        residentialFootprintIntersectsHardscape(
          { x: property.mailboxX, z: -0.3 },
          layout,
          0.3,
          0.3,
        ),
      ).toBe(false);
    }
  });

  it("keeps complete house and planting footprints out of roads, sidewalks, driveways and house fronts", () => {
    const layout = generateResidentialLayout(0xdecafbad);
    expect(layout.trees).toHaveLength(72);
    expect(layout.shrubs).toHaveLength(20);
    expect(layout.flowers).toHaveLength(12);

    for (const property of [
      ...layout.frontProperties,
      ...layout.middleProperties,
      ...layout.backProperties,
      ...layout.outerProperties,
    ]) {
      const localHalfWidth = (HOUSE_FOOTPRINT_WIDTH * property.scale) / 2;
      const localHalfDepth = (HOUSE_FOOTPRINT_DEPTH * property.scale) / 2;
      const cosine = Math.abs(Math.cos(property.rotationY));
      const sine = Math.abs(Math.sin(property.rotationY));
      expect(
        residentialFootprintIntersectsHardscape(
          { x: property.houseX, z: property.houseZ },
          layout,
          localHalfWidth * cosine + localHalfDepth * sine,
          localHalfWidth * sine + localHalfDepth * cosine,
        ),
      ).toBe(false);
    }

    for (const planting of layout.trees) {
      const clearance = 3.5 * planting.scale;
      expect(residentialPointIsBlocked(planting, layout, clearance)).toBe(false);
      expect(
        residentialFootprintIntersectsHardscape(
          planting,
          layout,
          clearance,
          clearance,
        ),
      ).toBe(false);
    }
    for (const planting of layout.shrubs) {
      const clearance = 1.9 * planting.scale;
      expect(residentialPointIsBlocked(planting, layout, clearance)).toBe(false);
    }
    for (const planting of layout.flowers) {
      expect(residentialPointIsBlocked(planting, layout, 0.16)).toBe(false);
    }
  });

  it("produces a continuous asymmetric residential population", () => {
    const layout = generateResidentialLayout(555);
    expect(layout.frontProperties).toHaveLength(7);
    expect(layout.middleProperties).toHaveLength(8);
    expect(layout.backProperties).toHaveLength(9);
    expect(layout.outerProperties).toHaveLength(24);
    expect(layout.outerProperties.some((property) => property.houseZ > 12)).toBe(true);
    expect(layout.outerProperties.some((property) => property.houseZ < -58)).toBe(true);
    expect(layout.outerProperties.some((property) => Math.abs(property.houseX) > 65)).toBe(true);

    for (const property of [
      ...layout.frontProperties,
      ...layout.middleProperties,
      ...layout.backProperties,
      ...layout.outerProperties,
    ]) {
      expect(property.drivewayX).not.toBeNull();
    }

    const xs = layout.frontProperties.map((property) => property.houseX);
    const mirrored = xs.filter((x) => xs.some((candidate) => Math.abs(candidate + x) < 0.25));
    expect(mirrored).toHaveLength(0);
    expect(new Set(layout.frontProperties.map((property) => property.houseZ)).size)
      .toBeGreaterThanOrEqual(5);
  });
});
