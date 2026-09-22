export const walkingCycleAtDistance = (
  travelDistance: number,
  heightScale: number,
  walkPace: number,
  strideOffset: number,
): number => {
  const safeHeight = Math.max(
    0.62,
    Math.min(1.2, Number.isFinite(heightScale) ? heightScale : 1),
  );
  const safePace = Math.max(
    0.75,
    Math.min(1.35, Number.isFinite(walkPace) ? walkPace : 1),
  );
  const cycleDistance = Math.max(0.55, (1.16 * safeHeight) / safePace);
  return (
    (Math.max(0, Number.isFinite(travelDistance) ? travelDistance : 0) /
      cycleDistance) *
      Math.PI *
      2 +
    strideOffset
  );
};
