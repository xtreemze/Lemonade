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

const mix32 = (seed: number, salt: number): number => {
  let value = (seed ^ Math.imul((salt + 1) >>> 0, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
};

const unit = (seed: number, salt: number): number => mix32(seed, salt) / 0xffff_ffff;
const signed = (seed: number, salt: number): number => unit(seed, salt) * 2 - 1;

const rectContains = (rect: ResidentialRect, point: ResidentialPoint, inset = 0): boolean =>
  point.x >= rect.minX - inset &&
  point.x <= rect.maxX + inset &&
  point.z >= rect.minZ - inset &&
  point.z <= rect.maxZ + inset;

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
  const houseX = featured ? baseX : baseX + signed(seed, index * 11 + 1) * 0.82;
  const houseZ = featured ? baseZ : baseZ + signed(seed, index * 11 + 2) * 1.05;
  const scale = baseScale + signed(seed, index * 11 + 3) * 0.055;
  const rotationY =
    baseRotation +
    signed(seed, index * 11 + 4) * (featured ? 0.014 : 0.055) +
    (facingBack ? Math.PI : 0);
  const drivewayOffset = 3.45 + unit(seed, index * 11 + 5) * 0.62;
  const drivewayX =
    drivewaySide === 0
      ? null
      : houseX + drivewaySide * drivewayOffset;
  const mailboxX =
    drivewayX === null
      ? null
      : drivewayX - drivewaySide * (1.34 + unit(seed, index * 11 + 6) * 0.22);

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
      drivewayX: -8.45,
      mailboxX: -7.05,
    }),
    Object.freeze({
      role: "stand-neighbor",
      houseX: 8.8,
      houseZ: -8.6,
      color: 4,
      scale: 0.97,
      rotationY: -0.055,
      drivewayX: 12.1,
      mailboxX: 10.7,
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
        `row-${rowSalt}-${index}`,
        baseX,
        z + signed(seed, rowSalt + index * 3) * 2.1,
        0.94 + unit(seed, rowSalt + index * 3 + 1) * 0.1,
        signed(seed, rowSalt + index * 3 + 2) * 0.035,
        backFacing,
        0,
      ),
    ),
  );

const baseExclusions = (): ResidentialRect[] => [
  {
    minX: -75,
    maxX: 75,
    minZ: STREET_LAYOUT.road.minZ,
    maxZ: STREET_LAYOUT.road.maxZ,
    role: "road",
  },
  {
    minX: -75,
    maxX: 75,
    minZ: STREET_LAYOUT.nearSidewalk.minZ,
    maxZ: STREET_LAYOUT.nearSidewalk.maxZ,
    role: "sidewalk",
  },
  {
    minX: -75,
    maxX: 75,
    minZ: STREET_LAYOUT.farSidewalk.minZ,
    maxZ: STREET_LAYOUT.farSidewalk.maxZ,
    role: "sidewalk",
  },
  { minX: -18.6, maxX: -12.4, minZ: -76, maxZ: 36, role: "road" },
  { minX: 15.4, maxX: 21.6, minZ: -76, maxZ: 36, role: "road" },
  { minX: -75, maxX: 75, minZ: -17.9, maxZ: -13.1, role: "road" },
  { minX: -75, maxX: 75, minZ: -39.2, maxZ: -34.8, role: "road" },
];

const drivewayExclusions = (
  properties: readonly ResidentialPropertySpec[],
): ResidentialRect[] =>
  properties.flatMap((property) =>
    property.drivewayX === null
      ? []
      : [
          {
            minX: property.drivewayX - 1.2,
            maxX: property.drivewayX + 1.2,
            minZ: -6.2,
            maxZ: 0.9,
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

export const residentialPointIsBlocked = (
  point: ResidentialPoint,
  layout: Pick<ResidentialLayout, "exclusions" | "frontProperties" | "middleProperties" | "backProperties">,
  clearance = 0,
): boolean =>
  layout.exclusions.some((rect) => rectContains(rect, point, clearance)) ||
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
): readonly ResidentialPlanting[] => {
  const result: ResidentialPlanting[] = [];
  for (let attempt = 0; attempt < count * 80 && result.length < count; attempt += 1) {
    const x = -51 + unit(seed, salt + attempt * 5) * 102;
    const z = zMin + unit(seed, salt + attempt * 5 + 1) * (zMax - zMin);
    const candidate = { x, z };
    if (residentialPointIsBlocked(candidate, layout, clearance)) continue;
    if (
      result.some(
        (existing) => Math.hypot(existing.x - x, existing.z - z) < clearance * 2 + 0.9,
      )
    ) {
      continue;
    }
    result.push(
      Object.freeze({
        x,
        z,
        scale: 0.78 + unit(seed, salt + attempt * 5 + 2) * 0.34,
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
    if (residentialPointIsBlocked(candidate, layout, 0.08)) continue;
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
  const exclusions = Object.freeze([...baseExclusions(), ...drivewayExclusions(front)]);
  const partial = {
    exclusions,
    frontProperties: front,
    middleProperties: middle,
    backProperties: back,
  } as const;

  const trees = generatePlantings(safeSeed, 48, 3_100, -60, 0.2, partial, 1.15);
  const shrubs = generatePlantings(safeSeed, 14, 5_100, -33, -1.1, partial, 0.42);
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
