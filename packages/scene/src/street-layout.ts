import { WORLD_SCALE } from "./world-scale.js";

export type StreetTrafficKind = "bicycle" | "vehicle";
export type SidewalkSide = "near" | "far";
export type StreetStripRole = "paved-road" | "sidewalk";

export type StreetPoint = Readonly<{ x: number; z: number }>;

export type StreetStripSpec = Readonly<{
  role: StreetStripRole;
  streetId: string;
  segmentIndex: number;
  x: number;
  z: number;
  length: number;
  width: number;
  rotationY: number;
}>;

export type GeneratedStreetNetwork = Readonly<{
  seed: number;
  roads: readonly StreetStripSpec[];
  sidewalks: readonly StreetStripSpec[];
}>;

export type StreetHardscapeRect = Readonly<{
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  role: "road" | "sidewalk";
}>;

export const DEFAULT_STREET_SEED = 0x4c_45_4d_4f;

const roadDepth = WORLD_SCALE.street.roadWidth;
const sidewalkDepth = WORLD_SCALE.street.sidewalkWidth;
const sidewalkOffset =
  roadDepth / 2 + WORLD_SCALE.street.curbGap + sidewalkDepth / 2;
const mainCenterZ = 5;

export const STREET_LAYOUT = Object.freeze({
  road: Object.freeze({
    centerZ: mainCenterZ,
    depth: roadDepth,
    minZ: mainCenterZ - roadDepth / 2,
    maxZ: mainCenterZ + roadDepth / 2,
  }),
  nearSidewalk: Object.freeze({
    centerZ: mainCenterZ - sidewalkOffset,
    depth: sidewalkDepth,
    minZ: mainCenterZ - sidewalkOffset - sidewalkDepth / 2,
    maxZ: mainCenterZ - sidewalkOffset + sidewalkDepth / 2,
  }),
  farSidewalk: Object.freeze({
    centerZ: mainCenterZ + sidewalkOffset,
    depth: sidewalkDepth,
    minZ: mainCenterZ + sidewalkOffset - sidewalkDepth / 2,
    maxZ: mainCenterZ + sidewalkOffset + sidewalkDepth / 2,
  }),
});

const normalizedLane = (lane: number): number =>
  Math.abs(Math.trunc(Number.isFinite(lane) ? lane : 0)) % 4;

export const sidewalkSideForActor = (actorIndex: number): SidewalkSide =>
  Math.abs(Math.trunc(Number.isFinite(actorIndex) ? actorIndex : 0)) % 2 === 0
    ? "near"
    : "far";

export const sidewalkSideForZ = (z: number): SidewalkSide => {
  const safeZ = Number.isFinite(z) ? z : STREET_LAYOUT.nearSidewalk.centerZ;
  return Math.abs(safeZ - STREET_LAYOUT.nearSidewalk.centerZ) <=
    Math.abs(safeZ - STREET_LAYOUT.farSidewalk.centerZ)
    ? "near"
    : "far";
};

export const sidewalkLaneZForSide = (
  side: SidewalkSide,
  lane: number,
): number => {
  const normalized = normalizedLane(lane);
  const sidewalk =
    side === "near" ? STREET_LAYOUT.nearSidewalk : STREET_LAYOUT.farSidewalk;
  const inset = 0.28;
  const usable = sidewalk.depth - inset * 2;
  return sidewalk.minZ + inset + (normalized / 3) * usable;
};

export const sidewalkLaneZ = (lane: number): number =>
  sidewalkLaneZForSide("near", lane);

export const clampToSidewalk = (
  z: number,
  side: SidewalkSide,
  inset = 0.1,
): number => {
  const sidewalk =
    side === "near" ? STREET_LAYOUT.nearSidewalk : STREET_LAYOUT.farSidewalk;
  const safeInset = Math.max(0, Math.min(0.35, inset));
  return Math.min(
    sidewalk.maxZ - safeInset,
    Math.max(sidewalk.minZ + safeInset, z),
  );
};

export const clampToNearSidewalk = (z: number, inset = 0.1): number =>
  clampToSidewalk(z, "near", inset);

export const clampToNearestSidewalk = (z: number, inset = 0.1): number =>
  clampToSidewalk(z, sidewalkSideForZ(z), inset);

