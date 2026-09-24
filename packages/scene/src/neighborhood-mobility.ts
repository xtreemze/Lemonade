import {
  advanceMobilityClock,
  createMobilityClock,
  type MobilityClockState,
} from "./mobility-clock.js";
import {
  generateResidentialLayout,
  type ResidentialLayout,
  type ResidentialPoint,
  type ResidentialPropertySpec,
  residentialAccessLayout,
  residentialFootprintIntersectsHardscape,
} from "./residential-layout.js";
import {
  type GeneratedStreetNetwork,
  generateStreetNetwork,
  STREET_LAYOUT,
  type StreetStripSpec,
} from "./street-layout.js";

export type MobilityWeather = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";
export type MobilityPhase = "idle" | "forecast" | "simulation";
export type MobilityDetail = "full" | "reduced" | "statistical";
export type MobilityActorKind =
  | "resident"
  | "pet"
  | "bicycle"
  | "vehicle"
  | "mail-carrier"
  | "gardener";
export type MobilityInteraction =
  | "none"
  | "crossing"
  | "door"
  | "mailbox"
  | "gardening"
  | "parking"
  | "traffic";

export type MobilityPose = Readonly<{
  id: string;
  kind: MobilityActorKind;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  travelDistance: number | null;
  visible: boolean;
  waiting: boolean;
  detail: MobilityDetail;
  interaction: MobilityInteraction;
  propertyRole: string | null;
}>;

export type PropertyActivity = Readonly<{
  propertyRole: string;
  doorOpen: boolean;
  windowActivity: boolean;
  sprinklerOn: boolean;
  vehicleParked: boolean;
  mailServiced: boolean;
  gardenerPresent: boolean;
}>;

export type NeighborhoodMobilitySample = Readonly<{
  actors: readonly MobilityPose[];
  properties: readonly PropertyActivity[];
  statisticalCounts: Readonly<Record<MobilityActorKind, number>>;
}>;

export type NeighborhoodMobilitySampleInput = Readonly<{
  weather: MobilityWeather;
  phase: MobilityPhase;
  elapsedMs: number;
  durationMs: number;
  dayNumber: number;
  focus?: ResidentialPoint;
  pedestrianObstacles?: readonly ResidentialPoint[];
}>;

export type NeighborhoodMobilitySystem = Readonly<{
  seed: number;
  sample: (input: NeighborhoodMobilitySampleInput) => NeighborhoodMobilitySample;
}>;

type Route = Readonly<{
  id: string;
  points: readonly ResidentialPoint[];
  cumulative: readonly number[];
  total: number;
}>;

type RouteConflict = Readonly<{
  routeId: string;
  point: ResidentialPoint;
}>;

type TrafficClockRecord = Readonly<{
  clock: MobilityClockState;
  lastElapsedMs: number;
  completedAtMs?: number | null;
}>;

const fract = (value: number): number => value - Math.floor(value);
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const NORMAL_PEDESTRIAN_SPEED = 1.42;

