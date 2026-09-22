export type StreetTrafficKind = "bicycle" | "vehicle";
export type SidewalkSide = "near" | "far";

export const STREET_LAYOUT = Object.freeze({
  road: Object.freeze({
    centerZ: 5,
    depth: 4.7,
    minZ: 2.65,
    maxZ: 7.35,
  }),
  nearSidewalk: Object.freeze({
    centerZ: 1.45,
    depth: 2,
    minZ: 0.45,
    maxZ: 2.45,
  }),
  farSidewalk: Object.freeze({
    centerZ: 8.55,
    depth: 2,
    minZ: 7.55,
    maxZ: 9.55,
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
  const inset = 0.37;
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
  const safeInset = Math.max(0, Math.min(0.4, inset));
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
  if (kind === "bicycle") return lane === 0 ? 3.02 : 6.98;
  return lane === 0 ? 4.08 : 5.92;
};

export type GardenSignPosition = Readonly<{
  x: number;
  y: number;
  z: number;
  rotationY: number;
}>;

const STAND_GARDEN_SIGN_COLUMNS = [
  -12.4,
  -11.1,
  -7.55,
  -6.3,
  -5.05,
  -3.8,
  -2.55,
  -1.3,
] as const;

export const gardenSignPosition = (index: number): GardenSignPosition => {
  const safeIndex = Math.max(0, Math.trunc(Number.isFinite(index) ? index : 0));
  const column = safeIndex % STAND_GARDEN_SIGN_COLUMNS.length;
  const row = Math.floor(safeIndex / STAND_GARDEN_SIGN_COLUMNS.length);
  return Object.freeze({
    x: STAND_GARDEN_SIGN_COLUMNS[column] ?? -5.6,
    y: 0,
    z: -0.85 - row * 1.05,
    rotationY: (safeIndex % 3 - 1) * 0.055,
  });
};
