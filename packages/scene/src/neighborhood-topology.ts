import {
  DEFAULT_RESIDENTIAL_SEED,
  generateResidentialLayout,
  residentialAccessLayout,
  type ResidentialPoint,
  type ResidentialPropertySpec,
} from "./residential-layout.js";
import {
  generateStreetNetwork,
  type StreetStripSpec,
} from "./street-layout.js";
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

export type NeighborhoodPropertyGroup =
  | "front"
  | "middle"
  | "back"
  | "outer";

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
  }>;
  driveway: Readonly<{
    center: ResidentialPoint;
    length: number;
    width: number;
    rotationY: number;
    parking: ResidentialPoint;
    roadEdge: ResidentialPoint;
    roadSegmentId: string;
  }> | null;
}>;

export type NeighborhoodTopology = Readonly<{
  seed: number;
  roads: readonly NeighborhoodRoadSegment[];
  sidewalks: readonly NeighborhoodSidewalkSegment[];
  properties: readonly NeighborhoodPropertyTopology[];
}>;

const point = (x: number, z: number): ResidentialPoint =>
  Object.freeze({ x, z });

const stripEndpoint = (
  strip: StreetStripSpec,
  direction: -1 | 1,
): ResidentialPoint => {
  const halfLength = strip.length / 2;
  return point(
    strip.x + Math.cos(strip.rotationY) * halfLength * direction,
    strip.z + Math.sin(strip.rotationY) * halfLength * direction,
  );
};

const roadSegmentId = (strip: Pick<StreetStripSpec, "streetId" | "segmentIndex">): string =>
  `road:${strip.streetId}:${String(strip.segmentIndex)}`;

const sidewalkSegmentId = (
  strip: Pick<StreetStripSpec, "streetId" | "segmentIndex">,
): string =>
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

const projectSidewalk = (
  strip: StreetStripSpec,
): NeighborhoodSidewalkSegment => {
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
  const bounded = Math.max(
    -strip.length / 2,
    Math.min(strip.length / 2, projection),
  );
  const projectedX = strip.x + tangentX * bounded;
  const projectedZ = strip.z + tangentZ * bounded;
  const dx = target.x - projectedX;
  const dz = target.z - projectedZ;
  return dx * dx + dz * dz;
};

const nearestStrip = (
  strips: readonly StreetStripSpec[],
  target: ResidentialPoint,
): StreetStripSpec => {
  const first = strips[0];
  if (first === undefined) {
    throw new Error("neighborhood topology requires generated street strips");
  }

  return strips.reduce((best, candidate) =>
    distanceSquaredToStripCenterline(candidate, target) <
    distanceSquaredToStripCenterline(best, target)
      ? candidate
      : best,
  first);
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

  const driveway =
    property.drivewayX === null
      ? null
      : (() => {
          const roadEdge = point(access.roadEdgeX, access.roadEdgeZ);
          const road = nearestStrip(roads, roadEdge);
          return Object.freeze({
            center: point(access.drivewayCenterX, access.drivewayCenterZ),
            length: access.drivewayLength,
            width: WORLD_SCALE.street.drivewayWidth,
            rotationY: access.drivewayRotationY,
            parking: point(property.drivewayX, access.parkingZ),
            roadEdge,
            roadSegmentId: roadSegmentId(road),
          });
        })();

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
      sidewalkSegmentId: sidewalkSegmentId(sidewalk),
    }),
    driveway,
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
      properties.map((property) =>
        projectProperty(property, group, seed, roads, sidewalks),
      ),
    ),
  );
};

export const generateNeighborhoodTopology = (
  seed = DEFAULT_RESIDENTIAL_SEED,
): NeighborhoodTopology => {
  const streetNetwork = generateStreetNetwork(seed);
  return Object.freeze({
    seed: streetNetwork.seed,
    roads: Object.freeze(streetNetwork.roads.map(projectRoad)),
    sidewalks: Object.freeze(streetNetwork.sidewalks.map(projectSidewalk)),
    properties: projectProperties(
      streetNetwork.seed,
      streetNetwork.roads,
      streetNetwork.sidewalks,
    ),
  });
};
