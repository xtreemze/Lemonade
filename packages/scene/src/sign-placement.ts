export const GARDEN_SIGN_MAX_Z = 0.2;

export const signGardenPosition = (
  index: number,
): Readonly<{ x: number; z: number }> => {
  const safeIndex = Math.max(0, Number.isFinite(index) ? Math.trunc(index) : 0);
  const side = safeIndex % 2 === 0 ? -1 : 1;
  const row = Math.floor(safeIndex / 2);
  return Object.freeze({
    x: side * (3.6 + (row % 4) * 1.15),
    z: GARDEN_SIGN_MAX_Z - Math.floor(row / 4) * 0.5,
  });
};