const deterministicUnit = (seed: number, salt: number): number => {
  let value = (seed ^ Math.imul((salt + 1) >>> 0, 0x9e_37_79_b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21_f0_aa_ad);
  value = Math.imul(value ^ (value >>> 15), 0x73_5a_2d_97);
  return ((value ^ (value >>> 15)) >>> 0) / 0xff_ff_ff_ff;
};

const pointDistance = (left: ResidentialPoint, right: ResidentialPoint): number =>
  Math.hypot(right.x - left.x, right.z - left.z);

const makeRoute = (id: string, points: readonly ResidentialPoint[]): Route => {
  const safePoints =
    points.length >= 2
      ? points
      : Object.freeze([Object.freeze({ x: 0, z: 0 }), Object.freeze({ x: 0.001, z: 0 })]);
  const cumulative: number[] = [0];
  let total = 0;
  for (let index = 1; index < safePoints.length; index += 1) {
    const previous = safePoints[index - 1];
    const current = safePoints[index];
    if (previous === undefined || current === undefined) {
      continue;
    }
    total += pointDistance(previous, current);
    cumulative.push(total);
  }
  return Object.freeze({
    id,
    points: Object.freeze([...safePoints]),
    cumulative: Object.freeze(cumulative),
    total: Math.max(0.001, total),
  });
};

const segmentEndpoint = (strip: StreetStripSpec, direction: -1 | 1): ResidentialPoint => {
  const half = strip.length / 2;
  return Object.freeze({
    x: strip.x + Math.cos(strip.rotationY) * half * direction,
    z: strip.z + Math.sin(strip.rotationY) * half * direction,
  });
};

const routeForStreet = (network: GeneratedStreetNetwork, streetId: string): Route => {
  const strips = network.roads
    .filter((strip) => strip.streetId === streetId)
    .sort((left, right) => left.segmentIndex - right.segmentIndex);
  const first = strips[0];
  if (first === undefined) {
    return makeRoute(streetId, [
      { x: -1, z: STREET_LAYOUT.road.centerZ },
      { x: 1, z: STREET_LAYOUT.road.centerZ },
    ]);
  }

  const points: ResidentialPoint[] = [segmentEndpoint(first, -1)];
  for (const strip of strips) {
    points.push(segmentEndpoint(strip, 1));
  }
  return makeRoute(streetId, points);
};

const reverseRoute = (route: Route, suffix: string): Route =>
  makeRoute(route.id + suffix, [...route.points].reverse());

const sampleRouteDistance = (
  route: Route,
  distance: number,
): Readonly<{ point: ResidentialPoint; yaw: number }> => {
  const bounded = Math.min(route.total, Math.max(0, distance));
  for (let index = 1; index < route.cumulative.length; index += 1) {
    const endDistance = route.cumulative[index];
    const startDistance = route.cumulative[index - 1];
    const start = route.points[index - 1];
    const end = route.points[index];
    if (
      endDistance === undefined ||
      startDistance === undefined ||
      start === undefined ||
      end === undefined ||
      bounded > endDistance
    ) {
      continue;
    }
    const segmentLength = Math.max(0.001, endDistance - startDistance);
    const progress = clamp01((bounded - startDistance) / segmentLength);
    return Object.freeze({
      point: Object.freeze({
        x: start.x + (end.x - start.x) * progress,
        z: start.z + (end.z - start.z) * progress,
      }),
      yaw: Math.atan2(end.z - start.z, end.x - start.x),
    });
  }

  const end = route.points.at(-1) ?? { x: 0, z: 0 };
  const previous = route.points.at(-2) ?? end;
  return Object.freeze({
    point: end,
    yaw: Math.atan2(end.z - previous.z, end.x - previous.x),
  });
};

const sampleRouteProgress = (
  route: Route,
  progress: number,
): Readonly<{ point: ResidentialPoint; yaw: number; distance: number }> => {
  const distance = clamp01(progress) * route.total;
  const sampled = sampleRouteDistance(route, distance);
  return Object.freeze({ ...sampled, distance });
};

const orientation = (
  from: ResidentialPoint,
  to: ResidentialPoint,
  point: ResidentialPoint,
): number => (to.z - from.z) * (point.x - to.x) - (to.x - from.x) * (point.z - to.z);

const segmentsIntersect = (
  a1: ResidentialPoint,
  a2: ResidentialPoint,
  b1: ResidentialPoint,
  b2: ResidentialPoint,
): boolean => {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  return o1 * o2 < 0 && o3 * o4 < 0;
};

const lineIntersection = (
  a1: ResidentialPoint,
  a2: ResidentialPoint,
  b1: ResidentialPoint,
  b2: ResidentialPoint,
): ResidentialPoint | null => {
  if (!segmentsIntersect(a1, a2, b1, b2)) {
    return null;
  }
  const denominator = (a1.x - a2.x) * (b1.z - b2.z) - (a1.z - a2.z) * (b1.x - b2.x);
  if (Math.abs(denominator) < 0.000_01) {
    return null;
  }
  const left = a1.x * a2.z - a1.z * a2.x;
  const right = b1.x * b2.z - b1.z * b2.x;
  return Object.freeze({
    x: (left * (b1.x - b2.x) - (a1.x - a2.x) * right) / denominator,
    z: (left * (b1.z - b2.z) - (a1.z - a2.z) * right) / denominator,
  });
};

const routeIntersections = (routes: readonly Route[]): readonly RouteConflict[] => {
  const conflicts: RouteConflict[] = [];
  for (let leftIndex = 0; leftIndex < routes.length; leftIndex += 1) {
    const left = routes[leftIndex];
    if (left === undefined) {
      continue;
    }
    for (let rightIndex = leftIndex + 1; rightIndex < routes.length; rightIndex += 1) {
      const right = routes[rightIndex];
      if (right === undefined) {
        continue;
      }
      for (let a = 1; a < left.points.length; a += 1) {
        const a1 = left.points[a - 1];
        const a2 = left.points[a];
        if (a1 === undefined || a2 === undefined) {
          continue;
        }
        for (let b = 1; b < right.points.length; b += 1) {
          const b1 = right.points[b - 1];
          const b2 = right.points[b];
          if (b1 === undefined || b2 === undefined) {
            continue;
          }
          const point = lineIntersection(a1, a2, b1, b2);
          if (point === null) {
            continue;
          }
          conflicts.push(
            Object.freeze({ routeId: left.id, point }),
            Object.freeze({ routeId: right.id, point }),
          );
        }
      }
    }
  }
  return Object.freeze(conflicts);
};

export const mobilityDetailForDistance = (distance: number): MobilityDetail => {
  if (!Number.isFinite(distance)) {
    return "statistical";
  }
  const safe = Math.max(0, distance);
  if (safe <= 28) {
    return "full";
  }
  if (safe <= 72) {
    return "reduced";
  }
  return "statistical";
};

const detailForPoint = (point: ResidentialPoint, focus: ResidentialPoint): MobilityDetail =>
  mobilityDetailForDistance(pointDistance(point, focus));

const hasDrivewayX = (
  property: ResidentialPropertySpec | undefined,
): property is ResidentialPropertySpec & { drivewayX: number } =>
  property?.drivewayX !== undefined && property.drivewayX !== null;

const allProperties = (layout: ResidentialLayout): readonly ResidentialPropertySpec[] =>
  Object.freeze([
    ...layout.frontProperties,
    ...layout.middleProperties,
    ...layout.backProperties,
    ...layout.outerProperties,
  ]);

// Single source of truth for which property indices get a rendered
// sprinkler: neighborhood.ts's placement loop and this module's activity
// sampling both call this so "sprinklerOn" can never be true for a property
// that has no sprinkler mesh in the scene (every third property, skipping
// any whose sprinkler position would land on hardscape).
export const sprinklerEligibleAt = (
  index: number,
  property: ResidentialPropertySpec,
  layout: ResidentialLayout,
  seed: number,
): boolean => {
  if (index % 3 !== 0) {
    return false;
  }
  const access = residentialAccessLayout(property, seed);
  const lateral = index % 2 === 0 ? 2.15 : -2.15;
  const x = property.houseX + lateral;
  const z = access.pathCenterZ;
  return !residentialFootprintIntersectsHardscape({ x, z }, layout, 0.28, 0.28);
};

const propertyDoorPoint = (property: ResidentialPropertySpec, seed: number): ResidentialPoint => {
  const access = residentialAccessLayout(property, seed);
  return Object.freeze({
    x: access.doorX,
    z: access.doorZ,
  });
};

const propertySidewalkPoint = (
  property: ResidentialPropertySpec,
  seed: number,
): ResidentialPoint => {
  const access = residentialAccessLayout(property, seed);
  return Object.freeze({
    x: access.sidewalkX,
    z: access.sidewalkCenterZ,
  });
};

const residentRoute = (
  property: ResidentialPropertySpec,
  direction: -1 | 1,
  seed: number,
): Route => {
  const door = propertyDoorPoint(property, seed);
  const path = residentialAccessLayout(property, seed);
  const sidewalk = propertySidewalkPoint(property, seed);
  return makeRoute(`resident:${property.role}`, [
    door,
    { x: path.entryX, z: path.entryZ },
    { x: path.pathCenterX, z: path.pathCenterZ },
    sidewalk,
    { x: sidewalk.x + direction * 12, z: sidewalk.z },
  ]);
};

const residentRoundTripRoute = (route: Route): Route =>
  makeRoute(`${route.id}:round-trip`, [...route.points, ...[...route.points].reverse().slice(1)]);

const pedestrianRoutePose = (
  id: string,
  route: Route,
  elapsedMs: number,
  startAtMs: number,
  desiredSpeed: number,
  maxAcceleration: number,
  clocks: Map<string, TrafficClockRecord>,
): Readonly<{
  point: ResidentialPoint;
  yaw: number;
  speed: number;
  travelDistance: number;
  visible: boolean;
  inside: boolean;
  doorOpen: boolean;
  completedAtMs: number | null;
}> => {
  let record = clocks.get(id);
  if (
    record === undefined ||
    elapsedMs < record.lastElapsedMs ||
    Math.abs(record.clock.routeLength - route.total) > 0.001
  ) {
    record = Object.freeze({
      clock: createMobilityClock({
        routeLength: route.total,
        maxAcceleration,
      }),
      lastElapsedMs: 0,
      completedAtMs: null,
    });
  }

  let clock = record.clock;
  let cursorMs = record.lastElapsedMs;
  let completedAtMs = record.completedAtMs ?? null;
  const targetElapsedMs = Math.max(cursorMs, elapsedMs);
  while (cursorMs < targetElapsedMs && clock.lifecycle === "active") {
    if (cursorMs < startAtMs) {
      const deltaMs = Math.min(50, targetElapsedMs - cursorMs, startAtMs - cursorMs);
      clock = advanceMobilityClock(clock, {
        deltaMs,
        desiredSpeed,
        motion: "dwell",
      });
      cursorMs += deltaMs;
      continue;
    }

    const deltaMs = Math.min(50, targetElapsedMs - cursorMs);
    const wasActive = clock.lifecycle === "active";
    clock = advanceMobilityClock(clock, {
      deltaMs,
      desiredSpeed,
      motion: "move",
    });
    cursorMs += deltaMs;
    if (wasActive && clock.lifecycle === "completed" && completedAtMs === null) {
      completedAtMs = cursorMs;
    }
  }

  clocks.set(
    id,
    Object.freeze({
      clock,
      lastElapsedMs: targetElapsedMs,
      completedAtMs,
    }),
  );

  const sampled = sampleRouteDistance(route, clock.distance);
  const visible = elapsedMs >= startAtMs && clock.lifecycle === "active";
  const inside = !visible;
  const doorDistance = Math.min(clock.distance, Math.max(0, route.total - clock.distance));
  return Object.freeze({
    point: sampled.point,
    yaw: sampled.yaw,
    speed: visible ? clock.velocity : 0,
    travelDistance: clock.travelDistance,
    visible,
    inside,
    doorOpen: visible && doorDistance <= 0.9,
    completedAtMs,
  });
};

const drivewayVehicleRoutePose = (
  id: string,
  route: Route,
  elapsedMs: number,
  startAtMs: number,
  desiredSpeed: number,
  crossingDistance: number,
  crossingOccupied: boolean,
  clocks: Map<string, TrafficClockRecord>,
  initialVelocity: number,
): Readonly<{
  point: ResidentialPoint;
  yaw: number;
  speed: number;
  travelDistance: number;
  completedAtMs: number | null;
  started: boolean;
  completed: boolean;
  yielding: boolean;
  waiting: boolean;
}> => {
  let record = clocks.get(id);
  if (
    record === undefined ||
    elapsedMs < record.lastElapsedMs ||
    Math.abs(record.clock.routeLength - route.total) > 0.001
  ) {
    record = Object.freeze({
      clock: createMobilityClock({
        routeLength: route.total,
        maxAcceleration: 4,
        initialVelocity,
      }),
      lastElapsedMs: 0,
      completedAtMs: null,
    });
  }

  let clock = record.clock;
  let cursorMs = record.lastElapsedMs;
  let completedAtMs = record.completedAtMs ?? null;
  const targetElapsedMs = Math.max(cursorMs, elapsedMs);
  const brakingDistance = (desiredSpeed * desiredSpeed) / (2 * 4) + 0.75;
  const yieldStart = Math.max(0, crossingDistance - brakingDistance);
  const yieldEnd = Math.min(route.total, crossingDistance + 0.15);

  while (cursorMs < targetElapsedMs && clock.lifecycle === "active") {
    if (cursorMs < startAtMs) {
      cursorMs += Math.min(50, targetElapsedMs - cursorMs, startAtMs - cursorMs);
      continue;
    }

    const deltaMs = Math.min(50, targetElapsedMs - cursorMs);
    const yielding = crossingOccupied && clock.distance >= yieldStart && clock.distance <= yieldEnd;
    const wasActive = clock.lifecycle === "active";
    clock = advanceMobilityClock(clock, {
      deltaMs,
      desiredSpeed,
      motion: yielding ? "yield" : "move",
    });
    cursorMs += deltaMs;
    if (wasActive && clock.lifecycle === "completed" && completedAtMs === null) {
      completedAtMs = cursorMs;
    }
  }

  clocks.set(
    id,
    Object.freeze({
      clock,
      lastElapsedMs: targetElapsedMs,
      completedAtMs,
    }),
  );

  const sampled = sampleRouteDistance(route, clock.distance);
  const yielding =
    crossingOccupied &&
    clock.lifecycle === "active" &&
    clock.distance >= yieldStart &&
    clock.distance <= yieldEnd;

  return Object.freeze({
    point: sampled.point,
    yaw: sampled.yaw,
    speed: clock.velocity,
    travelDistance: clock.travelDistance,
    completedAtMs,
    started: elapsedMs >= startAtMs,
    completed: clock.lifecycle === "completed",
    yielding,
    waiting: yielding && clock.velocity <= 0.05,
  });
};

const emptyCounts = (): Record<MobilityActorKind, number> => ({
  resident: 0,
  pet: 0,
  bicycle: 0,
  vehicle: 0,
  "mail-carrier": 0,
  gardener: 0,
});

const addStatistical = (counts: Record<MobilityActorKind, number>, actor: MobilityPose): void => {
  if (actor.detail === "statistical") {
    counts[actor.kind] += 1;
  }
};

const makePose = (
  id: string,
  kind: MobilityActorKind,
  point: ResidentialPoint,
  yaw: number,
  speed: number,
  focus: ResidentialPoint,
  interaction: MobilityInteraction = "none",
  propertyRole: string | null = null,
  waiting = false,
  visible = true,
  travelDistance: number | null = null,
): MobilityPose => {
  const detail = detailForPoint(point, focus);
  return Object.freeze({
    id,
    kind,
    x: point.x,
    z: point.z,
    yaw,
    speed: waiting ? 0 : speed,
    travelDistance,
    visible: visible && detail !== "statistical",
    waiting,
    detail,
    interaction,
    propertyRole,
  });
};

const nearestConflict = (
  conflicts: readonly RouteConflict[],
  routeId: string,
  point: ResidentialPoint,
): RouteConflict | null => {
  let result: RouteConflict | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const conflict of conflicts) {
    if (conflict.routeId !== routeId) {
      continue;
    }
    const candidate = pointDistance(conflict.point, point);
    if (candidate < distance) {
      distance = candidate;
      result = conflict;
    }
  }
  return distance <= 12 ? result : null;
};

