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

export type ResidentialPlanting = Readonly<{
  x: number;
  z: number;
  scale: number;
  paletteIndex: number;
}>;

export type ResidentialRect = Readonly<{
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  role: "road" | "sidewalk" | "driveway";
}>;

export type ResidentialLayout = Readonly<{
  seed: number;
  frontProperties: readonly ResidentialPropertySpec[];
  middleProperties: readonly ResidentialPropertySpec[];
  backProperties: readonly ResidentialPropertySpec[];
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
  for (let pass = 0; pass < 5; pass += 1) {
    let moved = false;
    for (const rect of baseHardscape(seed)) {
      if (!footprintIntersectsRect(rect, { x, z }, halfWidth, halfDepth)) continue;
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
  return Object.freeze({ x, z });
};

const mailboxAnchorIsClear = (x: number, seed: number): boolean =>
  !baseHardscape(seed).some((rect) =>
    footprintIntersectsRect(rect, { x, z: -0.3 }, 0.3, 0.3),
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
        0,
        seed,
      ),
    ),
  );

function baseExclusions(seed: number): ResidentialRect[] {
  return streetNetworkHardscapeRects(seed).map((rect) => ({
    minX: rect.minX,
    maxX: rect.maxX,
    minZ: rect.minZ,
    maxZ: rect.maxZ,
    role: rect.role,
  }));
}

const drivewayExclusions = (
  properties: readonly ResidentialPropertySpec[],
): ResidentialRect[] =>
  properties.flatMap((property) =>
    property.drivewayX === null
      ? []
      : [
          {
            minX: property.drivewayX - DRIVEWAY_HALF_WIDTH,
            maxX: property.drivewayX + DRIVEWAY_HALF_WIDTH,
            minZ: FRONT_DRIVEWAY_MIN_Z,
            maxZ: FRONT_DRIVEWAY_MAX_Z,
            role: "driveway" as const,
          },
        ],
  );

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
    footprintIntersectsRect(
      rect,
      point,
      Math.max(0, halfWidth),
      Math.max(0, halfDepth),
    ),
  );

export const residentialPointIsBlocked = (
  point: ResidentialPoint,
  layout: Pick<ResidentialLayout, "exclusions" | "frontProperties" | "middleProperties" | "backProperties">,
  clearance = 0,
): boolean =>
  residentialFootprintIntersectsHardscape(point, layout, clearance, clearance) ||
  blockedByHouseFront(
    point,
    [...layout.frontProperties, ...layout.middleProperties, ...layout.backProperties],
    clearance,
  );

const generatePlantings = (
  seed: number,
  count: number,
  salt: number,
  zMin: number,
  zMax: number,
  layout: Pick<ResidentialLayout, "exclusions" | "frontProperties" | "middleProperties" | "backProperties">,
  clearance: number,
  spacing: number,
): readonly ResidentialPlanting[] => {
  const result: ResidentialPlanting[] = [];
  for (let attempt = 0; attempt < count * 120 && result.length < count; attempt += 1) {
    const x = -68 + unit(seed, salt + attempt * 5) * 136;
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
      }),
    );
  }
  return Object.freeze(result);
};

const generateFlowers = (
  seed: number,
  layout: Pick<ResidentialLayout, "exclusions" | "frontProperties" | "middleProperties" | "backProperties">,
): readonly ResidentialPlanting[] => {
  const result: ResidentialPlanting[] = [];
  for (let attempt = 0; attempt < 180 && result.length < 12; attempt += 1) {
    const x = -13 + unit(seed, 7_000 + attempt * 3) * 11.2;
    const z = -5.3 + unit(seed, 7_001 + attempt * 3) * 4.1;
    const candidate = { x, z };
    if (residentialPointIsBlocked(candidate, layout, 0.16)) continue;
    result.push(
      Object.freeze({
        x,
        z,
        scale: 1,
        paletteIndex: Math.floor(unit(seed, 7_002 + attempt * 3) * 5) % 5,
      }),
    );
  }
  return Object.freeze(result);
};

export const generateResidentialLayout = (seed = DEFAULT_RESIDENTIAL_SEED): ResidentialLayout => {
  const safeSeed = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : DEFAULT_RESIDENTIAL_SEED;
  const front = frontProperties(safeSeed);
  const middle = rowProperties(
    safeSeed,
    1_100,
    -26,
    [-46, -35, -24.5, -9.1, 4, 11.4, 29.7, 41.7],
    true,
  );
  const back = rowProperties(
    safeSeed,
    2_300,
    -49.5,
    [-47, -36.5, -25.4, -9.7, 3.5, 12, 28.5, 39.6, 49],
    true,
  );
  const exclusions = Object.freeze([
    ...baseExclusions(safeSeed),
    ...drivewayExclusions(front),
  ]);
  const partial = {
    exclusions,
    frontProperties: front,
    middleProperties: middle,
    backProperties: back,
  } as const;

  const trees = generatePlantings(
    safeSeed,
    48,
    3_100,
    -67,
    0.2,
    partial,
    3.5,
    1.3,
  );
  const shrubs = generatePlantings(
    safeSeed,
    14,
    5_100,
    -33,
    -1.1,
    partial,
    1.9,
    0.65,
  );
  const flowers = generateFlowers(safeSeed, partial);

  return Object.freeze({
    seed: safeSeed,
    frontProperties: front,
    middleProperties: middle,
    backProperties: back,
    trees,
    shrubs,
    flowers,
    exclusions,
  });
};