export const roadLaneZ = (
  kind: StreetTrafficKind,
  index: number,
): number => {
  const lane = Math.abs(Math.trunc(Number.isFinite(index) ? index : 0)) % 2;
  if (kind === "bicycle") {
    const edgeInset = 0.45;
    return lane === 0
      ? STREET_LAYOUT.road.minZ + edgeInset
      : STREET_LAYOUT.road.maxZ - edgeInset;
  }
  const offset = WORLD_SCALE.street.laneWidth / 2;
  return lane === 0
    ? STREET_LAYOUT.road.centerZ - offset
    : STREET_LAYOUT.road.centerZ + offset;
};

export type GardenSignPosition = Readonly<{
  x: number;
  y: number;
  z: number;
  rotationY: number;
}>;

const STAND_GARDEN_SIGN_COLUMNS = [
  -7.25,
  -6.05,
  -4.85,
  -3.65,
  -2.55,
  -1.85,
] as const;

export const gardenSignPosition = (index: number): GardenSignPosition => {
  const safeIndex = Math.max(0, Math.trunc(Number.isFinite(index) ? index : 0));
  const column = safeIndex % STAND_GARDEN_SIGN_COLUMNS.length;
  const row = Math.floor(safeIndex / STAND_GARDEN_SIGN_COLUMNS.length);
  return Object.freeze({
    x: STAND_GARDEN_SIGN_COLUMNS[column] ?? -5.6,
    y: 0,
    z: -0.85 - row * 0.55,
    rotationY: (safeIndex % 3 - 1) * 0.055,
  });
};

