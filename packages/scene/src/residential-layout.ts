import {
  STREET_LAYOUT,
  streetNetworkHardscapeRects,
} from "./street-layout.js";
import { WORLD_SCALE } from "./world-scale.js";

export type ResidentialPoint = Readonly<{ x: number; z: number }>;

export type ResidentialPropertySpec = Readonly<{
  role: string;
  houseX: number;
  houseZ: number;
  color: number;
  scale: number;
  rotationY: number;
  drivewayX: number | null;
  mailboxX: number | null;
}>;

export type ResidentialYardZone = "front" | "back" | "side";

export type ResidentialPlanting = Readonly<{
  x: number;
  z: number;
  scale: number;
  paletteIndex: number;
  propertyRole: string | null;
  yardZone: ResidentialYardZone | null;
}>;

export type ResidentialRect = Readonly<{
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  role: "road" | "sidewalk" | "driveway" | "path";
  x?: number;
  z?: number;
  length?: number;
  width?: number;
  rotationY?: number;
}>;

export type ResidentialLayout = Readonly<{
  seed: number;
  frontProperties: readonly ResidentialPropertySpec[];
  middleProperties: readonly ResidentialPropertySpec[];
  backProperties: readonly ResidentialPropertySpec[];
  outerProperties: readonly ResidentialPropertySpec[];
  trees: readonly ResidentialPlanting[];
  shrubs: readonly ResidentialPlanting[];
  flowers: readonly ResidentialPlanting[];
  exclusions: readonly ResidentialRect[];
}>;

export const DEFAULT_RESIDENTIAL_SEED = 0x4c_45_4d_4f;

const HOUSE_PALETTE_SIZE = 7;
export const HOUSE_FOOTPRINT_WIDTH = 6.4;
export const HOUSE_FOOTPRINT_DEPTH = 6.8;
export const DRIVEWAY_HALF_WIDTH = WORLD_SCALE.street.drivewayWidth / 2;
export const FRONT_DRIVEWAY_MIN_Z = -6.2;
export const FRONT_DRIVEWAY_MAX_Z = STREET_LAYOUT.nearSidewalk.minZ - 0.08;
export const FRONT_DRIVEWAY_DEPTH =
  FRONT_DRIVEWAY_MAX_Z - FRONT_DRIVEWAY_MIN_Z;
export const FRONT_DRIVEWAY_CENTER_Z =
  (FRONT_DRIVEWAY_MIN_Z + FRONT_DRIVEWAY_MAX_Z) / 2;
const HOUSE_HARDSCAPE_MARGIN = 0.35;
const MAILBOX_CLEARANCE_FROM_DRIVEWAY = 0.56;

