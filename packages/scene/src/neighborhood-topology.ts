import {
  DEFAULT_RESIDENTIAL_SEED,
  generateResidentialLayout,
  type ResidentialPoint,
  type ResidentialPropertySpec,
  residentialAccessLayout,
} from "./residential-layout.js";
import { generateStreetNetwork, type StreetStripSpec } from "./street-layout.js";
import { WORLD_SCALE } from "./world-scale.js";

export type NeighborhoodTopologySide = -1 | 1;

export type NeighborhoodRoadSegment = Readonly<{
  id: string;
  streetId: string;
  segmentIndex: number;
  center: ResidentialPoint;
  start: ResidentialPoint;
  end: ResidentialPoint;
  length: number;
  width: number;
  rotationY: number;
}>;

export type NeighborhoodSidewalkSegment = Readonly<{
  id: string;
  streetId: string;
  segmentIndex: number;
  parentRoadId: string;
  side: NeighborhoodTopologySide;
  center: ResidentialPoint;
  start: ResidentialPoint;
  end: ResidentialPoint;
  length: number;
  width: number;
  rotationY: number;
}>;

export type NeighborhoodRoadJunction = Readonly<{
  id: string;
  point: ResidentialPoint;
  roadSegmentIds: readonly [string, string];
  streetIds: readonly [string, string];
}>;

export type NeighborhoodPropertyGroup = "front" | "middle" | "back" | "outer";

export type NeighborhoodPropertyTopology = Readonly<{
  id: string;
  role: string;
  group: NeighborhoodPropertyGroup;
  house: Readonly<{
    center: ResidentialPoint;
    scale: number;
    rotationY: number;
  }>;
  frontDirection: -1 | 1;
  door: ResidentialPoint;
  entry: ResidentialPoint;
  path: Readonly<{
    center: ResidentialPoint;
    length: number;
    width: number;
    rotationY: number;
    sidewalkEdge: ResidentialPoint;
    sidewalkSegmentId: string;
    sidewalkSegmentGap: number;
  }>;
  driveway: Readonly<{
    center: ResidentialPoint;
    length: number;
    width: number;
    rotationY: number;
    parking: ResidentialPoint;
    roadEdge: ResidentialPoint;
    roadSegmentId: string;
    roadSegmentGap: number;
  }> | null;
}>;

export type NeighborhoodTopology = Readonly<{
  seed: number;
  roads: readonly NeighborhoodRoadSegment[];
  sidewalks: readonly NeighborhoodSidewalkSegment[];
  junctions: readonly NeighborhoodRoadJunction[];
  properties: readonly NeighborhoodPropertyTopology[];
}>;

type StripMatch = Readonly<{
  strip: StreetStripSpec;
  gap: number;
}>;

const point = (x: number, z: number): ResidentialPoint => Object.freeze({ x, z });

const stripEndpoint = (strip: StreetStripSpec, direction: -1 | 1): ResidentialPoint => {
  const halfLength = strip.length / 2;
  return point(
    strip.x + Math.cos(strip.rotationY) * halfLength * direction,
    strip.z + Math.sin(strip.rotationY) * halfLength * direction,
  );
};

const roadSegmentId = (strip: Pick<StreetStripSpec, "streetId" | "segmentIndex">): string =>
  `road:${strip.streetId}:${String(strip.segmentIndex)}`;

const sidewalkSegmentId = (strip: Pick<StreetStripSpec, "streetId" | "segmentIndex">): string =>
  `sidewalk:${strip.streetId}:${String(strip.segmentIndex)}`;

const projectRoad = (strip: StreetStripSpec): NeighborhoodRoadSegment =>
  Object.freeze({
    id: roadSegmentId(strip),
    streetId: strip.streetId,
    segmentIndex: strip.segmentIndex,
    center: point(strip.x, strip.z),
    start: stripEndpoint(strip, -1),
    end: stripEndpoint(strip, 1),
    length: strip.length,
    width: strip.width,
    rotationY: strip.rotationY,
  });

