export type StreetTrafficKind = "bicycle" | "vehicle";

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

export const sidewalkLaneZ = (lane: number): number => {
  const normalized = Math.abs(Math.trunc(Number.isFinite(lane) ? lane : 0)) % 4;
  return 0.82 + normalized * 0.39;
};

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
  -11.8,
  -10.6,
  -7.3,
  -6.2,
  -5.1,
  -4,
  -2.9,
  -1.8,
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

export const clampToNearSidewalk = (z: number, inset = 0.1): number => {
  const safeInset = Math.max(0, Math.min(0.4, inset));
  return Math.min(
    STREET_LAYOUT.nearSidewalk.maxZ - safeInset,
    Math.max(STREET_LAYOUT.nearSidewalk.minZ + safeInset, z),
  );
};
