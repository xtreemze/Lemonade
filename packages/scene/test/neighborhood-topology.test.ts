import { expect, it } from "vitest";

import {
  generateNeighborhoodTopology,
  type NeighborhoodPropertyTopology,
} from "../src/neighborhood-topology.js";
import {
  generateResidentialLayout,
  type ResidentialPropertySpec,
  residentialAccessLayout,
} from "../src/residential-layout.js";
import { generateStreetNetwork } from "../src/street-layout.js";
import { WORLD_SCALE } from "../src/world-scale.js";

const TOPOLOGY_SEED = 0x12_34_ab_cd;
const SIDEWALK_SEED = 0x42_42;
const PROPERTY_SEED = 0x5e_ed_12_34;
const FEATURED_HOME_SEED = 0x12_34;

const requiredProperty = (
  properties: readonly NeighborhoodPropertyTopology[],
  role: string,
): NeighborhoodPropertyTopology => {
  const projected = properties.find((candidate) => candidate.role === role);
  expect(projected).toBeDefined();
  if (projected === undefined) {
    throw new Error(`expected topology property ${role}`);
  }
  return projected;
};

const assertPropertyAccess = (
  projected: NeighborhoodPropertyTopology,
  property: ResidentialPropertySpec,
  seed: number,
): void => {
  const access = residentialAccessLayout(property, seed);
  expect(projected.house.center).toEqual({ x: property.houseX, z: property.houseZ });
  expect(projected.frontDirection).toBe(access.frontDirection);
  expect(projected.door).toEqual({ x: access.doorX, z: access.doorZ });
  expect(projected.entry).toEqual({ x: access.entryX, z: access.entryZ });
  expect(projected.path.sidewalkSegmentId.startsWith("sidewalk:")).toBe(true);
  expect(projected.path.sidewalkSegmentGap).toBeGreaterThanOrEqual(0);

  if (property.drivewayX === null) {
    expect(projected.driveway).toBeNull();
    return;
  }

  expect(projected.driveway).not.toBeNull();
  expect(projected.driveway?.parking).toEqual({ x: property.drivewayX, z: access.parkingZ });
  expect(projected.driveway?.roadEdge).toEqual({ x: access.roadEdgeX, z: access.roadEdgeZ });
  expect(projected.driveway?.roadSegmentId.startsWith("road:")).toBe(true);
  expect(projected.driveway?.roadSegmentGap).toBeGreaterThanOrEqual(0);
  expect(projected.driveway?.width).toBeCloseTo(WORLD_SCALE.street.drivewayWidth);
};

it("projects every generated street surface deterministically", () => {
  const network = generateStreetNetwork(TOPOLOGY_SEED);
  const first = generateNeighborhoodTopology(TOPOLOGY_SEED);
  const repeated = generateNeighborhoodTopology(TOPOLOGY_SEED);

  expect(repeated).toEqual(first);
  expect(first.roads).toHaveLength(network.roads.length);
  expect(first.sidewalks).toHaveLength(network.sidewalks.length);
  expect(new Set(first.roads.map((road) => road.id)).size).toBe(first.roads.length);
  expect(new Set(first.sidewalks.map((sidewalk) => sidewalk.id)).size).toBe(first.sidewalks.length);

  for (const road of first.roads) {
    expect(
      network.roads.some(
        (candidate) =>
          candidate.streetId === road.streetId && candidate.segmentIndex === road.segmentIndex,
      ),
    ).toBe(true);
    expect(road.width).toBeCloseTo(WORLD_SCALE.street.roadWidth);
  }
});

it("links each generated sidewalk to its parent road", () => {
  const topology = generateNeighborhoodTopology(SIDEWALK_SEED);
  const roadIds = new Set(topology.roads.map((road) => road.id));

  for (const sidewalk of topology.sidewalks) {
    expect(roadIds.has(sidewalk.parentRoadId)).toBe(true);
    expect(sidewalk.side === -1 || sidewalk.side === 1).toBe(true);
    expect(sidewalk.width).toBeCloseTo(WORLD_SCALE.street.sidewalkWidth);
  }
});

it("preserves semantic residential access anchors across all property groups", () => {
  const layout = generateResidentialLayout(PROPERTY_SEED);
  const topology = generateNeighborhoodTopology(PROPERTY_SEED);
  const groups = [
    ["front", layout.frontProperties],
    ["middle", layout.middleProperties],
    ["back", layout.backProperties],
    ["outer", layout.outerProperties],
  ] as const;
  const expectedCount = groups.reduce((count, [, properties]) => count + properties.length, 0);

  expect(topology.properties).toHaveLength(expectedCount);

  for (const [group, properties] of groups) {
    for (const property of properties) {
      const projected = requiredProperty(topology.properties, property.role);
      expect(projected.group).toBe(group);
      assertPropertyAccess(projected, property, PROPERTY_SEED);
    }
  }
});

it("keeps the featured stand home in the shared property topology", () => {
  const topology = generateNeighborhoodTopology(FEATURED_HOME_SEED);
  const standHome = requiredProperty(topology.properties, "stand-home");

  expect(standHome.group).toBe("front");
  expect(standHome.driveway).not.toBeNull();
  expect(standHome.path.length).toBeGreaterThan(0);
});