const mix32 = (seed: number, salt: number): number => {
  let value = (seed ^ Math.imul((salt + 1) >>> 0, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
};

const unit = (seed: number, salt: number): number => mix32(seed, salt) / 0xffff_ffff;
const signed = (seed: number, salt: number): number => unit(seed, salt) * 2 - 1;

const footprintIntersectsRect = (
  rect: ResidentialRect,
  point: ResidentialPoint,
  halfWidth: number,
  halfDepth: number,
): boolean =>
  point.x + halfWidth >= rect.minX &&
  point.x - halfWidth <= rect.maxX &&
  point.z + halfDepth >= rect.minZ &&
  point.z - halfDepth <= rect.maxZ;

const resolvePropertyOverlaps = (
  properties: readonly ResidentialPropertySpec[],
): readonly ResidentialPropertySpec[] => {
  const mutable = properties.map((p) => ({ ...p }));
  const minClearance = 0.5;

  for (let pass = 0; pass < 8; pass += 1) {
    let anyMoved = false;
    for (let i = 0; i < mutable.length; i += 1) {
      const a = mutable[i];
      if (a === undefined) continue;
      const aFootprint = propertyFootprint(a);
      let totalPushX = 0;
      let totalPushZ = 0;

      for (let j = i + 1; j < mutable.length; j += 1) {
        const b = mutable[j];
        if (b === undefined) continue;
        const bFootprint = propertyFootprint(b);
        const minDistX = aFootprint.halfWidth + bFootprint.halfWidth + minClearance;
        const minDistZ = aFootprint.halfDepth + bFootprint.halfDepth + minClearance;
        const distX = Math.abs(b.houseX - a.houseX);
        const distZ = Math.abs(b.houseZ - a.houseZ);

        if (distX < minDistX && distZ < minDistZ) {
          const pushX = (minDistX - distX) * 0.5;
          const pushZ = (minDistZ - distZ) * 0.5;
          totalPushX += Math.sign(b.houseX - a.houseX) * pushX;
          totalPushZ += Math.sign(b.houseZ - a.houseZ) * pushZ;
        }
      }

      if (totalPushX !== 0 || totalPushZ !== 0) {
        anyMoved = true;
        mutable[i] = {
          ...a,
          houseX: a.houseX - totalPushX,
          houseZ: a.houseZ - totalPushZ,
        };
      }
    }
    if (!anyMoved) break;
  }

  return Object.freeze(mutable);
};

const footprintIntersectsHardscapeRect = (
  rect: ResidentialRect,
  point: ResidentialPoint,
  halfWidth: number,
  halfDepth: number,
): boolean => {
  if (
    rect.x === undefined ||
    rect.z === undefined ||
    rect.length === undefined ||
    rect.width === undefined ||
    rect.rotationY === undefined
  ) {
    return footprintIntersectsRect(rect, point, halfWidth, halfDepth);
  }

  const stripLength = rect.length;
  const stripWidth = rect.width;
  const stripRotationY = rect.rotationY;
  const tangentX = Math.cos(stripRotationY);
  const tangentZ = Math.sin(stripRotationY);
  const normalX = -tangentZ;
  const normalZ = tangentX;
  const deltaX = point.x - rect.x;
  const deltaZ = point.z - rect.z;
  const axes = [
    [1, 0],
    [0, 1],
    [tangentX, tangentZ],
    [normalX, normalZ],
  ] as const;

  return axes.every(([axisX, axisZ]) => {
    const centerDistance = Math.abs(deltaX * axisX + deltaZ * axisZ);
    const footprintRadius =
      Math.max(0, halfWidth) * Math.abs(axisX) +
      Math.max(0, halfDepth) * Math.abs(axisZ);
    const stripRadius =
      (stripLength / 2) *
        Math.abs(axisX * tangentX + axisZ * tangentZ) +
      (stripWidth / 2) *
        Math.abs(axisX * normalX + axisZ * normalZ);
    return centerDistance <= footprintRadius + stripRadius;
  });
};

const baseHardscape = (seed: number): readonly ResidentialRect[] =>
  baseExclusions(seed);

const rotatedFootprintHalfExtents = (
  halfWidth: number,
  halfDepth: number,
  rotationY: number,
): Readonly<{ halfWidth: number; halfDepth: number }> => {
  const cosine = Math.abs(Math.cos(rotationY));
  const sine = Math.abs(Math.sin(rotationY));
  return Object.freeze({
    halfWidth: halfWidth * cosine + halfDepth * sine,
    halfDepth: halfWidth * sine + halfDepth * cosine,
  });
};

const clearHouseFromBaseHardscape = (
  point: ResidentialPoint,
  halfWidth: number,
  halfDepth: number,
  seed: number,
): ResidentialPoint => {
  let x = point.x;
  let z = point.z;
  const hardscape = baseHardscape(seed);
  const isClear = (candidateX: number, candidateZ: number): boolean =>
    hardscape.every(
      (rect) =>
        !footprintIntersectsHardscapeRect(
          rect,
          { x: candidateX, z: candidateZ },
          halfWidth,
          halfDepth,
        ),
    );

  for (let pass = 0; pass < 24; pass += 1) {
    let moved = false;
    for (const rect of hardscape) {
      if (!footprintIntersectsHardscapeRect(rect, { x, z }, halfWidth, halfDepth)) continue;
      const rectWidth = rect.maxX - rect.minX;
      const rectDepth = rect.maxZ - rect.minZ;
      if (rectWidth <= rectDepth) {
        const left = rect.minX - halfWidth - HOUSE_HARDSCAPE_MARGIN;
        const right = rect.maxX + halfWidth + HOUSE_HARDSCAPE_MARGIN;
        x = Math.abs(x - left) <= Math.abs(x - right) ? left : right;
      } else {
        const near = rect.minZ - halfDepth - HOUSE_HARDSCAPE_MARGIN;
        const far = rect.maxZ + halfDepth + HOUSE_HARDSCAPE_MARGIN;
        z = Math.abs(z - near) <= Math.abs(z - far) ? near : far;
      }
      moved = true;
    }
    if (!moved) break;
  }
  if (isClear(x, z)) return Object.freeze({ x, z });

  const step = 0.78;
  for (let ring = 1; ring <= 32; ring += 1) {
    for (let offset = -ring; offset <= ring; offset += 1) {
      const candidates = [
        { x: point.x + offset * step, z: point.z - ring * step },
        { x: point.x + offset * step, z: point.z + ring * step },
        { x: point.x - ring * step, z: point.z + offset * step },
        { x: point.x + ring * step, z: point.z + offset * step },
      ] as const;
      for (const candidate of candidates) {
        if (isClear(candidate.x, candidate.z)) {
          return Object.freeze(candidate);
        }
      }
    }
  }
  return Object.freeze({ x, z });
};

const mailboxAnchorIsClear = (x: number, seed: number): boolean =>
  !baseHardscape(seed).some((rect) =>
    footprintIntersectsHardscapeRect(rect, { x, z: -0.3 }, 0.3, 0.3),
  );

const mailboxXForDriveway = (
  drivewayX: number,
  drivewaySide: -1 | 1,
  offset: number,
  seed: number,
): number => {
  const preferred = drivewayX + drivewaySide * offset;
  if (mailboxAnchorIsClear(preferred, seed)) return preferred;
  return drivewayX - drivewaySide * offset;
};

const makeProperty = (
  seed: number,
  index: number,
  role: string,
  baseX: number,
  baseZ: number,
  baseScale: number,
  baseRotation: number,
  facingBack: boolean,
  drivewaySide: -1 | 0 | 1,
  hardscapeSeed = seed,
): ResidentialPropertySpec => {
  const featured = role === "stand-home" || role === "stand-neighbor";
  const candidateHouseX = featured ? baseX : baseX + signed(seed, index * 11 + 1) * 0.82;
  const candidateHouseZ = featured ? baseZ : baseZ + signed(seed, index * 11 + 2) * 1.05;
  const scale = baseScale + signed(seed, index * 11 + 3) * 0.055;
  const rotationY =
    baseRotation +
    signed(seed, index * 11 + 4) * (featured ? 0.014 : 0.055) +
    (facingBack ? Math.PI : 0);
  const localHalfWidth = (HOUSE_FOOTPRINT_WIDTH * scale) / 2;
  const localHalfDepth = (HOUSE_FOOTPRINT_DEPTH * scale) / 2;
  const footprint = rotatedFootprintHalfExtents(
    localHalfWidth,
    localHalfDepth,
    rotationY,
  );
  const clearHouse = clearHouseFromBaseHardscape(
    { x: candidateHouseX, z: candidateHouseZ },
    footprint.halfWidth,
    footprint.halfDepth,
    hardscapeSeed,
  );
  const houseX = clearHouse.x;
  const houseZ = clearHouse.z;
  const drivewayOffset =
    footprint.halfWidth +
    DRIVEWAY_HALF_WIDTH +
    HOUSE_HARDSCAPE_MARGIN +
    unit(seed, index * 11 + 5) * 0.24;
  const drivewayX =
    drivewaySide === 0
      ? null
      : houseX + drivewaySide * drivewayOffset;
  const mailboxOffset =
    DRIVEWAY_HALF_WIDTH +
    MAILBOX_CLEARANCE_FROM_DRIVEWAY +
    unit(seed, index * 11 + 6) * 0.18;
  const mailboxX =
    drivewayX === null || drivewaySide === 0
      ? null
      : mailboxXForDriveway(
          drivewayX,
          drivewaySide,
          mailboxOffset,
          hardscapeSeed,
        );

  return Object.freeze({
    role,
    houseX,
    houseZ,
    color: Math.floor(unit(seed, index * 11 + 7) * HOUSE_PALETTE_SIZE) % HOUSE_PALETTE_SIZE,
    scale,
    rotationY,
    drivewayX,
    mailboxX,
  });
};

const drivewayRectAt = (x: number): ResidentialRect => Object.freeze({
  minX: x - DRIVEWAY_HALF_WIDTH,
  maxX: x + DRIVEWAY_HALF_WIDTH,
  minZ: FRONT_DRIVEWAY_MIN_Z,
  maxZ: FRONT_DRIVEWAY_MAX_Z,
  role: "driveway",
});

const propertyFootprint = (
  property: ResidentialPropertySpec,
): Readonly<{ halfWidth: number; halfDepth: number }> => {
  const localHalfWidth = (HOUSE_FOOTPRINT_WIDTH * property.scale) / 2;
  const localHalfDepth = (HOUSE_FOOTPRINT_DEPTH * property.scale) / 2;
  return rotatedFootprintHalfExtents(
    localHalfWidth,
    localHalfDepth,
    property.rotationY,
  );
};

const drivewayClearsProperties = (
  x: number,
  properties: readonly ResidentialPropertySpec[],
  occupied: readonly ResidentialRect[],
): boolean => {
  const driveway = drivewayRectAt(x);
  const clearsHouses = properties.every((property) => {
    const footprint = propertyFootprint(property);
    return !footprintIntersectsRect(
      driveway,
      { x: property.houseX, z: property.houseZ },
      footprint.halfWidth,
      footprint.halfDepth,
    );
  });
  if (!clearsHouses) return false;
  return occupied.every(
    (existing) =>
      existing.maxX + 0.25 < driveway.minX ||
      existing.minX - 0.25 > driveway.maxX,
  );
};

const resolveFrontAccess = (
  seed: number,
  properties: readonly ResidentialPropertySpec[],
): readonly ResidentialPropertySpec[] => {
  const occupiedDriveways: ResidentialRect[] = [];
  const resolvedDriveways = properties.map((property) => {
    if (property.drivewayX === null) return property;

    const preferredSide: -1 | 1 =
      property.drivewayX < property.houseX ? -1 : 1;
    const baseDistance = Math.abs(property.drivewayX - property.houseX);
    let drivewayX: number | null = null;

    for (let step = 0; step <= 12 && drivewayX === null; step += 1) {
      const distance = baseDistance + step * 0.42;
      for (const side of [preferredSide, -preferredSide] as const) {
        const candidate = property.houseX + side * distance;
        if (
          drivewayClearsProperties(
            candidate,
            properties,
            occupiedDriveways,
          )
        ) {
          drivewayX = candidate;
          break;
        }
      }
    }

    if (drivewayX === null) {
      throw new Error("unable to place residential driveway clear of houses");
    }
    occupiedDriveways.push(drivewayRectAt(drivewayX));

    return Object.freeze({
      ...property,
      drivewayX,
      mailboxX: null,
    });
  });

  return Object.freeze(
    resolvedDriveways.map((property, index) => {
      if (property.drivewayX === null) return property;
      const drivewaySide: -1 | 1 =
        property.drivewayX < property.houseX ? -1 : 1;
      const preferredOffset =
        DRIVEWAY_HALF_WIDTH +
        MAILBOX_CLEARANCE_FROM_DRIVEWAY +
        unit(seed, index * 17 + 9) * 0.18;
      let mailboxX: number | null = null;

      for (let step = 0; step <= 12 && mailboxX === null; step += 1) {
        const offset = preferredOffset + step * 0.24;
        for (const side of [drivewaySide, -drivewaySide] as const) {
          const candidate = property.drivewayX + side * offset;
          const clearOfStreet = mailboxAnchorIsClear(candidate, seed);
          const clearOfDriveways = occupiedDriveways.every(
            (driveway) =>
              !footprintIntersectsRect(
                driveway,
                { x: candidate, z: -0.3 },
                0.3,
                0.3,
              ),
          );
          if (clearOfStreet && clearOfDriveways) {
            mailboxX = candidate;
            break;
          }
        }
      }

      return Object.freeze({
        ...property,
        mailboxX,
      });
    }),
  );
};

const frontProperties = (seed: number): readonly ResidentialPropertySpec[] =>
  resolveFrontAccess(
    seed,
    Object.freeze([
      makeProperty(seed, 0, "west-end", -58.0, -7.1, 0.96, 0.035, false, 1),
      makeProperty(seed, 1, "west-mid", -42.0, -8.4, 1.02, -0.045, false, 1),
      makeProperty(seed, 2, "west-near", -25.5, -6.6, 0.92, 0.06, false, 1),
      makeProperty(seed, 3, "stand-home", -4.7, -7.9, 1.06, 0.045, false, -1),
      makeProperty(seed, 4, "stand-neighbor", 8.8, -8.6, 0.97, -0.055, false, 1),
      makeProperty(seed, 5, "east-mid", 29.1, -6.8, 1.01, 0.025, false, -1),
      makeProperty(seed, 6, "east-end", 45.0, -8.3, 0.94, -0.05, false, 1),
    ]),
  );

const rowProperties = (
  seed: number,
  rowSalt: number,
  z: number,
  xs: readonly number[],
  backFacing: boolean,
): readonly ResidentialPropertySpec[] =>
  Object.freeze(
    xs.map((baseX, index) =>
      makeProperty(
        seed ^ rowSalt,
        index + 10,
        "row-" + String(rowSalt) + "-" + String(index),
        baseX,
        z + signed(seed, rowSalt + index * 3) * 2.1,
        0.94 + unit(seed, rowSalt + index * 3 + 1) * 0.1,
        signed(seed, rowSalt + index * 3 + 2) * 0.035,
        backFacing,
        index % 2 === 0 ? -1 : 1,
        seed,
      ),
    ),
  );

const baseExclusionCache = new Map<number, ResidentialRect[]>();

function baseExclusions(seed: number): ResidentialRect[] {
  const safeSeed = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : DEFAULT_RESIDENTIAL_SEED;
  const cached = baseExclusionCache.get(safeSeed);
  if (cached !== undefined) return cached;
  const generated = streetNetworkHardscapeRects(safeSeed).map((rect) => ({
    minX: rect.minX,
    maxX: rect.maxX,
    minZ: rect.minZ,
    maxZ: rect.maxZ,
    role: rect.role,
    x: rect.x,
    z: rect.z,
    length: rect.length,
    width: rect.width,
    rotationY: rect.rotationY,
  }));
  baseExclusionCache.set(safeSeed, generated);
  return generated;
}

const rectCenterZ = (rect: ResidentialRect): number =>
  (rect.minZ + rect.maxZ) / 2;

const horizontalGapToRect = (x: number, rect: ResidentialRect): number =>
  x < rect.minX ? rect.minX - x : x > rect.maxX ? x - rect.maxX : 0;

const nearestAccessRect = (
  property: ResidentialPropertySpec,
  x: number,
  role: "road" | "sidewalk",
  seed: number,
): ResidentialRect | null => {
  const frontDirection: -1 | 1 =
    Math.cos(property.rotationY) >= 0 ? 1 : -1;
  const frontCandidates = baseExclusions(seed).filter(
    (rect) =>
      rect.role === role &&
      (rectCenterZ(rect) - property.houseZ) * frontDirection > 0.15,
  );
  if (frontCandidates.length === 0) return null;

  const directCandidates = frontCandidates.filter(
    (rect) => horizontalGapToRect(x, rect) <= 0.5,
  );
  const candidates =
    directCandidates.length > 0 ? directCandidates : frontCandidates;
  const first = candidates[0];
  if (first === undefined) return null;

  return candidates.reduce((best, candidate) => {
    const candidateScore =
      Math.abs(rectCenterZ(candidate) - property.houseZ) +
      horizontalGapToRect(x, candidate) * 2.2;
    const bestScore =
      Math.abs(rectCenterZ(best) - property.houseZ) +
      horizontalGapToRect(x, best) * 2.2;
    return candidateScore < bestScore ? candidate : best;
  }, first);
};

const closestPointOnRectCenterline = (
  rect: ResidentialRect,
  point: ResidentialPoint,
): ResidentialPoint => {
  if (
    rect.x === undefined ||
    rect.z === undefined ||
    rect.length === undefined ||
    rect.rotationY === undefined
  ) {
    return Object.freeze({
      x: Math.min(rect.maxX, Math.max(rect.minX, point.x)),
      z: rectCenterZ(rect),
    });
  }

  const tangentX = Math.cos(rect.rotationY);
  const tangentZ = Math.sin(rect.rotationY);
  const projection =
    (point.x - rect.x) * tangentX + (point.z - rect.z) * tangentZ;
  const bounded = Math.min(rect.length / 2, Math.max(-rect.length / 2, projection));
  return Object.freeze({
    x: rect.x + tangentX * bounded,
    z: rect.z + tangentZ * bounded,
  });
};

export type ResidentialAccessLayout = Readonly<{
  frontDirection: -1 | 1;
  sidewalkX: number;
  sidewalkCenterZ: number;
  sidewalkEdgeZ: number;
  roadEdgeZ: number;
  doorX: number;
  doorZ: number;
  entryX: number;
  entryZ: number;
  parkingZ: number;
  drivewaySidewalkX: number;
  drivewaySidewalkZ: number;
  roadX: number;
  roadCenterZ: number;
  drivewayCenterX: number;
  drivewayCenterZ: number;
  drivewayDepth: number;
  drivewayLength: number;
  drivewayRotationY: number;
  pathCenterX: number;
  pathCenterZ: number;
  pathWidth: number;
  pathDepth: number;
  pathLength: number;
  pathRotationY: number;
}>;

export const residentialAccessLayout = (
  property: ResidentialPropertySpec,
  seed = DEFAULT_RESIDENTIAL_SEED,
): ResidentialAccessLayout => {
  const frontX = Math.sin(property.rotationY);
  const frontZ = Math.cos(property.rotationY);
  const frontDirection: -1 | 1 = frontZ >= 0 ? 1 : -1;
  const footprint = propertyFootprint(property);
  const doorDistance = 2.34 * property.scale;
  const entryDistance = footprint.halfDepth + 0.48;
  const doorX = property.houseX + frontX * doorDistance;
  const doorZ = property.houseZ + frontZ * doorDistance;
  const entryX = property.houseX + frontX * entryDistance;
  const entryZ = property.houseZ + frontZ * entryDistance;
  const sidewalk = nearestAccessRect(
    property,
    entryX,
    "sidewalk",
    seed,
  );
  const fallbackSidewalk =
    frontDirection > 0
      ? STREET_LAYOUT.nearSidewalk
      : STREET_LAYOUT.farSidewalk;
  const sidewalkTarget =
    sidewalk === null
      ? Object.freeze({ x: entryX, z: fallbackSidewalk.centerZ })
      : closestPointOnRectCenterline(sidewalk, { x: entryX, z: entryZ });
  const sidewalkX = sidewalkTarget.x;
  const sidewalkCenterZ = sidewalkTarget.z;
  const sidewalkEdgeZ =
    sidewalk === null
      ? frontDirection > 0
        ? fallbackSidewalk.minZ
        : fallbackSidewalk.maxZ
      : sidewalkCenterZ >= property.houseZ
        ? sidewalk.minZ
        : sidewalk.maxZ;
  const pathDeltaX = sidewalkX - entryX;
  const pathDeltaZ = sidewalkCenterZ - entryZ;
  const pathLength = Math.max(0.72, Math.hypot(pathDeltaX, pathDeltaZ) + 0.24);
  const pathCenterX = (entryX + sidewalkX) / 2;
  const pathCenterZ = (entryZ + sidewalkCenterZ) / 2;
  const pathWidth = 1.04;
  const pathDepth = pathLength;
  const pathRotationY = Math.atan2(pathDeltaZ, pathDeltaX);

  const drivewayX = property.drivewayX ?? property.houseX;
  const parkingZ =
    property.houseZ +
    frontDirection * Math.min(1.35, Math.max(0.82, footprint.halfDepth * 0.34));
  const drivewaySidewalk = nearestAccessRect(
    property,
    drivewayX,
    "sidewalk",
    seed,
  );
  const drivewaySidewalkTarget =
    drivewaySidewalk === null
      ? Object.freeze({ x: drivewayX, z: fallbackSidewalk.centerZ })
      : closestPointOnRectCenterline(drivewaySidewalk, {
          x: drivewayX,
          z: parkingZ,
        });
  const drivewaySidewalkX = drivewaySidewalkTarget.x;
  const drivewaySidewalkZ = drivewaySidewalkTarget.z;
  const road = nearestAccessRect(
    property,
    drivewaySidewalkX,
    "road",
    seed,
  );
  const roadTarget =
    road === null
      ? Object.freeze({ x: drivewaySidewalkX, z: STREET_LAYOUT.road.centerZ })
      : closestPointOnRectCenterline(road, drivewaySidewalkTarget);
  const roadX = roadTarget.x;
  const roadCenterZ = roadTarget.z;
  const roadEdgeZ =
    road === null
      ? frontDirection > 0
        ? STREET_LAYOUT.road.minZ
        : STREET_LAYOUT.road.maxZ
      : roadCenterZ >= property.houseZ
        ? road.minZ
        : road.maxZ;
  const drivewayDeltaX = roadX - drivewayX;
  const drivewayDeltaZ = roadEdgeZ - parkingZ;
  const drivewayLength = Math.max(
    3.2,
    Math.hypot(drivewayDeltaX, drivewayDeltaZ) + 0.24,
  );
  const drivewayDepth = drivewayLength;
  const drivewayCenterX = (drivewayX + roadX) / 2;
  const drivewayCenterZ = (parkingZ + roadEdgeZ) / 2;
  const drivewayRotationY = Math.atan2(drivewayDeltaZ, drivewayDeltaX);

  return Object.freeze({
    frontDirection,
    sidewalkX,
    sidewalkCenterZ,
    sidewalkEdgeZ,
    roadEdgeZ,
    doorX,
    doorZ,
    entryX,
    entryZ,
    parkingZ,
    drivewaySidewalkX,
    drivewaySidewalkZ,
    roadX,
    roadCenterZ,
    drivewayCenterX,
    drivewayCenterZ,
    drivewayDepth,
    drivewayLength,
    drivewayRotationY,
    pathCenterX,
    pathCenterZ,
    pathWidth,
    pathDepth,
    pathLength,
    pathRotationY,
  });
};

const drivewayRectForProperty = (
  property: ResidentialPropertySpec,
  drivewayX: number,
  seed: number,
): ResidentialRect => {
  const access = residentialAccessLayout(
    Object.freeze({ ...property, drivewayX }),
    seed,
  );
  return orientedAccessRect(
    "driveway",
    { x: drivewayX, z: access.parkingZ },
    { x: access.roadX, z: access.roadEdgeZ },
    WORLD_SCALE.vehicle.width,
  );
};

const drivewayExclusionRectForProperty = (
  property: ResidentialPropertySpec,
  drivewayX: number,
  seed: number,
): ResidentialRect => {
  const access = residentialAccessLayout(
    Object.freeze({ ...property, drivewayX }),
    seed,
  );
  return orientedAccessRect(
    "driveway",
    { x: drivewayX, z: access.parkingZ },
    { x: access.roadX, z: access.roadEdgeZ },
    WORLD_SCALE.vehicle.width,
  );
};

const rectsHaveClearance = (
  left: ResidentialRect,
  right: ResidentialRect,
  clearance = 0.25,
): boolean =>
  left.maxX + clearance < right.minX ||
  left.minX - clearance > right.maxX ||
  left.maxZ + clearance < right.minZ ||
  left.minZ - clearance > right.maxZ;

const rectsOverlap = (
  left: ResidentialRect,
  right: ResidentialRect,
  margin = 0.16,
): boolean =>
  left.maxX + margin >= right.minX &&
  left.minX - margin <= right.maxX &&
  left.maxZ + margin >= right.minZ &&
  left.minZ - margin <= right.maxZ;

const orientedAccessRect = (
  role: "path" | "driveway",
  start: ResidentialPoint,
  end: ResidentialPoint,
  width: number,
): ResidentialRect => {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.max(0.001, Math.hypot(dx, dz) + 0.24);
  const rotationY = Math.atan2(dz, dx);
  const x = (start.x + end.x) / 2;
  const z = (start.z + end.z) / 2;
  const cosine = Math.abs(Math.cos(rotationY));
  const sine = Math.abs(Math.sin(rotationY));
  const halfX = (length / 2) * cosine + (width / 2) * sine;
  const halfZ = (length / 2) * sine + (width / 2) * cosine;
  return Object.freeze({
    minX: x - halfX,
    maxX: x + halfX,
    minZ: z - halfZ,
    maxZ: z + halfZ,
    role,
    x,
    z,
    length,
    width,
    rotationY,
  });
};

const resolveGeneratedAccess = (
  properties: readonly ResidentialPropertySpec[],
  seed: number,
): readonly ResidentialPropertySpec[] => {
  const occupied: ResidentialRect[] = [];
  const hardscape = baseExclusions(seed);
  const resolved = properties.map((property) => {
    if (property.drivewayX === null) return property;

    const preferredSide: -1 | 1 =
      property.drivewayX < property.houseX ? -1 : 1;
    const baseDistance = Math.abs(property.drivewayX - property.houseX);
    let drivewayX: number | null = null;
    let sharedAccessFallback:
      | Readonly<{ x: number; rect: ResidentialRect }>
      | null = null;

    for (let step = 0; step <= 72 && drivewayX === null; step += 1) {
      const distance = baseDistance + step * 0.42;
      for (const side of [preferredSide, -preferredSide] as const) {
        const candidateX = property.houseX + side * distance;
        const candidateRect = drivewayRectForProperty(
          property,
          candidateX,
          seed,
        );
        const reachesSidewalk = hardscape.some(
          (rect) => rect.role === "sidewalk" && rectsOverlap(candidateRect, rect),
        );
        const reachesRoad = hardscape.some(
          (rect) => rect.role === "road" && rectsOverlap(candidateRect, rect),
        );
        if (!reachesSidewalk || !reachesRoad) continue;

        const clearsHouses = properties.every((other) => {
          const footprint = propertyFootprint(other);
          return !footprintIntersectsHardscapeRect(
            candidateRect,
            { x: other.houseX, z: other.houseZ },
            footprint.halfWidth,
            footprint.halfDepth,
          );
        });
        if (!clearsHouses) continue;

        sharedAccessFallback ??= Object.freeze({
          x: candidateX,
          rect: candidateRect,
        });
        if (!occupied.every((existing) => rectsHaveClearance(candidateRect, existing))) {
          continue;
        }
        drivewayX = candidateX;
        occupied.push(candidateRect);
        break;
      }
    }

    if (drivewayX === null && sharedAccessFallback !== null) {
      drivewayX = sharedAccessFallback.x;
      occupied.push(sharedAccessFallback.rect);
    }
    if (drivewayX === null) {
      throw new Error(
        "unable to place generated driveway clear of residential footprints for " +
          property.role,
      );
    }
    return Object.freeze({
      ...property,
      drivewayX,
      mailboxX: null,
    });
  });
  return Object.freeze(resolved);
};

const accessExclusions = (
  properties: readonly ResidentialPropertySpec[],
  seed: number,
): ResidentialRect[] =>
  properties.flatMap((property) => {
    if (property.drivewayX === null) return [];
    const access = residentialAccessLayout(property, seed);
    const driveway = drivewayExclusionRectForProperty(property, property.drivewayX, seed);
    const path = orientedAccessRect(
      "path",
      { x: access.entryX, z: access.entryZ },
      { x: access.sidewalkX, z: access.sidewalkCenterZ },
      access.pathWidth,
    );
    return [driveway, path];
  });

const blockedByHouseFootprint = (
  point: ResidentialPoint,
  properties: readonly ResidentialPropertySpec[],
  clearance: number,
): boolean =>
  properties.some((property) => {
    const footprint = propertyFootprint(property);
    return (
      Math.abs(point.x - property.houseX) <= footprint.halfWidth + clearance &&
      Math.abs(point.z - property.houseZ) <= footprint.halfDepth + clearance
    );
  });

const blockedByHouseFront = (
  point: ResidentialPoint,
  properties: readonly ResidentialPropertySpec[],
  clearance: number,
): boolean =>
  properties.some((property) => {
    const forwardZ = Math.cos(property.rotationY);
    const forwardDistance = (point.z - property.houseZ) * forwardZ;
    return (
      Math.abs(point.x - property.houseX) < 3.45 + clearance &&
      forwardDistance > -0.4 - clearance &&
      forwardDistance < 6.5 + clearance
    );
  });

export const residentialFootprintIntersectsHardscape = (
  point: ResidentialPoint,
  layout: Pick<ResidentialLayout, "exclusions">,
  halfWidth = 0,
  halfDepth = halfWidth,
): boolean =>
  layout.exclusions.some((rect) =>
    footprintIntersectsHardscapeRect(
      rect,
      point,
      Math.max(0, halfWidth),
      Math.max(0, halfDepth),
    ),
  );

export const residentialPointIsBlocked = (
  point: ResidentialPoint,
  layout: Pick<ResidentialLayout, "exclusions" | "frontProperties" | "middleProperties" | "backProperties"> & Partial<Pick<ResidentialLayout, "outerProperties">>,
  clearance = 0,
): boolean => {
  const properties = [
    ...layout.frontProperties,
    ...layout.middleProperties,
    ...layout.backProperties,
    ...(layout.outerProperties ?? []),
  ];
  return (
    residentialFootprintIntersectsHardscape(
      point,
      layout,
      clearance,
      clearance,
    ) ||
    blockedByHouseFootprint(point, properties, clearance) ||
    blockedByHouseFront(point, properties, clearance)
  );
};

const generatePlantings = (
  seed: number,
  count: number,
  salt: number,
  zMin: number,
  zMax: number,
  layout: Pick<ResidentialLayout, "exclusions" | "frontProperties" | "middleProperties" | "backProperties"> & Partial<Pick<ResidentialLayout, "outerProperties">>,
  clearance: number,
  spacing: number,
): readonly ResidentialPlanting[] => {
  const result: ResidentialPlanting[] = [];
  for (let attempt = 0; attempt < count * 120 && result.length < count; attempt += 1) {
    const x = -108 + unit(seed, salt + attempt * 5) * 216;
    const z = zMin + unit(seed, salt + attempt * 5 + 1) * (zMax - zMin);
    const scale = 0.78 + unit(seed, salt + attempt * 5 + 2) * 0.34;
    const footprintClearance = clearance * scale;
    const candidate = { x, z };
    if (residentialPointIsBlocked(candidate, layout, footprintClearance)) continue;
    if (
      result.some(
        (existing) =>
          Math.hypot(existing.x - x, existing.z - z) <
          spacing * scale + spacing * existing.scale + 0.9,
      )
    ) {
      continue;
    }
    result.push(
      Object.freeze({
        x,
        z,
        scale,
        paletteIndex: Math.floor(unit(seed, salt + attempt * 5 + 3) * 7) % 7,
        propertyRole: null,
        yardZone: null,
      }),
    );
  }
  return Object.freeze(result);
};

const generateFlowers = (
  seed: number,
  layout: Pick<ResidentialLayout, "exclusions" | "frontProperties" | "middleProperties" | "backProperties"> & Partial<Pick<ResidentialLayout, "outerProperties">>,
): readonly ResidentialPlanting[] => {
  const result: ResidentialPlanting[] = [];
  for (let attempt = 0; attempt < 180 && result.length < 12; attempt += 1) {
    const x = -13 + unit(seed, 7_000 + attempt * 3) * 11.2;
    const z = -5.3 + unit(seed, 7_001 + attempt * 3) * 4.1;
    const candidate = { x, z };
    if (residentialPointIsBlocked(candidate, layout, 0.38)) continue;
    result.push(
      Object.freeze({
        x,
        z,
        scale: 1,
        paletteIndex: Math.floor(unit(seed, 7_002 + attempt * 3) * 5) % 5,
        propertyRole: null,
        yardZone: null,
      }),
    );
  }
  return Object.freeze(result);
};

const generatePropertyPlantings = (
  seed: number,
  properties: readonly ResidentialPropertySpec[],
  salt: number,
  yardZone: ResidentialYardZone,
  layout: Pick<ResidentialLayout, "exclusions" | "frontProperties" | "middleProperties" | "backProperties"> & Partial<Pick<ResidentialLayout, "outerProperties">>,
  clearance: number,
  spacing: number,
  paletteSize: number,
): readonly ResidentialPlanting[] => {
  const allProperties = [
    ...layout.frontProperties,
    ...layout.middleProperties,
    ...layout.backProperties,
    ...(layout.outerProperties ?? []),
  ];
  const result: ResidentialPlanting[] = [];

  properties.forEach((property, propertyIndex) => {
    const access = residentialAccessLayout(property, seed);
    const footprint = propertyFootprint(property);
    const direction = yardZone === "back"
      ? -access.frontDirection
      : access.frontDirection;
    const lateralCandidates =
      yardZone === "back"
        ? [
            -2.4, 2.4, 0, -3.5, 3.5, -4.8, 4.8, -6.2, 6.2, -7.5, 7.5,
            -9, 9, -10.5, 10.5, -12, 12,
          ]
        : [-2.2, 2.2, -3.05, 3.05];

    for (let attempt = 0; attempt < (yardZone === "back" ? 240 : 28); attempt += 1) {
      const scale =
        yardZone === "back"
          ? 0.3 +
            unit(seed, salt + propertyIndex * 107 + attempt * 7 + 2) * 0.12
          : 0.84 +
            unit(seed, salt + propertyIndex * 107 + attempt * 7 + 2) * 0.22;
      const footprintClearance = clearance * scale;
      const baseDistance =
        footprint.halfDepth +
        (yardZone === "back" ? footprintClearance + 0.28 : 1.05);
      const lateralBase =
        lateralCandidates[attempt % lateralCandidates.length] ?? 0;
      const ring = Math.floor(attempt / lateralCandidates.length);
      const x =
        property.houseX +
        lateralBase +
        signed(seed, salt + propertyIndex * 101 + attempt * 7) * 0.34;
      const z =
        property.houseZ +
        direction *
          (baseDistance +
            ring * 0.48 +
            unit(seed, salt + propertyIndex * 103 + attempt * 7 + 1) * 0.22);
      const candidate = { x, z };

      if (
        residentialFootprintIntersectsHardscape(
          candidate,
          layout,
          footprintClearance,
          footprintClearance,
        )
      ) {
        continue;
      }
      if (blockedByHouseFootprint(candidate, allProperties, footprintClearance)) {
        continue;
      }
      if (
        yardZone === "back" &&
        blockedByHouseFront(candidate, allProperties, footprintClearance)
      ) {
        continue;
      }
      if (
        result.some(
          (existing) =>
            Math.hypot(existing.x - x, existing.z - z) <
            spacing * (existing.scale + scale),
        )
      ) {
        continue;
      }

      if (yardZone === "back") {
        const behindProperty = (z - property.houseZ) * access.frontDirection < 0;
        if (!behindProperty) {
          continue;
        }
      }

      result.push(
        Object.freeze({
          x,
          z,
          scale,
          paletteIndex:
            Math.floor(
              unit(seed, salt + propertyIndex * 109 + attempt * 7 + 3) *
                paletteSize,
            ) % paletteSize,
          propertyRole: property.role,
          yardZone,
        }),
      );
      break;
    }
  });

  return Object.freeze(result);
};

const restoreFrontMailboxes = (
  properties: readonly ResidentialPropertySpec[],
  seed: number,
): readonly ResidentialPropertySpec[] =>
  Object.freeze(
    properties.map((property, index) => {
      if (property.drivewayX === null) return property;
      const drivewaySide: -1 | 1 =
        property.drivewayX < property.houseX ? -1 : 1;
      const offset =
        DRIVEWAY_HALF_WIDTH +
        MAILBOX_CLEARANCE_FROM_DRIVEWAY +
        unit(seed, index * 17 + 31) * 0.18;
      return Object.freeze({
        ...property,
        mailboxX: mailboxXForDriveway(
          property.drivewayX,
          drivewaySide,
          offset,
          seed,
        ),
      });
    }),
  );

export const generateResidentialLayout = (seed = DEFAULT_RESIDENTIAL_SEED): ResidentialLayout => {
  const safeSeed = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : DEFAULT_RESIDENTIAL_SEED;
  const front = restoreFrontMailboxes(
    resolveGeneratedAccess(frontProperties(safeSeed), safeSeed),
    safeSeed,
  );
  const middle = resolveGeneratedAccess(
    rowProperties(
      safeSeed,
      1_100,
      -26,
      [-46, -35, -24.5, -9.1, 4, 16.5, 29.7, 41.7],
      true,
    ),
    safeSeed,
  );
  const back = resolveGeneratedAccess(
    rowProperties(
      safeSeed,
      2_300,
      -49.5,
      [-47, -36.5, -25.4, -9.7, 3.5, 16.5, 28.5, 39.6, 52.5],
      true,
    ),
    safeSeed,
  );
  const outer = resolveGeneratedAccess(
    [
      ...rowProperties(
        safeSeed,
        2_900,
        16.8,
        [-94, -82, -70, -43, -31, -7, 6, 31, 44, 70, 83, 95],
        false,
      ),
      ...rowProperties(
        safeSeed,
        3_000,
        -72,
        [-94, -82, -70, -43, -31, -7, 6, 31, 44, 70, 83, 95],
        false,
      ),
    ],
    safeSeed,
  );
  const allPropertiesRaw = [...front, ...middle, ...back, ...outer];
  const allPropertiesResolved = resolvePropertyOverlaps(allPropertiesRaw);

  const resolvedByRole = new Map(allPropertiesResolved.map((p) => [p.role, p]));
  const resolveProperties = (props: readonly ResidentialPropertySpec[]) =>
    Object.freeze(props.map((p) => resolvedByRole.get(p.role) ?? p));

  const allProperties = allPropertiesResolved;
  const exclusions = Object.freeze([
    ...baseExclusions(safeSeed),
    ...accessExclusions(allProperties, safeSeed),
  ]);
  const resolvedFront = resolveProperties(front);
  const resolvedMiddle = resolveProperties(middle);
  const resolvedBack = resolveProperties(back);
  const resolvedOuter = resolveProperties(outer);
  const partial = {
    exclusions,
    frontProperties: resolvedFront,
    middleProperties: resolvedMiddle,
    backProperties: resolvedBack,
    outerProperties: resolvedOuter,
  } as const;

  const backyardTrees: ResidentialPlanting[] = [
    ...generatePropertyPlantings(
      safeSeed,
      allProperties,
      3_050,
      "back",
      partial,
      4.2,
      1.45,
      7,
    ),
  ];
  for (const fallbackSalt of [4_050, 4_850] as const) {
    const assignedRoles = new Set(
      backyardTrees
        .map((planting) => planting.propertyRole)
        .filter((role): role is string => role !== null),
    );
    const missingProperties = allProperties.filter(
      (property) => !assignedRoles.has(property.role),
    );
    if (missingProperties.length === 0) break;
    const fallback = generatePropertyPlantings(
      safeSeed,
      missingProperties,
      fallbackSalt,
      "back",
      partial,
      4.2,
      1.45,
      7,
    );
    for (const candidate of fallback) {
      const clearsExistingTrees = backyardTrees.every(
        (existing) =>
          Math.hypot(existing.x - candidate.x, existing.z - candidate.z) >=
          1.45 * (existing.scale + candidate.scale),
      );
      if (clearsExistingTrees) backyardTrees.push(candidate);
    }
  }
  const frontYardTrees: readonly ResidentialPlanting[] = generatePropertyPlantings(
    safeSeed,
    [...resolvedFront, ...resolvedMiddle],
    3_150,
    "front",
    partial,
    2.8,
    4.2,
    3,
  );
  const trees = Object.freeze([
    ...backyardTrees,
    ...frontYardTrees,
    ...generatePlantings(
      safeSeed,
      Math.max(0, 96 - backyardTrees.length - frontYardTrees.length),
      3_100,
      -88,
      38,
      partial,
      4.2,
      1.3,
    ),
  ]);

  const detailedProperties = [...resolvedFront, ...resolvedMiddle, ...resolvedBack];
  const yardShrubs = generatePropertyPlantings(
    safeSeed,
    detailedProperties,
    5_050,
    "front",
    partial,
    1.9,
    0.72,
    7,
  );
  const shrubs = Object.freeze([
    ...yardShrubs,
    ...generatePlantings(
      safeSeed,
      Math.max(0, 32 - yardShrubs.length),
      5_100,
      -76,
      30,
      partial,
      1.9,
      0.65,
    ),
  ]);

  const flowerBeds = generatePropertyPlantings(
    safeSeed,
    detailedProperties,
    6_900,
    "front",
    partial,
    0.38,
    0.48,
    5,
  );
  const flowers = Object.freeze([
    ...flowerBeds,
    ...generateFlowers(safeSeed, partial).slice(
      0,
      Math.max(0, 36 - flowerBeds.length),
    ),
  ]);

  return Object.freeze({
    seed: safeSeed,
    frontProperties: resolvedFront,
    middleProperties: resolvedMiddle,
    backProperties: resolvedBack,
    outerProperties: resolvedOuter,
    trees,
    shrubs,
    flowers,
    exclusions,
  });
};