const hasPedestrianPriority = (
  conflict: RouteConflict,
  pedestrians: readonly ResidentialPoint[],
): boolean => pedestrians.some((point) => pointDistance(point, conflict.point) <= 2.8);

const trafficPose = (
  id: string,
  kind: "vehicle" | "bicycle",
  route: Route,
  elapsedMs: number,
  durationMs: number,
  offset: number,
  laps: number,
  focus: ResidentialPoint,
  conflicts: readonly RouteConflict[],
  pedestrians: readonly ResidentialPoint[],
  trafficActors: readonly MobilityPose[],
  clocks: Map<string, TrafficClockRecord>,
): MobilityPose => {
  const routeId = route.id.replace(/:reverse$/, "");
  const maxSpeed = kind === "vehicle" ? 7.8 : 4.2;
  const durationSeconds = Math.max(0.001, durationMs / 1000);
  const travelFraction = Math.min(0.9, Math.max(0.16, laps));
  const desiredSpeed = Math.min(maxSpeed, (route.total * travelFraction) / durationSeconds);
  const initialDistance = fract(offset) * Math.max(0, route.total - 0.5);
  const maxAcceleration = kind === "vehicle" ? 4 : 3.2;

  let record = clocks.get(id);
  if (
    record === undefined ||
    elapsedMs < record.lastElapsedMs ||
    Math.abs(record.clock.routeLength - route.total) > 0.001
  ) {
    record = Object.freeze({
      clock: createMobilityClock({
        routeLength: route.total,
        maxAcceleration,
        initialDistance,
        initialVelocity: desiredSpeed,
      }),
      lastElapsedMs: 0,
    });
  }

  const waitReasonAt = (point: ResidentialPoint, yaw: number): "crossing" | "traffic" | "none" => {
    const conflict = nearestConflict(conflicts, routeId, point);
    if (conflict !== null && hasPedestrianPriority(conflict, pedestrians)) {
      return "crossing";
    }

    const tangentX = Math.cos(yaw);
    const tangentZ = Math.sin(yaw);
    const safetyRadius = kind === "vehicle" ? 5.4 : 3.7;
    const trafficBlocker = trafficActors.find((actor) => {
      if (actor.kind !== "vehicle" && actor.kind !== "bicycle") {
        return false;
      }
      const dx = actor.x - point.x;
      const dz = actor.z - point.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= safetyRadius) {
        const ahead = dx * tangentX + dz * tangentZ;
        return ahead >= -0.35;
      }
      if (conflict === null) {
        return false;
      }
      return (
        pointDistance({ x: actor.x, z: actor.z }, conflict.point) <= 4.4 &&
        pointDistance(point, conflict.point) <= 7.5
      );
    });
    return trafficBlocker === undefined ? "none" : "traffic";
  };

  let clock = record.clock;
  let cursorMs = record.lastElapsedMs;
  const targetElapsedMs = Math.max(cursorMs, elapsedMs);
  while (cursorMs < targetElapsedMs && clock.lifecycle === "active") {
    const deltaMs = Math.min(50, targetElapsedMs - cursorMs);
    const current = sampleRouteDistance(route, clock.distance);
    const reason = waitReasonAt(current.point, current.yaw);
    clock = advanceMobilityClock(clock, {
      deltaMs,
      desiredSpeed,
      motion: reason === "none" ? "move" : "yield",
    });
    cursorMs += deltaMs;
  }

  clocks.set(
    id,
    Object.freeze({
      clock,
      lastElapsedMs: targetElapsedMs,
    }),
  );

  const sampled = sampleRouteDistance(route, clock.distance);
  const reason = waitReasonAt(sampled.point, sampled.yaw);
  const waiting = reason !== "none" && clock.velocity <= 0.05;

  return makePose(
    id,
    kind,
    sampled.point,
    sampled.yaw,
    clock.velocity,
    focus,
    reason,
    null,
    waiting,
    clock.lifecycle === "active",
    clock.travelDistance,
  );
};

