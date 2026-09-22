export type StandBoxSpec = Readonly<{
  size: readonly [number, number, number];
  position: readonly [number, number, number];
}>;

const box = (
  size: readonly [number, number, number],
  position: readonly [number, number, number],
): StandBoxSpec => Object.freeze({ size, position });

const counter = box([3.55, 0.14, 0.78], [0, 1.28, 0.32]);
const canopy = box([3.45, 0.14, 0.82], [0, 2.72, 0.18]);
const counterTopY = counter.position[1] + counter.size[1] / 2;

export const STAND_LAYOUT = Object.freeze({
  body: box([3.25, 1.18, 1.32], [0, 0.59, 0]),
  counter,
  frontPanel: box([2.95, 0.56, 0.14], [0, 0.68, 0.72]),
  posts: Object.freeze([
    box([0.14, 1.72, 0.14], [-1.45, 1.9, -0.02]),
    box([0.14, 1.72, 0.14], [1.45, 1.9, -0.02]),
  ]),
  canopy,
  sellerZ: -0.86,
  sellerFrontRadius: 0.42,
  counterTopY,
  cupCenterY: counterTopY + 0.095,
  cupFootprint: Object.freeze({
    minX: -1.52,
    maxX: 1.52,
    minZ: 0.06,
    maxZ: 0.58,
  }),
  lemonCenterY: counterTopY + 0.21,
});

export const standCounterBounds = (): Readonly<{
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
}> => Object.freeze({
  minX: counter.position[0] - counter.size[0] / 2,
  maxX: counter.position[0] + counter.size[0] / 2,
  minZ: counter.position[2] - counter.size[2] / 2,
  maxZ: counter.position[2] + counter.size[2] / 2,
  topY: counterTopY,
});
