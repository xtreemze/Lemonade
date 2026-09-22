import { describe, expect, it } from "vitest";

import {
  DEFAULT_RESIDENTIAL_SEED,
  generateResidentialLayout,
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
      expect(Math.abs(property.mailboxX - property.drivewayX)).toBeGreaterThan(1.2);
    }
  });

  it("keeps all generated planting anchors out of roads, sidewalks, driveways and house fronts", () => {
    const layout = generateResidentialLayout(0xdecafbad);
    expect(layout.trees).toHaveLength(48);
    expect(layout.shrubs).toHaveLength(14);
    expect(layout.flowers).toHaveLength(12);

    for (const planting of [...layout.trees, ...layout.shrubs, ...layout.flowers]) {
      expect(residentialPointIsBlocked(planting, layout)).toBe(false);
    }
  });

  it("produces a continuous asymmetric residential population", () => {
    const layout = generateResidentialLayout(555);
    expect(layout.frontProperties).toHaveLength(7);
    expect(layout.middleProperties).toHaveLength(8);
    expect(layout.backProperties).toHaveLength(9);

    const xs = layout.frontProperties.map((property) => property.houseX);
    const mirrored = xs.filter((x) => xs.some((candidate) => Math.abs(candidate + x) < 0.25));
    expect(mirrored).toHaveLength(0);
    expect(new Set(layout.frontProperties.map((property) => property.houseZ)).size)
      .toBeGreaterThanOrEqual(5);
  });
});
