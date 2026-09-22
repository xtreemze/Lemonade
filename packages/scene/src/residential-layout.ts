import { STREET_LAYOUT } from "./street-layout.js";

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
  role: "road" | "sidewalk" | "driveway" | "path";
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
export const DRIVEWAY_HALF_WIDTH = 2.15 / 2;
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

const baseHardscape = (): readonly ResidentialRect[] => baseExclusions();

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
): ResidentialPoint => {
  let x = point.x;
  let z = point.z;
  for (let pass = 0; pass < 5; pass += 1) {
    let moved = false;
    for (const rect of baseHardscape()) {
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

const mailboxAnchorIsClear = (x: number): boolean =>
  !baseHardscape().some((rect) =>
    footprintIntersectsRect(rect, { x, z: -0.3 }, 0.3, 0.3),
  );

const mailboxXForDriveway = (
  drivewayX: number,
  drivewaySide: -1 | 1,
  offset: number,
): number => {
  const preferred = drivewayX + drivewaySide * offset;
  if (mailboxAnchorIsClear(preferred)) return preferred;
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
      : mailboxXForDriveway(drivewayX, drivewaySide, mailboxOffset);

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

const frontProperties = (seed: number): readonly ResidentialPropertySpec[] =>
  Object.freeze([
    makeProperty(seed, 0, "west-end", -44.6, -7.1, 0.96, 0.035, false, 1),
    makeProperty(seed, 1, "west-mid", -33.7, -8.4, 1.02, -0.045, false, 1),
    makeProperty(seed, 2, "west-near", -24.0, -6.6, 0.92, 0.06, false, 1),
    Object.freeze({
      role: "stand-home",
      houseX: -4.7,
      houseZ: -7.9,
      color: 2,
      scale: 1.06,
      rotationY: 0.045,
      drivewayX: -9.5,
      mailboxX: -11.15,
    }),
    Object.freeze({
      role: "stand-neighbor",
      houseX: 8.8,
      houseZ: -8.6,
      color: 4,
      scale: 0.97,
      rotationY: -0.055,
      drivewayX: 13.55,
      mailboxX: 11.9,
    }),
    makeProperty(seed, 5, "east-mid", 29.1, -6.8, 1.01, 0.025, false, -1),
    makeProperty(seed, 6, "east-end", 41.5, -8.3, 0.94, -0.05, false, 1),
  ]);

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
      ),
    ),
  );

function baseExclusions(): ResidentialRect[] {
  return [
  {
    minX: -120,
    maxX: 120,
    minZ: STREET_LAYOUT.road.minZ,
    maxZ: STREET_LAYOUT.road.maxZ,
    role: "road",
  },
  {
    minX: -120,
    maxX: 120,
    minZ: STREET_LAYOUT.nearSidewalk.minZ,
    maxZ: STREET_LAYOUT.nearSidewalk.maxZ,
    role: "sidewalk",
  },
  {
    minX: -120,
    maxX: 120,
    minZ: STREET_LAYOUT.farSidewalk.minZ,
    maxZ: STREET_LAYOUT.farSidewalk.maxZ,
    role: "sidewalk",
  },
  { minX: -51.2, maxX: -44.8, minZ: -86, maxZ: 42, role: "road" },
  { minX: -18.6, maxX: -12.4, minZ: -86, maxZ: 42, role: "road" },
  { minX: 15.4, maxX: 21.6, minZ: -86, maxZ: 42, role: "road" },
  { minX: 48.8, maxX: 55.2, minZ: -86, maxZ: 42, role: "road" },
  { minX: -120, maxX: 120, minZ: -17.9, maxZ: -13.1, role: "road" },
  { minX: -120, maxX: 120, minZ: -20.1, maxZ: -18.1, role: "sidewalk" },
  { minX: -120, maxX: 120, minZ: -12.9, maxZ: -10.9, role: "sidewalk" },
  { minX: -120, maxX: 120, minZ: -39.2, maxZ: -34.8, role: "road" },
  { minX: -120, maxX: 120, minZ: -41.4, maxZ: -39.4, role: "sidewalk" },
  { minX: -120, maxX: 120, minZ: -34.6, maxZ: -32.6, role: "sidewalk" },
  { minX: -120, maxX: 120, minZ: -60.8, maxZ: -56.2, role: "road" },
  { minX: -120, maxX: 120, minZ: -63, maxZ: -61, role: "sidewalk" },
  { minX: -120, maxX: 120, minZ: -56, maxZ: -54, role: "sidewalk" },
  { minX: -120, maxX: 120, minZ: 22.6, maxZ: 27.4, role: "road" },
  { minX: -120, maxX: 120, minZ: 20.4, maxZ: 22.4, role: "sidewalk" },
  { minX: -120, maxX: 120, minZ: 27.6, maxZ: 29.6, role: "sidewalk" },
  ];
}

const accessExclusions = (
  properties: readonly ResidentialPropertySpec[],
): ResidentialRect[] =>
  properties.flatMap((property) => {
    if (property.drivewayX === null) return [];
    const frontDirection = Math.cos(property.rotationY) >= 0 ? 1 : -1;
    const drivewayCenterZ = property.houseZ + frontDirection * 4.15;
    const pathCenterZ = property.houseZ + frontDirection * 6;
    return [
      {
        minX: property.drivewayX - DRIVEWAY_HALF_WIDTH,
        maxX: property.drivewayX + DRIVEWAY_HALF_WIDTH,
        minZ: drivewayCenterZ - 3.6,
        maxZ: drivewayCenterZ + 3.6,
        role: "driveway" as const,
      },
      {
        minX: property.houseX - 0.52,
        maxX: property.houseX + 0.52,
        minZ: pathCenterZ - 2,
        maxZ: pathCenterZ + 2,
        role: "path" as const,
      },
    ];
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
    footprintIntersectsRect(
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
): boolean =>
  residentialFootprintIntersectsHardscape(point, layout, clearance, clearance) ||
  blockedByHouseFront(
    point,
    [...layout.frontProperties, ...layout.middleProperties, ...layout.backProperties, ...(layout.outerProperties ?? [])],
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
    false,
  );
  const outer = Object.freeze([
    ...rowProperties(
      safeSeed,
      2_900,
      16.8,
      [-88, -76, -64, -37, -26, -3, 8, 32, 43, 68, 80, 92],
      false,
    ),
    ...rowProperties(
      safeSeed,
      3_000,
      -69,
      [-90, -78, -66, -38, -27, -3, 9, 31, 42, 67, 79, 91],
      false,
    ),
  ]);
  const allProperties = [...front, ...middle, ...back, ...outer];
  const exclusions = Object.freeze([...baseExclusions(), ...accessExclusions(allProperties)]);
  const partial = {
    exclusions,
    frontProperties: front,
    middleProperties: middle,
    backProperties: back,
    outerProperties: outer,
  } as const;

  const trees = generatePlantings(
    safeSeed,
    72,
    3_100,
    -82,
    34,
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
    outerProperties: outer,
    trees,
    shrubs,
    flowers,
    exclusions,
  });
};