const mix32 = (seed: number, salt: number): number => {
  let value = (seed ^ Math.imul((salt + 1) >>> 0, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
};

const signedUnit = (seed: number, salt: number): number =>
  (mix32(seed, salt) / 0xffff_ffff) * 2 - 1;

const quadraticPoint = (
  start: StreetPoint,
  control: StreetPoint,
  end: StreetPoint,
  progress: number,
): StreetPoint => {
  const inverse = 1 - progress;
  return Object.freeze({
    x:
      inverse * inverse * start.x +
      2 * inverse * progress * control.x +
      progress * progress * end.x,
    z:
      inverse * inverse * start.z +
      2 * inverse * progress * control.z +
      progress * progress * end.z,
  });
};

const stripBetween = (
  role: StreetStripRole,
  streetId: string,
  segmentIndex: number,
  start: StreetPoint,
  end: StreetPoint,
  width: number,
): StreetStripSpec => {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  return Object.freeze({
    role,
    streetId,
    segmentIndex,
    x: (start.x + end.x) / 2,
    z: (start.z + end.z) / 2,
    length: Math.hypot(dx, dz) + 0.18,
    width,
    rotationY: Math.atan2(dz, dx),
  });
};

const curveRoad = (
  streetId: string,
  start: StreetPoint,
  control: StreetPoint,
  end: StreetPoint,
  steps: number,
  width: number,
): readonly StreetStripSpec[] => {
  const points = Array.from({ length: steps + 1 }, (_, index) =>
    quadraticPoint(start, control, end, index / steps),
  );
  return Object.freeze(
    points.slice(0, -1).map((point, index) => {
      const next = points[index + 1];
      if (next === undefined) throw new Error("street curve segment invariant failed");
      return stripBetween("paved-road", streetId, index, point, next, width);
    }),
  );
};

const straightRoad = (
  streetId: string,
  start: StreetPoint,
  end: StreetPoint,
  width: number,
): readonly StreetStripSpec[] =>
  Object.freeze([
    stripBetween("paved-road", streetId, 0, start, end, width),
  ]);

const stripProjectionRadius = (
  strip: StreetStripSpec,
  axisX: number,
  axisZ: number,
): number => {
  const lengthAxisX = Math.cos(strip.rotationY);
  const lengthAxisZ = Math.sin(strip.rotationY);
  const widthAxisX = -lengthAxisZ;
  const widthAxisZ = lengthAxisX;
  return (
    (strip.length / 2) *
      Math.abs(axisX * lengthAxisX + axisZ * lengthAxisZ) +
    (strip.width / 2) *
      Math.abs(axisX * widthAxisX + axisZ * widthAxisZ)
  );
};

export const streetStripsOverlap = (
  first: StreetStripSpec,
  second: StreetStripSpec,
  margin = 0,
): boolean => {
  const axes = [
    [Math.cos(first.rotationY), Math.sin(first.rotationY)],
    [-Math.sin(first.rotationY), Math.cos(first.rotationY)],
    [Math.cos(second.rotationY), Math.sin(second.rotationY)],
    [-Math.sin(second.rotationY), Math.cos(second.rotationY)],
  ] as const;
  const deltaX = second.x - first.x;
  const deltaZ = second.z - first.z;

  return axes.every(([axisX, axisZ]) => {
    const centerDistance = Math.abs(deltaX * axisX + deltaZ * axisZ);
    const radius =
      stripProjectionRadius(first, axisX, axisZ) +
      stripProjectionRadius(second, axisX, axisZ) +
      margin;
    return centerDistance < radius;
  });
};

const sidewalkForRoad = (
  road: StreetStripSpec,
  side: -1 | 1,
): StreetStripSpec => {
  const normalX = -Math.sin(road.rotationY);
  const normalZ = Math.cos(road.rotationY);
  return Object.freeze({
    role: "sidewalk",
    streetId: road.streetId,
    segmentIndex: road.segmentIndex * 2 + (side === -1 ? 0 : 1),
    x: road.x + normalX * sidewalkOffset * side,
    z: road.z + normalZ * sidewalkOffset * side,
    length: road.length,
    width: sidewalkDepth,
    rotationY: road.rotationY,
  });
};

const stripAabb = (strip: StreetStripSpec): StreetHardscapeRect => {
  const cosine = Math.abs(Math.cos(strip.rotationY));
  const sine = Math.abs(Math.sin(strip.rotationY));
  const halfX = (strip.length / 2) * cosine + (strip.width / 2) * sine;
  const halfZ = (strip.length / 2) * sine + (strip.width / 2) * cosine;
  return Object.freeze({
    minX: strip.x - halfX,
    maxX: strip.x + halfX,
    minZ: strip.z - halfZ,
    maxZ: strip.z + halfZ,
    role: strip.role === "paved-road" ? "road" : "sidewalk",
  });
};

export const generateStreetNetwork = (
  seed = DEFAULT_STREET_SEED,
): GeneratedStreetNetwork => {
  const safeSeed = Number.isFinite(seed)
    ? Math.trunc(seed) >>> 0
    : DEFAULT_STREET_SEED;
  const width = WORLD_SCALE.street.roadWidth;
  const roads = [
    ...straightRoad(
      "main",
      { x: -75, z: mainCenterZ },
      { x: 75, z: mainCenterZ },
      width,
    ),
    ...curveRoad(
      "west-curve",
      { x: -18, z: 34 },
      { x: -21 + signedUnit(safeSeed, 11) * 2.2, z: -18 },
      { x: -13.2, z: -76 },
      8,
      width,
    ),
    ...curveRoad(
      "east-curve",
      { x: 21, z: 34 },
      { x: 16 + signedUnit(safeSeed, 17) * 2.4, z: -20 },
      { x: 22.5, z: -76 },
      8,
      width,
    ),
    ...curveRoad(
      "middle-curve",
      { x: -75, z: -16.5 },
      { x: 0, z: -13.5 + signedUnit(safeSeed, 23) * 2 },
      { x: 75, z: -17.5 },
      8,
      width,
    ),
    ...curveRoad(
      "back-curve",
      { x: -75, z: -38.5 },
      { x: 0, z: -41 + signedUnit(safeSeed, 29) * 2.2 },
      { x: 75, z: -36.5 },
      8,
      width,
    ),
  ] as const;

  const sidewalkCandidates = roads.flatMap((road) => [
    sidewalkForRoad(road, -1),
    sidewalkForRoad(road, 1),
  ]);
  const sidewalks = sidewalkCandidates.filter(
    (candidate) =>
      !roads.some((road) => streetStripsOverlap(candidate, road, 0.01)),
  );

  return Object.freeze({
    seed: safeSeed,
    roads: Object.freeze([...roads]),
    sidewalks: Object.freeze(sidewalks),
  });
};

export const streetNetworkHardscapeRects = (
  seed = DEFAULT_STREET_SEED,
): readonly StreetHardscapeRect[] => {
  const network = generateStreetNetwork(seed);
  return Object.freeze(
    [...network.roads, ...network.sidewalks].map(stripAabb),
  );
};