const mailboxPoints = (
  layout: ResidentialLayout,
): readonly Readonly<{ propertyRole: string; point: ResidentialPoint }>[] =>
  Object.freeze(
    layout.frontProperties
      .filter((property) => property.mailboxX !== null)
      .map((property) =>
        Object.freeze({
          propertyRole: property.role,
          point: Object.freeze({
            x: property.mailboxX ?? property.houseX,
            z: STREET_LAYOUT.nearSidewalk.centerZ,
          }),
        }),
      )
      .sort((left, right) => left.point.x - right.point.x),
  );

const propertyActivityDefaults = (layout: ResidentialLayout): Map<string, PropertyActivity> =>
  new Map(
    allProperties(layout).map((property) => [
      property.role,
      Object.freeze({
        propertyRole: property.role,
        doorOpen: false,
        windowActivity: false,
        sprinklerOn: false,
        vehicleParked: false,
        mailServiced: false,
        gardenerPresent: false,
      }),
    ]),
  );

const patchProperty = (
  map: Map<string, PropertyActivity>,
  propertyRole: string,
  patch: Partial<Omit<PropertyActivity, "propertyRole">>,
): void => {
  const current = map.get(propertyRole);
  if (current === undefined) {
    return;
  }
  map.set(propertyRole, Object.freeze({ ...current, ...patch }));
};

