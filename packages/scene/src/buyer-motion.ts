import { STAND_WORLD_Z } from "./stand-anchors.js";
import type { BuyerPhase, SaleBeat } from "./storyboard.js";

export const BUYER_WALK_SPEED = 1.28;

export type BuyerMotionPose = Readonly<{
  x: number;
  z: number;
  heading: number;
  travelDistance: number;
}>;

type Point = Readonly<{ x: number; z: number }>;

const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const linearProgress = (
  elapsedMs: number,
  startAtMs: number,
  endAtMs: number,
): number =>
  clamp01(
    (elapsedMs - startAtMs) /
      Math.max(1, endAtMs - startAtMs),
  );

const smoothStep = (value: number): number => {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
};

const distance = (start: Point, end: Point): number =>
  Math.hypot(end.x - start.x, end.z - start.z);

const headingFor = (start: Point, end: Point): number =>
  Math.PI / 2 - Math.atan2(end.z - start.z, end.x - start.x);

const interpolate = (
  start: Point,
  end: Point,
  progress: number,
): Point =>
  Object.freeze({
    x: start.x + (end.x - start.x) * progress,
    z: start.z + (end.z - start.z) * progress,
  });

const walkEndpoint = (
  anchor: Point,
  streetZ: number,
  direction: -1 | 1,
  durationMs: number,
  outbound: boolean,
): Point => {
  const travelSign = direction === -1 ? 1 : -1;
  const verticalDistance = Math.abs(streetZ - anchor.z);
  const targetDistance = Math.max(
    verticalDistance,
    BUYER_WALK_SPEED * (Math.max(1, durationMs) / 1_000),
  );
  const horizontalDistance = Math.sqrt(
    Math.max(0, targetDistance * targetDistance - verticalDistance * verticalDistance),
  );
  return Object.freeze({
    x:
      anchor.x +
      travelSign * horizontalDistance * (outbound ? 1 : -1),
    z: streetZ,
  });
};

const phaseAnchorPoints = (
  sale: SaleBeat,
  streetZ: number,
): Readonly<{
  approachStart: Point;
  counter: Point;
  drink: Point;
  departEnd: Point;
  approachDistance: number;
  drinkDistance: number;
  departDistance: number;
}> => {
  const counter = Object.freeze({
    x: sale.direction === -1 ? -0.72 : 0.72,
    z: STAND_WORLD_Z + 1.22,
  });
  const drink = Object.freeze({
    x: sale.direction === -1 ? -1.35 : 1.35,
    z: STAND_WORLD_Z + 1.78,
  });
  const approachStart = walkEndpoint(
    counter,
    streetZ,
    sale.direction,
    sale.purchaseAtMs - sale.approachAtMs,
    false,
  );
  const departEnd = walkEndpoint(
    drink,
    streetZ,
    sale.direction,
    sale.departAtMs - sale.drinkEndAtMs,
    true,
  );

  return Object.freeze({
    approachStart,
    counter,
    drink,
    departEnd,
    approachDistance: distance(approachStart, counter),
    drinkDistance: distance(counter, drink),
    departDistance: distance(drink, departEnd),
  });
};

export const buyerMotionAt = (
  sale: SaleBeat,
  phase: BuyerPhase,
  elapsedMs: number,
  streetZ: number,
): BuyerMotionPose => {
  const safeStreetZ = Number.isFinite(streetZ) ? streetZ : 0;
  const points = phaseAnchorPoints(sale, safeStreetZ);

  if (phase === "approaching") {
    const progress = linearProgress(
      elapsedMs,
      sale.approachAtMs,
      sale.purchaseAtMs,
    );
    const point = interpolate(points.approachStart, points.counter, progress);
    return Object.freeze({
      ...point,
      heading: headingFor(points.approachStart, points.counter),
      travelDistance: points.approachDistance * progress,
    });
  }

  if (phase === "purchasing" || phase === "inactive") {
    return Object.freeze({
      ...points.counter,
      heading: sale.direction === -1 ? -0.22 : 0.22,
      travelDistance: points.approachDistance,
    });
  }

  if (phase === "drinking") {
    const progress = smoothStep(
      linearProgress(
        elapsedMs,
        sale.purchaseEndAtMs,
        sale.drinkEndAtMs,
      ),
    );
    const point = interpolate(points.counter, points.drink, progress);
    return Object.freeze({
      ...point,
      heading: sale.direction === -1 ? -0.22 : 0.22,
      travelDistance:
        points.approachDistance + points.drinkDistance * progress,
    });
  }

  const progress = linearProgress(
    elapsedMs,
    sale.drinkEndAtMs,
    sale.departAtMs,
  );
  const point = interpolate(points.drink, points.departEnd, progress);
  return Object.freeze({
    ...point,
    heading: headingFor(points.drink, points.departEnd),
    travelDistance:
      points.approachDistance +
      points.drinkDistance +
      points.departDistance * progress,
  });
};
