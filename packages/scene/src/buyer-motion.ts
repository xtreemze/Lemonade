import { STAND_WORLD_Z } from "./stand-anchors.js";
import { sidewalkLaneZ } from "./street-layout.js";
import type { BuyerPhase, SaleBeat } from "./storyboard.js";

export const BUYER_WALK_SPEED = 1.35;

export type BuyerMotionPose = Readonly<{
  x: number;
  z: number;
  heading: number;
  travelDistance: number;
}>;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const lerp = (start: number, end: number, progress: number): number =>
  start + (end - start) * progress;

const headingForTravel = (
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): number => Math.PI / 2 - Math.atan2(toZ - fromZ, toX - fromX);

const reachableSidewalkPoint = (
  sale: SaleBeat,
  durationMs: number,
  originX: number,
  originZ: number,
  towardStand: boolean,
): Readonly<{ x: number; z: number; distance: number }> => {
  const z = sidewalkLaneZ(sale.lane);
  const durationSeconds = Math.max(0.001, durationMs / 1_000);
  const targetDistance = BUYER_WALK_SPEED * durationSeconds;
  const zDistance = Math.abs(z - originZ);
  const distance = Math.max(zDistance, targetDistance);
  const xDistance = Math.sqrt(
    Math.max(0, distance * distance - zDistance * zDistance),
  );
  const travelSign = sale.direction === -1 ? 1 : -1;
  const xSign = towardStand ? -travelSign : travelSign;
  return Object.freeze({
    x: originX + xSign * xDistance,
    z,
    distance,
  });
};

export const buyerMotionPoseAt = (
  sale: SaleBeat,
  phase: Exclude<BuyerPhase, "inactive">,
  elapsedMs: number,
): BuyerMotionPose => {
  const counterX = sale.direction === -1 ? -0.72 : 0.72;
  const counterZ = STAND_WORLD_Z + 1.22;
  const drinkX = sale.direction === -1 ? -1.35 : 1.35;
  const drinkZ = STAND_WORLD_Z + 1.78;

  const approachDurationMs = Math.max(1, sale.purchaseAtMs - sale.approachAtMs);
  const approachStart = reachableSidewalkPoint(
    sale,
    approachDurationMs,
    counterX,
    counterZ,
    true,
  );
  const approachHeading = headingForTravel(
    approachStart.x,
    approachStart.z,
    counterX,
    counterZ,
  );

  if (phase === "approaching") {
    const progress = clamp01(
      (elapsedMs - sale.approachAtMs) / approachDurationMs,
    );
    return Object.freeze({
      x: lerp(approachStart.x, counterX, progress),
      z: lerp(approachStart.z, counterZ, progress),
      heading: approachHeading,
      travelDistance: approachStart.distance * progress,
    });
  }

  if (phase === "purchasing") {
    return Object.freeze({
      x: counterX,
      z: counterZ,
      heading: sale.direction === -1 ? -0.22 : 0.22,
      travelDistance: approachStart.distance,
    });
  }

  const drinkDurationMs = Math.max(1, sale.drinkEndAtMs - sale.purchaseEndAtMs);
  if (phase === "drinking") {
    const progress = clamp01(
      (elapsedMs - sale.purchaseEndAtMs) / drinkDurationMs,
    );
    return Object.freeze({
      x: lerp(counterX, drinkX, progress),
      z: lerp(counterZ, drinkZ, progress),
      heading: sale.direction === -1 ? -0.22 : 0.22,
      travelDistance: approachStart.distance,
    });
  }

  const departDurationMs = Math.max(1, sale.departAtMs - sale.drinkEndAtMs);
  const departureEnd = reachableSidewalkPoint(
    sale,
    departDurationMs,
    drinkX,
    drinkZ,
    false,
  );
  const progress = clamp01(
    (elapsedMs - sale.drinkEndAtMs) / departDurationMs,
  );
  return Object.freeze({
    x: lerp(drinkX, departureEnd.x, progress),
    z: lerp(drinkZ, departureEnd.z, progress),
    heading: headingForTravel(
      drinkX,
      drinkZ,
      departureEnd.x,
      departureEnd.z,
    ),
    travelDistance: approachStart.distance + departureEnd.distance * progress,
  });
};
