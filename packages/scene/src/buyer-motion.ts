import { STAND_WORLD_Z } from "./stand-anchors.js";
import {
  buyerPhaseAt,
  type BuyerPhase,
  type SaleBeat,
} from "./storyboard.js";

export const BUYER_WALK_SPEED = 1.35 as const;

type Point = Readonly<{ x: number; z: number }>;

export type BuyerMotionPose = Readonly<{
  phase: Exclude<BuyerPhase, "inactive">;
  x: number;
  z: number;
  heading: number;
  travelDistance: number;
}>;

const distance = (left: Point, right: Point): number =>
  Math.hypot(right.x - left.x, right.z - left.z);

const headingForSegment = (from: Point, to: Point): number =>
  Math.PI / 2 - Math.atan2(to.z - from.z, to.x - from.x);

const pathLength = (points: readonly Point[]): number => {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous !== undefined && current !== undefined) {
      total += distance(previous, current);
    }
  }
  return total;
};

const samplePath = (
  points: readonly Point[],
  travelDistance: number,
): Readonly<{ point: Point; heading: number }> => {
  const first = points[0];
  if (first === undefined) {
    return Object.freeze({
      point: Object.freeze({ x: 0, z: 0 }),
      heading: 0,
    });
  }

  let remaining = Math.max(0, travelDistance);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous === undefined || current === undefined) continue;
    const segmentLength = Math.max(0.0001, distance(previous, current));
    if (remaining <= segmentLength) {
      const progress = remaining / segmentLength;
      return Object.freeze({
        point: Object.freeze({
          x: previous.x + (current.x - previous.x) * progress,
          z: previous.z + (current.z - previous.z) * progress,
        }),
        heading: headingForSegment(previous, current),
      });
    }
    remaining -= segmentLength;
  }

  const last = points.at(-1) ?? first;
  const previous = points.at(-2) ?? first;
  return Object.freeze({
    point: last,
    heading: headingForSegment(previous, last),
  });
};

const servicePoint = (sale: SaleBeat): Point =>
  Object.freeze({
    x: sale.direction === -1 ? -0.72 : 0.72,
    z: STAND_WORLD_Z + 1.22,
  });

const drinkPoint = (sale: SaleBeat): Point =>
  Object.freeze({
    x: sale.direction === -1 ? -1.35 : 1.35,
    z: STAND_WORLD_Z + 1.78,
  });

const approachPath = (
  sale: SaleBeat,
  streetZ: number,
): readonly Point[] => {
  const service = servicePoint(sale);
  const entry = Object.freeze({
    x: service.x + (sale.direction === -1 ? -0.36 : 0.36),
    z: streetZ,
  });
  const durationSeconds =
    Math.max(1, sale.purchaseAtMs - sale.approachAtMs) / 1_000;
  const serviceLeg = distance(entry, service);
  const sidewalkLeg = Math.max(
    0.45,
    BUYER_WALK_SPEED * durationSeconds - serviceLeg,
  );
  const start = Object.freeze({
    x:
      entry.x +
      (sale.direction === -1 ? -sidewalkLeg : sidewalkLeg),
    z: streetZ,
  });
  return Object.freeze([start, entry, service]);
};

const departurePath = (
  sale: SaleBeat,
  streetZ: number,
): readonly Point[] => {
  const drink = drinkPoint(sale);
  const sidewalkJoin = Object.freeze({ x: drink.x, z: streetZ });
  const durationSeconds =
    Math.max(1, sale.departAtMs - sale.drinkEndAtMs) / 1_000;
  const accessLeg = distance(drink, sidewalkJoin);
  const sidewalkLeg = Math.max(
    0.45,
    BUYER_WALK_SPEED * durationSeconds - accessLeg,
  );
  const end = Object.freeze({
    x:
      sidewalkJoin.x +
      (sale.direction === -1 ? sidewalkLeg : -sidewalkLeg),
    z: streetZ,
  });
  return Object.freeze([drink, sidewalkJoin, end]);
};

const easedUnit = (value: number): number => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
};

export const buyerMotionAt = (
  sale: SaleBeat,
  elapsedMs: number,
  streetZ: number,
): BuyerMotionPose | undefined => {
  const phase = buyerPhaseAt(sale, elapsedMs);
  if (phase === "inactive") return undefined;

  const approach = approachPath(sale, streetZ);
  const approachLength = pathLength(approach);
  const service = servicePoint(sale);
  const drink = drinkPoint(sale);

  if (phase === "approaching") {
    const duration = Math.max(1, sale.purchaseAtMs - sale.approachAtMs);
    const progress = Math.max(
      0,
      Math.min(1, (elapsedMs - sale.approachAtMs) / duration),
    );
    const sampled = samplePath(approach, approachLength * progress);
    return Object.freeze({
      phase,
      x: sampled.point.x,
      z: sampled.point.z,
      heading: sampled.heading,
      travelDistance: approachLength * progress,
    });
  }

  if (phase === "purchasing") {
    return Object.freeze({
      phase,
      x: service.x,
      z: service.z,
      heading: sale.direction === -1 ? -0.22 : 0.22,
      travelDistance: approachLength,
    });
  }

  if (phase === "drinking") {
    const duration = Math.max(1, sale.drinkEndAtMs - sale.purchaseEndAtMs);
    const progress = easedUnit(
      (elapsedMs - sale.purchaseEndAtMs) / duration,
    );
    return Object.freeze({
      phase,
      x: service.x + (drink.x - service.x) * progress,
      z: service.z + (drink.z - service.z) * progress,
      heading: sale.direction === -1 ? -0.22 : 0.22,
      travelDistance: approachLength,
    });
  }

  const departure = departurePath(sale, streetZ);
  const departureLength = pathLength(departure);
  const duration = Math.max(1, sale.departAtMs - sale.drinkEndAtMs);
  const progress = Math.max(
    0,
    Math.min(1, (elapsedMs - sale.drinkEndAtMs) / duration),
  );
  const sampled = samplePath(departure, departureLength * progress);
  return Object.freeze({
    phase,
    x: sampled.point.x,
    z: sampled.point.z,
    heading: sampled.heading,
    travelDistance: approachLength + departureLength * progress,
  });
};