const lineSegmentIntersection = (
  first: Pick<NeighborhoodRoadSegment, "start" | "end">,
  second: Pick<NeighborhoodRoadSegment, "start" | "end">,
): ResidentialPoint | null => {
  const firstDx = first.end.x - first.start.x;
  const firstDz = first.end.z - first.start.z;
  const secondDx = second.end.x - second.start.x;
  const secondDz = second.end.z - second.start.z;
  const denominator = firstDx * secondDz - firstDz * secondDx;
  if (Math.abs(denominator) < 1e-8) {
    return null;
  }

  const deltaX = second.start.x - first.start.x;
  const deltaZ = second.start.z - first.start.z;
  const firstT = (deltaX * secondDz - deltaZ * secondDx) / denominator;
  const secondT = (deltaX * firstDz - deltaZ * firstDx) / denominator;
  const tolerance = 1e-6;
  if (
    firstT < -tolerance ||
    firstT > 1 + tolerance ||
    secondT < -tolerance ||
    secondT > 1 + tolerance
  ) {
    return null;
  }

  return point(first.start.x + firstDx * firstT, first.start.z + firstDz * firstT);
};

const junctionId = (
  first: NeighborhoodRoadSegment,
  second: NeighborhoodRoadSegment,
  pointValue: ResidentialPoint,
): string => {
  const streetIds = [first.streetId, second.streetId].sort();
  return `junction:${streetIds[0]}:${streetIds[1]}:${pointValue.x.toFixed(3)}:${pointValue.z.toFixed(3)}`;
};

const projectJunctions = (
  roads: readonly NeighborhoodRoadSegment[],
): readonly NeighborhoodRoadJunction[] => {
  const result = new Map<string, NeighborhoodRoadJunction>();

  for (let firstIndex = 0; firstIndex < roads.length; firstIndex += 1) {
    const first = roads[firstIndex];
    if (first === undefined) {
      continue;
    }
    for (let secondIndex = firstIndex + 1; secondIndex < roads.length; secondIndex += 1) {
      const second = roads[secondIndex];
      if (second === undefined || first.streetId === second.streetId) {
        continue;
      }
      const intersection = lineSegmentIntersection(first, second);
      if (intersection === null) {
        continue;
      }

      const id = junctionId(first, second, intersection);
      if (result.has(id)) {
        continue;
      }
      const orderedRoads = [first, second].sort((left, right) => left.id.localeCompare(right.id));
      const orderedStreets = [first.streetId, second.streetId].sort();
      result.set(
        id,
        Object.freeze({
          id,
          point: intersection,
          roadSegmentIds: Object.freeze([
            orderedRoads[0]?.id ?? first.id,
            orderedRoads[1]?.id ?? second.id,
          ]) as readonly [string, string],
          streetIds: Object.freeze([
            orderedStreets[0] ?? first.streetId,
            orderedStreets[1] ?? second.streetId,
          ]) as readonly [string, string],
        }),
      );
    }
  }

  return Object.freeze([...result.values()].sort((left, right) => left.id.localeCompare(right.id)));
};

const projectSidewalk = (strip: StreetStripSpec): NeighborhoodSidewalkSegment => {
  const roadSegmentIndex = Math.floor(strip.segmentIndex / 2);
  const side: NeighborhoodTopologySide = strip.segmentIndex % 2 === 0 ? -1 : 1;

  return Object.freeze({
    id: sidewalkSegmentId(strip),
    streetId: strip.streetId,
    segmentIndex: strip.segmentIndex,
    parentRoadId: roadSegmentId({
      streetId: strip.streetId,
      segmentIndex: roadSegmentIndex,
    }),
    side,
    center: point(strip.x, strip.z),
    start: stripEndpoint(strip, -1),
    end: stripEndpoint(strip, 1),
    length: strip.length,
    width: strip.width,
    rotationY: strip.rotationY,
  });
};

const distanceSquaredToStripCenterline = (
  strip: StreetStripSpec,
  target: ResidentialPoint,
): number => {
  const tangentX = Math.cos(strip.rotationY);
  const tangentZ = Math.sin(strip.rotationY);
  const deltaX = target.x - strip.x;
  const deltaZ = target.z - strip.z;
  const projection = deltaX * tangentX + deltaZ * tangentZ;
  const bounded = Math.max(-strip.length / 2, Math.min(strip.length / 2, projection));
  const projectedX = strip.x + tangentX * bounded;
  const projectedZ = strip.z + tangentZ * bounded;
  const dx = target.x - projectedX;
  const dz = target.z - projectedZ;
  return dx * dx + dz * dz;
};

