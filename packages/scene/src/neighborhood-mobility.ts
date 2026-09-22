import {
  generateResidentialLayout,
  residentialAccessLayout,
  type ResidentialLayout,
  type ResidentialPoint,
  type ResidentialPropertySpec,
} from "./residential-layout.js";
import {
  generateStreetNetwork,
  STREET_LAYOUT,
  type GeneratedStreetNetwork,
  type StreetStripSpec,
} from "./street-layout.js";

export type MobilityWeather =
  | "sunny"
  | "cloudy"
  | "hot-and-dry"
  | "thunderstorm";
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
  sample(input: NeighborhoodMobilitySampleInput): NeighborhoodMobilitySample;
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

const fract = (value: number): number => value - Math.floor(value);
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const NORMAL_PEDESTRIAN_SPEED = 1.42;

const deterministicUnit = (seed: number, salt: number): number => {
  let value = (seed ^ Math.imul((salt + 1) >>> 0, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0xffff_ffff;
};

const pointDistance = (left: ResidentialPoint, right: ResidentialPoint): number =>
  Math.hypot(right.x - left.x, right.z - left.z);

const makeRoute = (id: string, points: readonly ResidentialPoint[]): Route => {
  const safePoints =
    points.length >= 2
      ? points
      : Object.freeze([
          Object.freeze({ x: 0, z: 0 }),
          Object.freeze({ x: 0.001, z: 0 }),
        ]);
  const cumulative: number[] = [0];
  let total = 0;
  for (let index = 1; index < safePoints.length; index += 1) {
    const previous = safePoints[index - 1];
    const current = safePoints[index];
    if (previous === undefined || current === undefined) continue;
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

const segmentEndpoint = (
  strip: StreetStripSpec,
  direction: -1 | 1,
): ResidentialPoint => {
  const half = strip.length / 2;
  return Object.freeze({
    x: strip.x + Math.cos(strip.rotationY) * half * direction,
    z: strip.z + Math.sin(strip.rotationY) * half * direction,
  });
};

const routeForStreet = (
  network: GeneratedStreetNetwork,
  streetId: string,
): Route => {
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
  for (const strip of strips) points.push(segmentEndpoint(strip, 1));
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
): number =>
  (to.z - from.z) * (point.x - to.x) -
  (to.x - from.x) * (point.z - to.z);

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
  if (!segmentsIntersect(a1, a2, b1, b2)) return null;
  const denominator =
    (a1.x - a2.x) * (b1.z - b2.z) -
    (a1.z - a2.z) * (b1.x - b2.x);
  if (Math.abs(denominator) < 0.00001) return null;
  const left = a1.x * a2.z - a1.z * a2.x;
  const right = b1.x * b2.z - b1.z * b2.x;
  return Object.freeze({
    x:
      (left * (b1.x - b2.x) - (a1.x - a2.x) * right) /
      denominator,
    z:
      (left * (b1.z - b2.z) - (a1.z - a2.z) * right) /
      denominator,
  });
};

const routeIntersections = (
  routes: readonly Route[],
): readonly RouteConflict[] => {
  const conflicts: RouteConflict[] = [];
  for (let leftIndex = 0; leftIndex < routes.length; leftIndex += 1) {
    const left = routes[leftIndex];
    if (left === undefined) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < routes.length; rightIndex += 1) {
      const right = routes[rightIndex];
      if (right === undefined) continue;
      for (let a = 1; a < left.points.length; a += 1) {
        const a1 = left.points[a - 1];
        const a2 = left.points[a];
        if (a1 === undefined || a2 === undefined) continue;
        for (let b = 1; b < right.points.length; b += 1) {
          const b1 = right.points[b - 1];
          const b2 = right.points[b];
          if (b1 === undefined || b2 === undefined) continue;
          const point = lineIntersection(a1, a2, b1, b2);
          if (point === null) continue;
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
  if (!Number.isFinite(distance)) return "statistical";
  const safe = Math.max(0, distance);
  if (safe <= 28) return "full";
  if (safe <= 72) return "reduced";
  return "statistical";
};

const detailForPoint = (
  point: ResidentialPoint,
  focus: ResidentialPoint,
): MobilityDetail => mobilityDetailForDistance(pointDistance(point, focus));

const allProperties = (layout: ResidentialLayout): readonly ResidentialPropertySpec[] =>
  Object.freeze([
    ...layout.frontProperties,
    ...layout.middleProperties,
    ...layout.backProperties,
    ...layout.outerProperties,
  ]);

const propertyDoorPoint = (
  property: ResidentialPropertySpec,
  seed: number,
): ResidentialPoint => {
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
  return makeRoute("resident:" + property.role, [
    door,
    { x: path.entryX, z: path.entryZ },
    { x: path.pathCenterX, z: path.pathCenterZ },
    sidewalk,
    { x: sidewalk.x + direction * 12, z: sidewalk.z },
  ]);
};

const residentProgress = (
  elapsedMs: number,
  durationMs: number,
  offset: number,
): Readonly<{ routeProgress: number; inside: boolean; doorOpen: boolean }> => {
  const t = clamp01(elapsedMs / Math.max(1, durationMs));
  const shifted = fract(t + offset);
  if (shifted < 0.08) {
    return Object.freeze({ routeProgress: 0, inside: true, doorOpen: false });
  }
  if (shifted < 0.18) {
    return Object.freeze({
      routeProgress: (shifted - 0.08) / 0.1 * 0.1,
      inside: false,
      doorOpen: true,
    });
  }
  if (shifted < 0.5) {
    return Object.freeze({
      routeProgress: 0.1 + (shifted - 0.18) / 0.32 * 0.9,
      inside: false,
      doorOpen: false,
    });
  }
  if (shifted < 0.82) {
    return Object.freeze({
      routeProgress: 1 - (shifted - 0.5) / 0.32 * 0.9,
      inside: false,
      doorOpen: false,
    });
  }
  if (shifted < 0.92) {
    return Object.freeze({
      routeProgress: 0.1 - (shifted - 0.82) / 0.1 * 0.1,
      inside: false,
      doorOpen: true,
    });
  }
  return Object.freeze({ routeProgress: 0, inside: true, doorOpen: false });
};

const emptyCounts = (): Record<MobilityActorKind, number> => ({
  resident: 0,
  pet: 0,
  bicycle: 0,
  vehicle: 0,
  "mail-carrier": 0,
  gardener: 0,
});

const addStatistical = (
  counts: Record<MobilityActorKind, number>,
  actor: MobilityPose,
): void => {
  if (actor.detail === "statistical") counts[actor.kind] += 1;
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
): MobilityPose => {
  const detail = detailForPoint(point, focus);
  return Object.freeze({
    id,
    kind,
    x: point.x,
    z: point.z,
    yaw,
    speed: waiting ? 0 : speed,
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
    if (conflict.routeId !== routeId) continue;
    const candidate = pointDistance(conflict.point, point);
    if (candidate < distance) {
      distance = candidate;
      result = conflict;
    }
  }
  return distance <= 5.2 ? result : null;
};

const hasPedestrianPriority = (
  conflict: RouteConflict,
  pedestrians: readonly ResidentialPoint[],
): boolean =>
  pedestrians.some((point) => pointDistance(point, conflict.point) <= 2.8);

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
): MobilityPose => {
  const progress = fract(
    elapsedMs / Math.max(1, durationMs) * laps + offset,
  );
  const sampled = sampleRouteProgress(route, progress);
  const routeId = route.id.replace(/:reverse$/, "");
  const conflict = nearestConflict(conflicts, routeId, sampled.point);
  const pedestrianWaiting =
    conflict !== null && hasPedestrianPriority(conflict, pedestrians);

  const tangentX = Math.cos(sampled.yaw);
  const tangentZ = Math.sin(sampled.yaw);
  const safetyRadius = kind === "vehicle" ? 5.4 : 3.7;
  const trafficBlocker = trafficActors.find((actor) => {
    if (actor.kind !== "vehicle" && actor.kind !== "bicycle") return false;

    const dx = actor.x - sampled.point.x;
    const dz = actor.z - sampled.point.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= safetyRadius) {
      const ahead = dx * tangentX + dz * tangentZ;
      return ahead >= -0.35;
    }
    if (conflict === null) return false;
    return (
      pointDistance({ x: actor.x, z: actor.z }, conflict.point) <= 4.4 &&
      pointDistance(sampled.point, conflict.point) <= 5.2
    );
  });

  const trafficWaiting = !pedestrianWaiting && trafficBlocker !== undefined;
  const waiting = pedestrianWaiting || trafficWaiting;
  let point = sampled.point;
  if (pedestrianWaiting && conflict !== null) {
    const dx = point.x - conflict.point.x;
    const dz = point.z - conflict.point.z;
    const magnitude = Math.max(0.001, Math.hypot(dx, dz));
    point = Object.freeze({
      x: conflict.point.x + (dx / magnitude) * 3.4,
      z: conflict.point.z + (dz / magnitude) * 3.4,
    });
  } else if (trafficWaiting) {
    point = Object.freeze({
      x: sampled.point.x - tangentX * (kind === "vehicle" ? 2.8 : 1.8),
      z: sampled.point.z - tangentZ * (kind === "vehicle" ? 2.8 : 1.8),
    });
  }

  return makePose(
    id,
    kind,
    point,
    sampled.yaw,
    kind === "vehicle" ? 7.8 : 4.2,
    focus,
    pedestrianWaiting ? "crossing" : trafficWaiting ? "traffic" : "none",
    null,
    waiting,
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

const propertyActivityDefaults = (
  layout: ResidentialLayout,
): Map<string, PropertyActivity> =>
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
  if (current === undefined) return;
  map.set(propertyRole, Object.freeze({ ...current, ...patch }));
};

const normalizedDay = (value: number): number =>
  Math.max(1, Number.isFinite(value) ? Math.trunc(value) : 1);

export const createNeighborhoodMobilitySystem = (
  seed: number,
): NeighborhoodMobilitySystem => {
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
  if (main === undefined) throw new Error("mobility system requires a road route");

  const residents = [
    layout.frontProperties[1],
    layout.frontProperties[5],
  ].filter((property): property is ResidentialPropertySpec => property !== undefined);
  const residentRoutes = residents.map((property, index) =>
    residentRoute(property, index % 2 === 0 ? -1 : 1, safeSeed),
  );
  const mailboxes = mailboxPoints(layout);
  const gardenerWeekday = Math.floor(deterministicUnit(safeSeed, 901) * 7);
  const gardenerProperty =
    layout.frontProperties[
      Math.floor(deterministicUnit(safeSeed, 907) * layout.frontProperties.length)
    ] ?? layout.frontProperties[0];

  return Object.freeze({
    seed: safeSeed,
    sample(input): NeighborhoodMobilitySample {
      const phase = input.phase;
      const dayNumber = normalizedDay(input.dayNumber);
      const durationMs = Math.max(1, input.durationMs);
      const focus = input.focus ?? Object.freeze({ x: 0, z: 0 });
      const actors: MobilityPose[] = [];
      const properties = propertyActivityDefaults(layout);
      const counts = emptyCounts();
      const pedestrianPoints: ResidentialPoint[] = [
        ...(input.pedestrianObstacles ?? []),
      ];
      const trafficActors: MobilityPose[] = [];

      if (phase === "simulation") {
        residentRoutes.forEach((route, index) => {
          const property = residents[index];
          if (property === undefined) return;
          const state = residentProgress(
            input.elapsedMs,
            durationMs,
            index * 0.37 + deterministicUnit(safeSeed, 1000 + index) * 0.08,
          );
          patchProperty(properties, property.role, {
            doorOpen: state.doorOpen,
            windowActivity: state.inside,
          });
          const sampled = sampleRouteProgress(route, state.routeProgress);
          const resident = makePose(
            "resident:" + String(index),
            "resident",
            sampled.point,
            sampled.yaw,
            NORMAL_PEDESTRIAN_SPEED,
            focus,
            state.doorOpen ? "door" : "none",
            property.role,
            false,
            !state.inside,
          );
          actors.push(resident);
          if (!state.inside) pedestrianPoints.push(sampled.point);
          addStatistical(counts, resident);

          if (index === 0) {
            const petPoint = Object.freeze({
              x: sampled.point.x - Math.cos(sampled.yaw) * 0.72,
              z: sampled.point.z - Math.sin(sampled.yaw) * 0.72 + 0.14,
            });
            const pet = makePose(
              "resident-pet",
              "pet",
              petPoint,
              sampled.yaw,
              1.35,
              focus,
              state.doorOpen ? "door" : "none",
              property.role,
              false,
              !state.inside,
            );
            actors.push(pet);
            if (!state.inside) pedestrianPoints.push(petPoint);
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
              (STREET_LAYOUT.farSidewalk.centerZ -
                STREET_LAYOUT.nearSidewalk.centerZ) *
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
          if (active) pedestrianPoints.push(crossingPoint);
          addStatistical(counts, crossingActor);
        }

        const drivewayProperty =
          layout.frontProperties.find(
            (property) => property.drivewayX !== null && property.role === "east-mid",
          ) ??
          layout.frontProperties.find((property) => property.drivewayX !== null);
        if (drivewayProperty?.drivewayX !== null && drivewayProperty !== undefined) {
          const access = residentialAccessLayout(drivewayProperty, safeSeed);
          const t = clamp01(input.elapsedMs / durationMs);
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
          const drivewayDistance = Math.max(
            0.001,
            pointDistance(roadPoint, parkPoint),
          );
          const crossingProgress = clamp01(
            pointDistance(roadPoint, sidewalkCrossingPoint) / drivewayDistance,
          );
          const drivewayYaw = Math.atan2(
            parkPoint.z - roadPoint.z,
            parkPoint.x - roadPoint.x,
          );
          const sampleDriveway = (progress: number): ResidentialPoint =>
            Object.freeze({
              x: roadPoint.x + (parkPoint.x - roadPoint.x) * clamp01(progress),
              z: roadPoint.z + (parkPoint.z - roadPoint.z) * clamp01(progress),
            });
          const crossingOccupied = pedestrianPoints.some(
            (point) => pointDistance(point, sidewalkCrossingPoint) <= 2.8,
          );
          let vehiclePoint = roadPoint;
          let vehicleYaw = 0;
          let parked = false;
          let yieldingAtDriveway = false;
          if (t < 0.28) {
            vehiclePoint = Object.freeze({
              x: roadPoint.x - 26 + 26 * (t / 0.28),
              z: roadPoint.z,
            });
          } else if (t < 0.42) {
            const p = (t - 0.28) / 0.14;
            vehiclePoint = sampleDriveway(p);
            vehicleYaw = drivewayYaw;
            if (
              crossingOccupied &&
              p >= Math.max(0, crossingProgress - 0.18) &&
              p <= Math.min(1, crossingProgress + 0.12)
            ) {
              vehiclePoint = sampleDriveway(
                Math.max(0, crossingProgress - 0.14),
              );
              yieldingAtDriveway = true;
            }
          } else if (t < 0.72) {
            vehiclePoint = parkPoint;
            vehicleYaw = drivewayYaw;
            parked = true;
          } else if (t < 0.84) {
            const p = (t - 0.72) / 0.12;
            const drivewayProgress = 1 - p;
            vehiclePoint = sampleDriveway(drivewayProgress);
            vehicleYaw = drivewayYaw + Math.PI;
            if (
              crossingOccupied &&
              drivewayProgress <= Math.min(1, crossingProgress + 0.18) &&
              drivewayProgress >= Math.max(0, crossingProgress - 0.12)
            ) {
              vehiclePoint = sampleDriveway(
                Math.min(1, crossingProgress + 0.14),
              );
              yieldingAtDriveway = true;
            }
          } else {
            vehiclePoint = Object.freeze({
              x: roadPoint.x + 30 * ((t - 0.84) / 0.16),
              z: roadPoint.z,
            });
          }
          const driverEntering = t >= 0.42 && t < 0.5;
          const driverInside = t >= 0.5 && t < 0.64;
          const driverLeaving = t >= 0.64 && t <= 0.72;
          patchProperty(properties, drivewayProperty.role, {
            vehicleParked: parked,
            doorOpen:
              (driverEntering && t >= 0.46) ||
              (driverLeaving && t <= 0.69),
            windowActivity: driverInside,
          });
          const drivewayVehicle = makePose(
            "resident-vehicle",
            "vehicle",
            vehiclePoint,
            vehicleYaw,
            parked || yieldingAtDriveway ? 0 : 5.2,
            focus,
            parked ? "parking" : yieldingAtDriveway ? "crossing" : "none",
            drivewayProperty.role,
            yieldingAtDriveway,
          );
          actors.push(drivewayVehicle);
          trafficActors.push(drivewayVehicle);
          addStatistical(counts, drivewayVehicle);

          const driverRoute = makeRoute("resident-driver", [
            parkPoint,
            Object.freeze({
              x: access.entryX,
              z: access.entryZ,
            }),
            propertyDoorPoint(drivewayProperty, safeSeed),
          ]);
          const driverReturnRoute = reverseRoute(driverRoute, ":return");
          const driverMovement = driverEntering || driverLeaving;
          const driverSample = driverEntering
            ? sampleRouteProgress(
                driverRoute,
                clamp01((t - 0.42) / 0.08),
              )
            : sampleRouteProgress(
                driverReturnRoute,
                clamp01((t - 0.64) / 0.08),
              );
          const residentDriver = makePose(
            "resident-driver",
            "resident",
            driverSample.point,
            driverSample.yaw,
            NORMAL_PEDESTRIAN_SPEED,
            focus,
            "door",
            drivewayProperty.role,
            false,
            driverMovement,
          );
          actors.push(residentDriver);
          if (driverMovement) {
            pedestrianPoints.push(driverSample.point);
          }
          addStatistical(counts, residentDriver);
        }

        routes.forEach((route, index) => {
          for (let vehicleNum = 0; vehicleNum < 2; vehicleNum += 1) {
            const directed =
              index % 2 === 0 ? route : reverseRoute(route, ":reverse");
            const vehicle = trafficPose(
              "traffic-vehicle:" + route.id + ":v" + vehicleNum,
              "vehicle",
              directed,
              input.elapsedMs,
              durationMs,
              index * 0.23 + vehicleNum * 0.5 + deterministicUnit(safeSeed, 1100 + index + vehicleNum) * 0.2,
              0.54 + index * 0.07 + vehicleNum * 0.03,
              focus,
              conflicts,
              pedestrianPoints,
              trafficActors,
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
          const directed =
            index % 2 === 0 ? reverseRoute(route, ":reverse") : route;
          const bicycle = trafficPose(
            "traffic-bicycle:" + route.id,
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
        const nearestMailbox = mailboxes.reduce<
          (typeof mailboxes)[number] | null
        >((best, candidate) => {
          if (best === null) return candidate;
          return Math.abs(candidate.point.x - x) < Math.abs(best.point.x - x)
            ? candidate
            : best;
        }, null);
        const mailInteraction =
          nearestMailbox !== null &&
          Math.abs(nearestMailbox.point.x - x) < 1.7;
        const mailPoint = Object.freeze({
          x: mailInteraction ? nearestMailbox.point.x : x,
          z: STREET_LAYOUT.nearSidewalk.centerZ,
        });
        const walkingYaw = -Math.PI / 2;
        const mailboxYaw = nearestMailbox ? Math.atan2(nearestMailbox.point.z - mailPoint.z, nearestMailbox.point.x - mailPoint.x) : walkingYaw;
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
            morning < 0.28
              ? morning / 0.28
              : morning < 0.82
                ? 1
                : 1 - (morning - 0.82) / 0.18;
          const gardenerSample = sampleRouteProgress(
            gardenerRoute,
            clamp01(gardenerProgress),
          );
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
          if (!hasVehicle) continue;
          const propertyIndex = Math.floor(deterministicUnit(safeSeed ^ dayNumber ^ i, 4000 + i) * allDrivewayProperties.length);
          const property = allDrivewayProperties[propertyIndex];
          if (property === undefined || property.drivewayX === null) continue;
          const access = residentialAccessLayout(property, safeSeed);
          const parkedVehicle = makePose(
            `parked-vehicle-${i}`,
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
          const morningOccupied =
            deterministicUnit(safeSeed ^ dayNumber, 1300 + index) > 0.48;
          const sprinkler =
            sunny &&
            ((index + dayNumber + (safeSeed & 3)) % 4 === 0) &&
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
          const nightOccupied =
            deterministicUnit(safeSeed ^ dayNumber, 2300 + index) > 0.3;
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
          if (!hasVehicle) continue;
          const propertyIndex = Math.floor(deterministicUnit(safeSeed ^ dayNumber ^ i, 4500 + i) * allDrivewayProperties.length);
          const property = allDrivewayProperties[propertyIndex];
          if (property === undefined || property.drivewayX === null) continue;
          const access = residentialAccessLayout(property, safeSeed);
          const parkedVehicle = makePose(
            `parked-vehicle-night-${i}`,
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