const normalizedDay = (value: number): number =>
  Math.max(1, Number.isFinite(value) ? Math.trunc(value) : 1);

export const createNeighborhoodMobilitySystem = (seed: number): NeighborhoodMobilitySystem => {
  const safeSeed = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
  const layout = generateResidentialLayout(safeSeed);
  const network = generateStreetNetwork(safeSeed);
  const streetIds = [
    "main",
    "front-grid",
    "deep-grid",
    "middle-curve",
    "back-curve",
    "west-curve",
    "east-curve",
  ] as const;
  const routes = streetIds.map((streetId) => routeForStreet(network, streetId));
  const conflicts = routeIntersections(routes);
  const main = routes.find((route) => route.id === "main") ?? routes[0];
  if (main === undefined) {
    throw new Error("mobility system requires a road route");
  }

  const residents = [layout.frontProperties[1], layout.frontProperties[5]].filter(
    (property): property is ResidentialPropertySpec => property !== undefined,
  );
  const residentRoutes = residents.map((property, index) =>
    residentRoundTripRoute(residentRoute(property, index % 2 === 0 ? -1 : 1, safeSeed)),
  );
  const mailboxes = mailboxPoints(layout);
  const gardenerWeekday = Math.floor(deterministicUnit(safeSeed, 901) * 7);
  const gardenerProperty =
    layout.frontProperties[
      Math.floor(deterministicUnit(safeSeed, 907) * layout.frontProperties.length)
    ] ?? layout.frontProperties[0];
  const trafficClocks = new Map<string, TrafficClockRecord>();
  const residentClocks = new Map<string, TrafficClockRecord>();
  const petClocks = new Map<string, TrafficClockRecord>();
  const drivewayClocks = new Map<string, TrafficClockRecord>();
  const driverClocks = new Map<string, TrafficClockRecord>();
  let trafficContextKey: string | null = null;
  let lastTrafficElapsedMs = 0;

  return Object.freeze({
    seed: safeSeed,
    sample(input): NeighborhoodMobilitySample {
      const phase = input.phase;
      const dayNumber = normalizedDay(input.dayNumber);
      const durationMs = Math.max(1, input.durationMs);
      const contextKey = [phase, dayNumber, durationMs].join(":");
      if (contextKey !== trafficContextKey || input.elapsedMs < lastTrafficElapsedMs) {
        trafficClocks.clear();
        residentClocks.clear();
        petClocks.clear();
        drivewayClocks.clear();
        driverClocks.clear();
      }
      trafficContextKey = contextKey;
      lastTrafficElapsedMs = input.elapsedMs;
      const focus = input.focus ?? Object.freeze({ x: 0, z: 0 });
      const actors: MobilityPose[] = [];
      const properties = propertyActivityDefaults(layout);
      const counts = emptyCounts();
      const pedestrianPoints: ResidentialPoint[] = [...(input.pedestrianObstacles ?? [])];
      const trafficActors: MobilityPose[] = [];

      if (phase === "simulation") {
        residentRoutes.forEach((route, index) => {
          const property = residents[index];
          if (property === undefined) {
            return;
          }
          const residentId = `resident:${String(index)}`;
          const startAtMs =
            durationMs * (0.04 + index * 0.12 + deterministicUnit(safeSeed, 1000 + index) * 0.03);
          const state = pedestrianRoutePose(
            residentId,
            route,
            input.elapsedMs,
            startAtMs,
            NORMAL_PEDESTRIAN_SPEED,
            3.2,
            residentClocks,
          );
          patchProperty(properties, property.role, {
            doorOpen: state.doorOpen,
            windowActivity: state.inside,
          });
          const resident = makePose(
            residentId,
            "resident",
            state.point,
            state.yaw,
            state.speed,
            focus,
            state.doorOpen ? "door" : "none",
            property.role,
            false,
            state.visible,
            state.travelDistance,
          );
          actors.push(resident);
          if (state.visible) {
            pedestrianPoints.push(state.point);
          }
          addStatistical(counts, resident);

          if (index === 0) {
            const petState = pedestrianRoutePose(
              "resident-pet",
              route,
              input.elapsedMs,
              startAtMs + 350,
              1.35,
              3.2,
              petClocks,
            );
            patchProperty(properties, property.role, {
              doorOpen: state.doorOpen || petState.doorOpen,
            });
            const pet = makePose(
              "resident-pet",
              "pet",
              petState.point,
              petState.yaw,
              petState.speed,
              focus,
              petState.doorOpen ? "door" : "none",
              property.role,
              false,
              petState.visible,
              petState.travelDistance,
            );
            actors.push(pet);
            if (petState.visible) {
              pedestrianPoints.push(petState.point);
            }
            addStatistical(counts, pet);
          }
        });

        const mainConflicts = conflicts.filter((conflict) => conflict.routeId === "main");
        const crossing = mainConflicts[0];
        if (crossing !== undefined) {
          const t = clamp01(input.elapsedMs / durationMs);
          const active = t >= 0.28 && t <= 0.52;
          const crossingProgress = clamp01((t - 0.28) / 0.24);
          const crossingPoint = Object.freeze({
            x: crossing.point.x,
            z:
              STREET_LAYOUT.nearSidewalk.centerZ +
              (STREET_LAYOUT.farSidewalk.centerZ - STREET_LAYOUT.nearSidewalk.centerZ) *
                crossingProgress,
          });
          const crossingActor = makePose(
            "resident-crossing",
            "resident",
            crossingPoint,
            Math.PI / 2,
            1.32,
            focus,
            "crossing",
            null,
            false,
            active,
          );
          actors.push(crossingActor);
          if (active) {
            pedestrianPoints.push(crossingPoint);
          }
          addStatistical(counts, crossingActor);
        }

        const drivewayProperty =
          layout.frontProperties.find(
            (property) => property.drivewayX !== null && property.role === "east-mid",
          ) ?? layout.frontProperties.find((property) => property.drivewayX !== null);
        if (drivewayProperty?.drivewayX !== null && drivewayProperty !== undefined) {
          const access = residentialAccessLayout(drivewayProperty, safeSeed);
          const roadPoint = Object.freeze({
            x: access.roadX,
            z: access.roadCenterZ,
          });
          const parkPoint = Object.freeze({
            x: drivewayProperty.drivewayX,
            z: access.parkingZ,
          });
          const sidewalkCrossingPoint = Object.freeze({
            x: access.drivewaySidewalkX,
            z: access.drivewaySidewalkZ,
          });
          const roadStart = Object.freeze({
            x: roadPoint.x - 26,
            z: roadPoint.z,
          });
          const roadEnd = Object.freeze({
            x: roadPoint.x + 30,
            z: roadPoint.z,
          });
          const crossingOccupied = pedestrianPoints.some(
            (point) => pointDistance(point, sidewalkCrossingPoint) <= 2.8,
          );

          const ingressRoute = makeRoute("resident-vehicle:ingress", [
            roadStart,
            roadPoint,
            sidewalkCrossingPoint,
            parkPoint,
          ]);
          const ingressCrossingDistance = ingressRoute.cumulative[2] ?? ingressRoute.total;
          const ingress = drivewayVehicleRoutePose(
            "resident-vehicle:ingress",
            ingressRoute,
            input.elapsedMs,
            0,
            7.8,
            ingressCrossingDistance,
            crossingOccupied,
            drivewayClocks,
            7.8,
          );

          const driverRoute = makeRoute("resident-driver:enter", [
            parkPoint,
            Object.freeze({
              x: access.entryX,
              z: access.entryZ,
            }),
            propertyDoorPoint(drivewayProperty, safeSeed),
          ]);
          const driverReturnRoute = reverseRoute(driverRoute, ":return");
          const driverEnterStartAtMs = ingress.completedAtMs ?? Number.POSITIVE_INFINITY;
          const driverEnter = pedestrianRoutePose(
            "resident-driver:enter",
            driverRoute,
            input.elapsedMs,
            driverEnterStartAtMs,
            NORMAL_PEDESTRIAN_SPEED,
            3.2,
            driverClocks,
          );
          const driverExitStartAtMs =
            driverEnter.completedAtMs === null
              ? Number.POSITIVE_INFINITY
              : Math.max(durationMs * 0.64, driverEnter.completedAtMs + 500);
          const driverExit = pedestrianRoutePose(
            "resident-driver:exit",
            driverReturnRoute,
            input.elapsedMs,
            driverExitStartAtMs,
            NORMAL_PEDESTRIAN_SPEED,
            3.2,
            driverClocks,
          );

          const egressStartAtMs =
            driverExit.completedAtMs === null
              ? Number.POSITIVE_INFINITY
              : Math.max(durationMs * 0.72, driverExit.completedAtMs);
          const egressRoute = makeRoute("resident-vehicle:egress", [
            parkPoint,
            sidewalkCrossingPoint,
            roadPoint,
            roadEnd,
          ]);
          const egressCrossingDistance = egressRoute.cumulative[1] ?? egressRoute.total;
          const egress = drivewayVehicleRoutePose(
            "resident-vehicle:egress",
            egressRoute,
            input.elapsedMs,
            egressStartAtMs,
            7.8,
            egressCrossingDistance,
            crossingOccupied,
            drivewayClocks,
            0,
          );

          const vehicleDeparting = egress.started;
          const vehicleCompleted = vehicleDeparting && egress.completed;
          const vehicleParked = ingress.completed && !vehicleDeparting;
          const activeVehicleState = vehicleDeparting ? egress : ingress;
          const vehicleTravelDistance = ingress.travelDistance + egress.travelDistance;
          const drivewayVehicle = makePose(
            "resident-vehicle",
            "vehicle",
            vehicleParked ? parkPoint : activeVehicleState.point,
            vehicleParked ? ingress.yaw : activeVehicleState.yaw,
            vehicleParked ? 0 : activeVehicleState.speed,
            focus,
            vehicleParked ? "parking" : activeVehicleState.yielding ? "crossing" : "none",
            drivewayProperty.role,
            !vehicleParked && activeVehicleState.waiting,
            !vehicleCompleted,
            vehicleTravelDistance,
          );
          actors.push(drivewayVehicle);
          if (!vehicleCompleted) {
            trafficActors.push(drivewayVehicle);
          }
          addStatistical(counts, drivewayVehicle);

          const driverEntering = driverEnter.visible;
          const driverLeaving = driverExit.visible;
          const driverMovement = driverEntering || driverLeaving;
          const activeDriver = driverLeaving ? driverExit : driverEnter;
          const driverTravelDistance = driverEnter.travelDistance + driverExit.travelDistance;
          const driverDoorPoint = propertyDoorPoint(drivewayProperty, safeSeed);
          const driverNearDoor =
            driverMovement && pointDistance(activeDriver.point, driverDoorPoint) <= 0.9;
          const driverInside =
            driverEnter.completedAtMs !== null &&
            input.elapsedMs >= driverEnter.completedAtMs &&
            input.elapsedMs < driverExitStartAtMs;
          patchProperty(properties, drivewayProperty.role, {
            vehicleParked,
            doorOpen: driverNearDoor,
            windowActivity: driverInside,
          });

          const residentDriver = makePose(
            "resident-driver",
            "resident",
            activeDriver.point,
            activeDriver.yaw,
            activeDriver.speed,
            focus,
            "door",
            drivewayProperty.role,
            false,
            driverMovement,
            driverTravelDistance,
          );
          actors.push(residentDriver);
          if (driverMovement) {
            pedestrianPoints.push(activeDriver.point);
          }
          addStatistical(counts, residentDriver);
        }

        routes.forEach((route, index) => {
          for (let vehicleNum = 0; vehicleNum < 2; vehicleNum += 1) {
            const directed = index % 2 === 0 ? route : reverseRoute(route, ":reverse");
            const vehicle = trafficPose(
              `traffic-vehicle:${route.id}:v${String(vehicleNum)}`,
              "vehicle",
              directed,
              input.elapsedMs,
              durationMs,
              index * 0.23 +
                vehicleNum * 0.5 +
                deterministicUnit(safeSeed, 1100 + index + vehicleNum) * 0.2,
              0.54 + index * 0.07 + vehicleNum * 0.03,
              focus,
              conflicts,
              pedestrianPoints,
              trafficActors,
              trafficClocks,
            );
            actors.push(vehicle);
            trafficActors.push(vehicle);
            addStatistical(counts, vehicle);
          }
        });

        [
          main,
          routes.find((route) => route.id === "front-grid") ?? main,
          routes.find((route) => route.id === "deep-grid") ?? main,
        ].forEach((route, index) => {
          const directed = index % 2 === 0 ? reverseRoute(route, ":reverse") : route;
          const bicycle = trafficPose(
            `traffic-bicycle:${route.id}`,
            "bicycle",
            directed,
            input.elapsedMs,
            durationMs,
            0.31 + index * 0.29,
            0.86 + index * 0.11,
            focus,
            conflicts,
            pedestrianPoints,
            trafficActors,
            trafficClocks,
          );
          actors.push(bicycle);
          trafficActors.push(bicycle);
          addStatistical(counts, bicycle);
        });
      }

      if (phase === "forecast") {
        const morning = clamp01(input.elapsedMs / durationMs);
        const routeStart = -96;
        const routeEnd = 96;
        const x = routeStart + (routeEnd - routeStart) * morning;
        const nearestMailbox = mailboxes.reduce<(typeof mailboxes)[number] | null>(
          (best, candidate) => {
            if (best === null) {
              return candidate;
            }
            return Math.abs(candidate.point.x - x) < Math.abs(best.point.x - x) ? candidate : best;
          },
          null,
        );
        const mailInteraction =
          nearestMailbox !== null && Math.abs(nearestMailbox.point.x - x) < 1.7;
        const mailPoint = Object.freeze({
          x: mailInteraction ? nearestMailbox.point.x : x,
          z: STREET_LAYOUT.nearSidewalk.centerZ,
        });
        const walkingYaw = -Math.PI / 2;
        const mailboxYaw = nearestMailbox
          ? Math.atan2(nearestMailbox.point.z - mailPoint.z, nearestMailbox.point.x - mailPoint.x)
          : walkingYaw;
        const mailCarrier = makePose(
          "mail-carrier",
          "mail-carrier",
          mailPoint,
          mailInteraction ? mailboxYaw : walkingYaw,
          mailInteraction ? 0 : NORMAL_PEDESTRIAN_SPEED,
          focus,
          mailInteraction ? "mailbox" : "none",
          nearestMailbox?.propertyRole ?? null,
        );
        actors.push(mailCarrier);
        addStatistical(counts, mailCarrier);
        for (const mailbox of mailboxes) {
          if (mailbox.point.x <= x + 1.5) {
            patchProperty(properties, mailbox.propertyRole, {
              mailServiced: true,
            });
          }
        }

        const weekday = (dayNumber - 1) % 7;
        if (gardenerProperty !== undefined && weekday === gardenerWeekday) {
          const access = residentialAccessLayout(gardenerProperty, safeSeed);
          const sidewalk = propertySidewalkPoint(gardenerProperty, safeSeed);
          const garden = Object.freeze({
            x: gardenerProperty.houseX + 1.8,
            z: access.pathCenterZ,
          });
          const gardenerRoute = makeRoute("gardener", [sidewalk, garden]);
          const gardenerProgress =
            morning < 0.28 ? morning / 0.28 : morning < 0.82 ? 1 : 1 - (morning - 0.82) / 0.18;
          const gardenerSample = sampleRouteProgress(gardenerRoute, clamp01(gardenerProgress));
          const gardening = morning >= 0.28 && morning < 0.82;
          patchProperty(properties, gardenerProperty.role, {
            gardenerPresent: gardening,
          });
          const gardener = makePose(
            "gardener",
            "gardener",
            gardenerSample.point,
            gardenerSample.yaw,
            gardening ? 0 : NORMAL_PEDESTRIAN_SPEED,
            focus,
            gardening ? "gardening" : "none",
            gardenerProperty.role,
          );
          actors.push(gardener);
          addStatistical(counts, gardener);
        }

        const allFrontProperties = layout.frontProperties.filter((p) => p.drivewayX !== null);
        const midProperties = layout.middleProperties.filter((p) => p.drivewayX !== null);
        const allDrivewayProperties = [...allFrontProperties, ...midProperties];
        for (let i = 0; i < Math.min(4, allDrivewayProperties.length); i++) {
          const hasVehicle = deterministicUnit(safeSeed ^ dayNumber ^ i, 5000 + i) > 0.35;
          if (!hasVehicle) {
            continue;
          }
          const propertyIndex = Math.floor(
            deterministicUnit(safeSeed ^ dayNumber ^ i, 4000 + i) * allDrivewayProperties.length,
          );
          const property = allDrivewayProperties[propertyIndex];
          if (!hasDrivewayX(property)) {
            continue;
          }
          const access = residentialAccessLayout(property, safeSeed);
          const parkedVehicle = makePose(
            `parked-vehicle-${String(i)}`,
            "vehicle",
            {
              x: property.drivewayX,
              z: access.parkingZ,
            },
            Math.PI / 2,
            0,
            focus,
            "parking",
            property.role,
            true,
          );
          actors.push(parkedVehicle);
          addStatistical(counts, parkedVehicle);
          patchProperty(properties, property.role, {
            vehicleParked: true,
          });
        }

        const sunny = input.weather === "sunny";
        allProperties(layout).forEach((property, index) => {
          const morningOccupied = deterministicUnit(safeSeed ^ dayNumber, 1300 + index) > 0.48;
          const hasSprinkler = sprinklerEligibleAt(index, property, layout, safeSeed);
          const sprinkler =
            hasSprinkler &&
            sunny &&
            (index + dayNumber + (safeSeed & 3)) % 4 === 0 &&
            morning > 0.08 &&
            morning < 0.74;
          patchProperty(properties, property.role, {
            windowActivity: morningOccupied,
            sprinklerOn: sprinkler,
          });
        });
      } else if (phase === "idle") {
        // Night time - show lights in some homes
        allProperties(layout).forEach((property, index) => {
          const nightOccupied = deterministicUnit(safeSeed ^ dayNumber, 2300 + index) > 0.3;
          patchProperty(properties, property.role, {
            windowActivity: nightOccupied,
          });
        });

        // Add parked vehicles during evening/night
        const allFrontProperties = layout.frontProperties.filter((p) => p.drivewayX !== null);
        const midProperties = layout.middleProperties.filter((p) => p.drivewayX !== null);
        const allDrivewayProperties = [...allFrontProperties, ...midProperties];
        for (let i = 0; i < Math.min(6, allDrivewayProperties.length); i++) {
          const hasVehicle = deterministicUnit(safeSeed ^ dayNumber ^ i, 5500 + i) > 0.25;
          if (!hasVehicle) {
            continue;
          }
          const propertyIndex = Math.floor(
            deterministicUnit(safeSeed ^ dayNumber ^ i, 4500 + i) * allDrivewayProperties.length,
          );
          const property = allDrivewayProperties[propertyIndex];
          if (!hasDrivewayX(property)) {
            continue;
          }
          const access = residentialAccessLayout(property, safeSeed);
          const parkedVehicle = makePose(
            `parked-vehicle-night-${String(i)}`,
            "vehicle",
            {
              x: property.drivewayX,
              z: access.parkingZ,
            },
            Math.PI / 2,
            0,
            focus,
            "parking",
            property.role,
            true,
          );
          actors.push(parkedVehicle);
          addStatistical(counts, parkedVehicle);
          patchProperty(properties, property.role, {
            vehicleParked: true,
          });
        }
      }

      return Object.freeze({
        actors: Object.freeze(actors),
        properties: Object.freeze([...properties.values()]),
        statisticalCounts: Object.freeze({ ...counts }),
      });
    },
  });
};
