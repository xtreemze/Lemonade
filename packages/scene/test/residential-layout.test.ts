import { describe, expect, it } from "vitest";

import {
  DEFAULT_RESIDENTIAL_SEED,
  DRIVEWAY_HALF_WIDTH,
  HOUSE_FOOTPRINT_DEPTH,
  HOUSE_FOOTPRINT_WIDTH,
  generateResidentialLayout,
  residentialAccessLayout,
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
    expect(layout.shrubs.length).toBeGreaterThanOrEqual(20);
    expect(layout.flowers.length).toBeGreaterThanOrEqual(12);

    const blockedHouses = [
      ...layout.frontProperties,
      ...layout.middleProperties,
      ...layout.backProperties,
      ...layout.outerProperties,
    ].flatMap((property) => {
      const localHalfWidth = (HOUSE_FOOTPRINT_WIDTH * property.scale) / 2;
      const localHalfDepth = (HOUSE_FOOTPRINT_DEPTH * property.scale) / 2;
      const cosine = Math.abs(Math.cos(property.rotationY));
      const sine = Math.abs(Math.sin(property.rotationY));
      const blocked = residentialFootprintIntersectsHardscape(
        { x: property.houseX, z: property.houseZ },
        layout,
        localHalfWidth * cosine + localHalfDepth * sine,
        localHalfWidth * sine + localHalfDepth * cosine,
      );
      return blocked
        ? [
            {
              role: property.role,
              x: Number(property.houseX.toFixed(2)),
              z: Number(property.houseZ.toFixed(2)),
              drivewayX:
                property.drivewayX === null
                  ? null
                  : Number(property.drivewayX.toFixed(2)),
            },
          ]
        : [];
    });
    expect(blockedHouses).toEqual([]);

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
      expect(residentialPointIsBlocked(planting, layout, 0.38)).toBe(false);
    }
  });

  it("connects every home path to a sidewalk and every driveway through the sidewalk to a road", () => {
    const layout = generateResidentialLayout(0x51de);
    const allProperties = [
      ...layout.frontProperties,
      ...layout.middleProperties,
      ...layout.backProperties,
      ...layout.outerProperties,
    ];
    const overlaps = (
      left: (typeof layout.exclusions)[number],
      right: (typeof layout.exclusions)[number],
      margin = 0.16,
    ): boolean =>
      left.maxX + margin >= right.minX &&
      left.minX - margin <= right.maxX &&
      left.maxZ + margin >= right.minZ &&
      left.minZ - margin <= right.maxZ;

    for (const property of allProperties) {
      expect(property.drivewayX).not.toBeNull();
      if (property.drivewayX === null) continue;
      const access = residentialAccessLayout(property, layout.seed);
      const path = layout.exclusions.find(
        (rect) =>
          rect.role === "path" &&
          Math.abs((rect.minX + rect.maxX) / 2 - access.pathCenterX) < 0.02 &&
          Math.abs((rect.minZ + rect.maxZ) / 2 - access.pathCenterZ) < 0.02,
      );
      const driveway = layout.exclusions.find(
        (rect) =>
          rect.role === "driveway" &&
          Math.abs(
            (rect.minX + rect.maxX) / 2 - access.drivewayCenterX,
          ) < 0.02 &&
          Math.abs(
            (rect.minZ + rect.maxZ) / 2 - access.drivewayCenterZ,
          ) < 0.02,
      );
      expect(path).toBeDefined();
      expect(driveway).toBeDefined();
      if (path === undefined || driveway === undefined) continue;

      expect(
        layout.exclusions.some(
          (rect) => rect.role === "sidewalk" && overlaps(path, rect),
        ),
      ).toBe(true);
      expect(
        layout.exclusions.some(
          (rect) => rect.role === "sidewalk" && overlaps(driveway, rect),
        ),
      ).toBe(true);
      expect(
        layout.exclusions.some(
          (rect) => rect.role === "road" && overlaps(driveway, rect),
        ),
      ).toBe(true);
    }
  });

  it("assigns most homes a backyard tree plus grouped front-yard planting zones", () => {
    const layout = generateResidentialLayout(0x7a11);
    const allProperties = [
      ...layout.frontProperties,
      ...layout.middleProperties,
      ...layout.backProperties,
      ...layout.outerProperties,
    ];
    const byRole = new Map(allProperties.map((property) => [property.role, property]));

    const backyardTrees = layout.trees.filter(
      (planting) =>
        planting.propertyRole !== null && planting.yardZone === "back",
    );
    expect(backyardTrees.length).toBeGreaterThan(
      layout.trees.length / 2,
    );
    for (const tree of backyardTrees) {
      const property =
        tree.propertyRole === null ? undefined : byRole.get(tree.propertyRole);
      expect(property).toBeDefined();
      if (property === undefined) continue;
      const access = residentialAccessLayout(property, layout.seed);
      expect((tree.z - property.houseZ) * access.frontDirection).toBeLessThan(0);
    }

    const detailedRoles = new Set(
      [
        ...layout.frontProperties,
        ...layout.middleProperties,
        ...layout.backProperties,
      ].map((property) => property.role),
    );
    expect(
      layout.shrubs.filter(
        (planting) =>
          planting.propertyRole !== null &&
          detailedRoles.has(planting.propertyRole),
      ).length,
    ).toBeGreaterThanOrEqual(12);
    expect(
      layout.flowers.filter(
        (planting) =>
          planting.propertyRole !== null &&
          detailedRoles.has(planting.propertyRole),
      ).length,
    ).toBeGreaterThanOrEqual(12);
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
