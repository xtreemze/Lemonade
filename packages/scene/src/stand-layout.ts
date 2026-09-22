import { SELLER_Z } from "./stand-anchors.js";
import { WORLD_SCALE } from "./world-scale.js";

export type StandBoxSpec = Readonly<{
  size: readonly [number, number, number];
  position: readonly [number, number, number];
}>;

const box = (
  size: readonly [number, number, number],
  position: readonly [number, number, number],
): StandBoxSpec => Object.freeze({ size, position });

const counterThickness = 0.1;
const counter = box(
  [2.8, counterThickness, 0.76],
  [0, WORLD_SCALE.stand.counterHeight - counterThickness / 2, 0.28],
);
const canopy = box(
  [2.9, 0.12, 1],
  [0, WORLD_SCALE.stand.canopyHeight, 0.12],
);
const counterTopY = counter.position[1] + counter.size[1] / 2;
const canopyBottomY = canopy.position[1] - canopy.size[1] / 2;
const postHeight = canopyBottomY - counterTopY;
const postCenterY = counterTopY + postHeight / 2;

export const STAND_LAYOUT = Object.freeze({
  body: box([2.55, 0.72, 0.34], [0, 0.36, 0.52]),
  counter,
  frontPanel: box([2.45, 0.48, 0.08], [0, 0.42, 0.72]),
  posts: Object.freeze([
    box([0.11, postHeight, 0.11], [-1.18, postCenterY, -0.02]),
    box([0.11, postHeight, 0.11], [1.18, postCenterY, -0.02]),
  ]),
  canopy,
  sellerZ: SELLER_Z,
  sellerFrontRadius: 0.27,
  sellerSightline: Object.freeze({
    minX: -0.25,
    maxX: 0.25,
  }),
  counterTopY,
  cupCenterY: counterTopY + 0.095,
  cupFootprint: Object.freeze({
    minX: 0.38,
    maxX: 1.18,
    minZ: 0.02,
    maxZ: 0.5,
  }),
  stockFootprint: Object.freeze({
    minX: -1.18,
    maxX: -0.36,
    minZ: 0.08,
    maxZ: 0.5,
  }),
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