const nearestStrip = (strips: readonly StreetStripSpec[], target: ResidentialPoint): StripMatch => {
  const first = strips[0];
  if (first === undefined) {
    throw new Error("neighborhood topology requires generated street strips");
  }

  const strip = strips.reduce(
    (best, candidate) =>
      distanceSquaredToStripCenterline(candidate, target) <
      distanceSquaredToStripCenterline(best, target)
        ? candidate
        : best,
    first,
  );

  return Object.freeze({
    strip,
    gap: Math.sqrt(distanceSquaredToStripCenterline(strip, target)),
  });
};

const projectDriveway = (
  property: ResidentialPropertySpec,
  seed: number,
  roads: readonly StreetStripSpec[],
): NeighborhoodPropertyTopology["driveway"] => {
  if (property.drivewayX === null) {
    return null;
  }

  const access = residentialAccessLayout(property, seed);
  const roadEdge = point(access.roadEdgeX, access.roadEdgeZ);
  const road = nearestStrip(roads, roadEdge);

  return Object.freeze({
    center: point(access.drivewayCenterX, access.drivewayCenterZ),
    length: access.drivewayLength,
    width: WORLD_SCALE.street.drivewayWidth,
    rotationY: access.drivewayRotationY,
    parking: point(property.drivewayX, access.parkingZ),
    roadEdge,
    roadSegmentId: roadSegmentId(road.strip),
    roadSegmentGap: road.gap,
  });
};

const projectProperty = (
  property: ResidentialPropertySpec,
  group: NeighborhoodPropertyGroup,
  seed: number,
  roads: readonly StreetStripSpec[],
  sidewalks: readonly StreetStripSpec[],
): NeighborhoodPropertyTopology => {
  const access = residentialAccessLayout(property, seed);
  const sidewalkTarget = point(access.sidewalkX, access.sidewalkCenterZ);
  const sidewalk = nearestStrip(sidewalks, sidewalkTarget);

  return Object.freeze({
    id: `property:${property.role}`,
    role: property.role,
    group,
    house: Object.freeze({
      center: point(property.houseX, property.houseZ),
      scale: property.scale,
      rotationY: property.rotationY,
    }),
    frontDirection: access.frontDirection,
    door: point(access.doorX, access.doorZ),
    entry: point(access.entryX, access.entryZ),
    path: Object.freeze({
      center: point(access.pathCenterX, access.pathCenterZ),
      length: access.pathLength,
      width: access.pathWidth,
      rotationY: access.pathRotationY,
      sidewalkEdge: point(access.sidewalkEdgeX, access.sidewalkEdgeZ),
      sidewalkSegmentId: sidewalkSegmentId(sidewalk.strip),
      sidewalkSegmentGap: sidewalk.gap,
    }),
    driveway: projectDriveway(property, seed, roads),
  });
};

const projectProperties = (
  seed: number,
  roads: readonly StreetStripSpec[],
  sidewalks: readonly StreetStripSpec[],
): readonly NeighborhoodPropertyTopology[] => {
  const layout = generateResidentialLayout(seed);
  const groups = [
    ["front", layout.frontProperties],
    ["middle", layout.middleProperties],
    ["back", layout.backProperties],
    ["outer", layout.outerProperties],
  ] as const;

  return Object.freeze(
    groups.flatMap(([group, properties]) =>
      properties.map((property) => projectProperty(property, group, seed, roads, sidewalks)),
    ),
  );
};

export const generateNeighborhoodTopology = (
  seed = DEFAULT_RESIDENTIAL_SEED,
): NeighborhoodTopology => {
  const streetNetwork = generateStreetNetwork(seed);
  const roads = Object.freeze(streetNetwork.roads.map(projectRoad));

  return Object.freeze({
    seed: streetNetwork.seed,
    roads,
    sidewalks: Object.freeze(streetNetwork.sidewalks.map(projectSidewalk)),
    junctions: projectJunctions(roads),
    properties: projectProperties(streetNetwork.seed, streetNetwork.roads, streetNetwork.sidewalks),
  });
};
