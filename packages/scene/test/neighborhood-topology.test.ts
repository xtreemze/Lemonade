import { describe, expect, it } from "vitest";

import { generateNeighborhoodTopology } from "../src/neighborhood-topology.js";
import { generateResidentialLayout, residentialAccessLayout } from "../src/residential-layout.js";
import { generateStreetNetwork } from "../src/street-layout.js";
import { WORLD_SCALE } from "../src/world-scale.js";

describe("renderer-neutral neighborhood topology", () => {
  it("is deterministic and projects every generated street surface", () => {
    const seed = 0x12_34_ab_cd;
    const network = generateStreetNetwork(seed);
    const first = generateNeighborhoodTopology(seed);
    const repeated = generateNeighborhoodTopology(seed);

    expect(repeated).toEqual(first);
    expect(first.roads).toHaveLength(network.roads.length);
    expect(first.sidewalks).toHaveLength(network.sidewalks.length);
    expect(new Set(first.roads.map((road) => road.id)).size).toBe(first.roads.length);
    expect(new Set(first.sidewalks.map((sidewalk) => sidewalk.id)).size).toBe(
      first.sidewalks.length,
    );

    for (const road of first.roads) {
      const source = network.roads.find(
        (candidate) =>
          candidate.streetId === road.streetId && candidate.segmentIndex === road.segmentIndex,
      );
      expect(source).toBeDefined();
      expect(road.width).toBeCloseTo(WORLD_SCALE.street.roadWidth);
    }
  });

  it("links each sidewalk to its generated parent road", () => {
    const topology = generateNeighborhoodTopology(0x42_42);
    const roadIds = new Set(topology.roads.map((road) => road.id));

    for (const sidewalk of topology.sidewalks) {
      expect(roadIds.has(sidewalk.parentRoadId)).toBe(true);
      expect(sidewalk.side === -1 || sidewalk.side === 1).toBe(true);
      expect(sidewalk.width).toBeCloseTo(WORLD_SCALE.street.sidewalkWidth);
    }
  });

  it("projects every residential property and preserves semantic access anchors", () => {
    const seed = 0x5e_ed_12_34;
    const layout = generateResidentialLayout(seed);
    const topology = generateNeighborhoodTopology(seed);
    const expectedGroups = [
      ["front", layout.frontProperties],
      ["middle", layout.middleProperties],
      ["back", layout.backProperties],
      ["outer", layout.outerProperties],
    ] as const;
    const allProperties = expectedGroups.flatMap(([, properties]) => properties);

    expect(topology.properties).toHaveLength(allProperties.length);

    for (const [group, properties] of expectedGroups) {
      for (const property of properties) {
        const projected = topology.properties.find((candidate) => candidate.role === property.role);
        expect(projected).toBeDefined();
        if (projected === undefined) {
          continue;
        }

        const access = residentialAccessLayout(property, seed);
        expect(projected.group).toBe(group);
        expect(projected.house.center).toEqual({
          x: property.houseX,
          z: property.houseZ,
        });
        expect(projected.frontDirection).toBe(access.frontDirection);
        expect(projected.door).toEqual({
          x: access.doorX,
          z: access.doorZ,
        });
        expect(projected.entry).toEqual({
          x: access.entryX,
          z: access.entryZ,
        });
        expect(projected.path.sidewalkSegmentId.startsWith("sidewalk:")).toBe(true);
        expect(projected.path.sidewalkSegmentGap).toBeGreaterThanOrEqual(0);

        if (property.drivewayX === null) {
          expect(projected.driveway).toBeNull();
          continue;
        }

        expect(projected.driveway).not.toBeNull();
        expect(projected.driveway?.parking).toEqual({
          x: property.drivewayX,
          z: access.parkingZ,
        });
        expect(projected.driveway?.roadEdge).toEqual({
          x: access.roadEdgeX,
          z: access.roadEdgeZ,
        });
        expect(projected.driveway?.roadSegmentId.startsWith("road:")).toBe(true);
        expect(projected.driveway?.roadSegmentGap).toBeGreaterThanOrEqual(0);
        expect(projected.driveway?.width).toBeCloseTo(WORLD_SCALE.street.drivewayWidth);
      }
    }
  });

  it("keeps the featured stand home in the same topology contract as other residences", () => {
    const topology = generateNeighborhoodTopology(1234);
    const standHome = topology.properties.find((property) => property.role === "stand-home");

    expect(standHome).toBeDefined();
    expect(standHome?.group).toBe("front");
    expect(standHome?.driveway).not.toBeNull();
    expect(standHome?.path.length).toBeGreaterThan(0);
  });
});
