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

export const gardenSignPosition = (index: number): GardenSignPosition => {
  const safeIndex = Math.max(0, Math.trunc(Number.isFinite(index) ? index : 0));
  const side = safeIndex % 2 === 0 ? -1 : 1;
  const slot = Math.floor(safeIndex / 2);
  const column = slot % 5;
  const row = Math.floor(slot / 5);
  return Object.freeze({
    x: side * (3.8 + column * 1.35),
    y: 0,
    z: -1.05 - row * 1.9,
    rotationY: side * 0.12,
  });
};

export const clampToNearSidewalk = (z: number, inset = 0.1): number => {
  const safeInset = Math.max(0, Math.min(0.4, inset));
  return Math.min(
    STREET_LAYOUT.nearSidewalk.maxZ - safeInset,
    Math.max(STREET_LAYOUT.nearSidewalk.minZ + safeInset, z),
  );
};
