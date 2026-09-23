import {
  generateResidentialLayout,
  residentialAccessLayout,
  type ResidentialLayout,
  type ResidentialPoint,
  type ResidentialPropertySpec,
} from "./residential-layout.js";
import {
  activeNeighborhoodOccurrences,
  phaseMinuteAt,
  type SceneNeighborhoodOccurrence,
} from "./neighborhood-occurrences.js";
import {
  generateStreetNetwork,
  type GeneratedStreetNetwork,
  type StreetStripSpec,
} from "./street-layout.js";
import type {
  MobilityActorKind,
  MobilityDetail,
  MobilityInteraction,
  MobilityPose,
  NeighborhoodMobilitySample,
  NeighborhoodMobilitySampleInput,
  PropertyActivity,
} from "./neighborhood-mobility.js";

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

export type OccurrenceMobilityProjector = Readonly<{
  sample(input: NeighborhoodMobilitySampleInput): NeighborhoodMobilitySample;
}>;

const NORMAL_PEDESTRIAN_SPEED = 1.42;
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const pointDistance = (left: ResidentialPoint, right: ResidentialPoint): number =>
  Math.hypot(right.x - left.x, right.z - left.z);

const allProperties = (
  layout: ResidentialLayout,
): readonly ResidentialPropertySpec[] =>
  Object.freeze([
    ...layout.frontProperties,
    ...layout.middleProperties,
    ...layout.backProperties,
    ...layout.outerProperties,
  ]);

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

const reverseRoute = (route: Route, suffix: string): Route =>
  makeRoute(route.id + suffix, [...route.points].reverse());

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
      Object.freeze({ x: -1, z: 0 }),
      Object.freeze({ x: 1, z: 0 }),
    ]);
  }

  const points: ResidentialPoint[] = [segmentEndpoint(first, -1)];
  for (const strip of strips) points.push(segmentEndpoint(strip, 1));
  return makeRoute(streetId, points);
};

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

  const end = route.points.at(-1) ?? Object.freeze({ x: 0, z: 0 });
  const previous = route.points.at(-2) ?? end;
  return Object.freeze({
    point: end,
    yaw: Math.atan2(end.z - previous.z, end.x - previous.x),
  });
};

const sampleRouteProgress = (
  route: Route,
  progress: number,
): Readonly<{ point: ResidentialPoint; yaw: number }> =>
  sampleRouteDistance(route, clamp01(progress) * route.total);

const orientation = (
  from: ResidentialPoint,
  to: ResidentialPoint,
  point: ResidentialPoint,
): number =>
  (to.z - from.z) * (point.x - to.x) -
  (to.x - from.x) * (point.z - to.z);

const lineIntersection = (
  a1: ResidentialPoint,
  a2: ResidentialPoint,
  b1: ResidentialPoint,
  b2: ResidentialPoint,
): ResidentialPoint | null => {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (!(o1 * o2 < 0 && o3 * o4 < 0)) return null;

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
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < routes.length;
      rightIndex += 1
    ) {
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

const mobilityDetailForDistance = (distance: number): MobilityDetail => {
  if (!Number.isFinite(distance)) return "statistical";
  const safe = Math.max(0, distance);
  if (safe <= 28) return "full";
  if (safe <= 72) return "reduced";
  return "statistical";
};

const emptyCounts = (): Record<MobilityActorKind, number> => ({
  resident: 0,
  pet: 0,
  bicycle: 0,
  vehicle: 0,
  "mail-carrier": 0,
  gardener: 0,
});

const propertyActivityDefaults = (
  properties: readonly ResidentialPropertySpec[],
): Map<string, PropertyActivity> =>
  new Map(
    properties.map((property) => [
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

const makePose = (
  counts: Record<MobilityActorKind, number>,
  focus: ResidentialPoint,
  id: string,
  kind: MobilityActorKind,
  point: ResidentialPoint,
  yaw: number,
  speed: number,
  interaction: MobilityInteraction = "none",
  propertyRole: string | null = null,
  waiting = false,
): MobilityPose => {
  const detail = mobilityDetailForDistance(pointDistance(point, focus));
  const pose = Object.freeze({
    id,
    kind,
    x: point.x,
    z: point.z,
    yaw,
    speed: waiting ? 0 : speed,
    visible: detail !== "statistical",
    waiting,
    detail,
    interaction,
    propertyRole,
  });
  if (detail === "statistical") counts[kind] += 1;
  return pose;
};

const eventProgress = (
  event: SceneNeighborhoodOccurrence,
  minute: number,
): number =>
  clamp01(
    (minute - event.startMinute) /
      Math.max(1, event.endMinute - event.startMinute),
  );

const propertyDoor = (
  property: ResidentialPropertySpec,
  seed: number,
): ResidentialPoint => {
  const access = residentialAccessLayout(property, seed);
  return Object.freeze({ x: access.doorX, z: access.doorZ });
};

const propertyEntry = (
  property: ResidentialPropertySpec,
  seed: number,
): ResidentialPoint => {
  const access = residentialAccessLayout(property, seed);
  return Object.freeze({ x: access.entryX, z: access.entryZ });
};

const propertySidewalk = (
  property: ResidentialPropertySpec,
  seed: number,
): ResidentialPoint => {
  const access = residentialAccessLayout(property, seed);
  return Object.freeze({ x: access.sidewalkX, z: access.sidewalkCenterZ });
};

const propertyParking = (
  property: ResidentialPropertySpec,
  seed: number,
): ResidentialPoint | null => {
  if (property.drivewayX === null) return null;
  const access = residentialAccessLayout(property, seed);
  return Object.freeze({ x: property.drivewayX, z: access.parkingZ });
};

const pedestrianRoute = (
  property: ResidentialPropertySpec,
  seed: number,
  direction: -1 | 1,
  toParking: boolean,
): Route => {
  const door = propertyDoor(property, seed);
  const entry = propertyEntry(property, seed);
  const parking = propertyParking(property, seed);
  if (toParking && parking !== null) {
    return makeRoute(`resident:${property.role}:parking`, [
      door,
      entry,
      parking,
    ]);
  }
  const sidewalk = propertySidewalk(property, seed);
  return makeRoute(`resident:${property.role}:sidewalk`, [
    door,
    entry,
    sidewalk,
    Object.freeze({ x: sidewalk.x + direction * 14, z: sidewalk.z }),
  ]);
};

const mailboxPoints = (
  properties: readonly ResidentialPropertySpec[],
  seed: number,
): readonly Readonly<{
  household: number;
  propertyRole: string;
  point: ResidentialPoint;
}>[] =>
  Object.freeze(
    properties
      .flatMap((property, household) => {
        if (property.mailboxX === null) return [];
        const sidewalk = propertySidewalk(property, seed);
        return [
          Object.freeze({
            household,
            propertyRole: property.role,
            point: Object.freeze({
              x: property.mailboxX,
              z: sidewalk.z,
            }),
          }),
        ];
      })
      .sort(
        (left, right) =>
          left.point.z - right.point.z || left.point.x - right.point.x,
      ),
  );

const nearestConflict = (
  conflicts: readonly RouteConflict[],
  routeId: string,
  point: ResidentialPoint,
): RouteConflict | null => {
  let result: RouteConflict | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const conflict of conflicts) {
    if (conflict.routeId !== routeId) continue;
    const distance = pointDistance(conflict.point, point);
    if (distance < best) {
      best = distance;
      result = conflict;
    }
  }
  return best <= 5.2 ? result : null;
};

const trafficPoseAtProgress = (
  counts: Record<MobilityActorKind, number>,
  focus: ResidentialPoint,
  event: SceneNeighborhoodOccurrence,
  kind: "vehicle" | "bicycle",
  route: Route,
  progress: number,
  conflicts: readonly RouteConflict[],
  pedestrians: readonly ResidentialPoint[],
  trafficActors: readonly MobilityPose[],
): MobilityPose => {
  const sampled = sampleRouteProgress(route, progress);
  const baseRouteId = route.id.replace(/:reverse$/, "");
  const conflict = nearestConflict(conflicts, baseRouteId, sampled.point);
  const pedestrianWaiting =
    conflict !== null &&
    pedestrians.some((point) => pointDistance(point, conflict.point) <= 2.8);

  const tangentX = Math.cos(sampled.yaw);
  const tangentZ = Math.sin(sampled.yaw);
  const safetyRadius = kind === "vehicle" ? 5.4 : 3.7;
  const trafficBlocker = trafficActors.find((actor) => {
    if (actor.kind !== "vehicle" && actor.kind !== "bicycle") return false;
    const dx = actor.x - sampled.point.x;
    const dz = actor.z - sampled.point.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= safetyRadius) {
      return dx * tangentX + dz * tangentZ >= -0.35;
    }
    return (
      conflict !== null &&
      pointDistance({ x: actor.x, z: actor.z }, conflict.point) <= 4.4 &&
      pointDistance(sampled.point, conflict.point) <= 5.2
    );
  });
  const trafficWaiting = !pedestrianWaiting && trafficBlocker !== undefined;
  let point = sampled.point;
  if (pedestrianWaiting && conflict !== null) {
    const dx = sampled.point.x - conflict.point.x;
    const dz = sampled.point.z - conflict.point.z;
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
    counts,
    focus,
    event.actorId,
    kind,
    point,
    sampled.yaw,
    kind === "vehicle" ? 7.8 : 4.2,
    pedestrianWaiting ? "crossing" : trafficWaiting ? "traffic" : "none",
    null,
    pedestrianWaiting || trafficWaiting,
  );
};

const drivewayVehiclePose = (
  counts: Record<MobilityActorKind, number>,
  focus: ResidentialPoint,
  seed: number,
  property: ResidentialPropertySpec,
  event: SceneNeighborhoodOccurrence,
  minute: number,
  pedestrians: readonly ResidentialPoint[],
): MobilityPose | null => {
  const parking = propertyParking(property, seed);
  if (parking === null || property.drivewayX === null) return null;
  const access = residentialAccessLayout(property, seed);
  const road = Object.freeze({ x: access.roadX, z: access.roadCenterZ });
  const crossing = Object.freeze({
    x: access.drivewaySidewalkX,
    z: access.drivewaySidewalkZ,
  });
  const direction = (event.visualSeed & 1) === 0 ? 1 : -1;
  const roadFar = Object.freeze({
    x: road.x + direction * 26,
    z: road.z,
  });
  const departure = makeRoute(`${event.actorId}:departure`, [
    parking,
    crossing,
    road,
    roadFar,
  ]);
  const route =
    event.kind === "vehicle-arrival"
      ? reverseRoute(departure, ":arrival")
      : departure;
  const progress = eventProgress(event, minute);
  const sampled = sampleRouteProgress(route, progress);
  const crossingOccupied = pedestrians.some(
    (point) => pointDistance(point, crossing) <= 2.8,
  );
  const nearCrossing = pointDistance(sampled.point, crossing) <= 3.2;
  let point = sampled.point;
  if (crossingOccupied && nearCrossing) {
    const source = event.kind === "vehicle-arrival" ? road : parking;
    const dx = source.x - crossing.x;
    const dz = source.z - crossing.z;
    const magnitude = Math.max(0.001, Math.hypot(dx, dz));
    point = Object.freeze({
      x: crossing.x + (dx / magnitude) * 2.1,
      z: crossing.z + (dz / magnitude) * 2.1,
    });
  }
  return makePose(
    counts,
    focus,
    event.actorId,
    "vehicle",
    point,
    sampled.yaw,
    5.2,
    crossingOccupied && nearCrossing ? "crossing" : "none",
    property.role,
    crossingOccupied && nearCrossing,
  );
};

export const createOccurrenceMobilityProjector = (
  seed: number,
): OccurrenceMobilityProjector => {
  const safeSeed = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
  const layout = generateResidentialLayout(safeSeed);
  const properties = allProperties(layout);
  const network = generateStreetNetwork(safeSeed);
  const streetIds = [
    ...new Set(network.roads.map((strip) => strip.streetId)),
  ].sort();
  const routes = streetIds.map((streetId) => routeForStreet(network, streetId));
  const conflicts = routeIntersections(routes);
  const mailboxes = mailboxPoints(properties, safeSeed);

  return Object.freeze({
    sample(input): NeighborhoodMobilitySample {
      const focus = input.focus ?? Object.freeze({ x: 0, z: 0 });
      const durationMs = Math.max(1, input.durationMs);
      const minute = phaseMinuteAt(input.phase, input.elapsedMs, durationMs);
      const occurrences = input.occurrences ?? Object.freeze([]);
      const active = activeNeighborhoodOccurrences(
        occurrences,
        input.phase,
        input.elapsedMs,
        durationMs,
      );
      const actors: MobilityPose[] = [];
      const activity = propertyActivityDefaults(properties);
      const counts = emptyCounts();
      const pedestrians: ResidentialPoint[] = [
        ...(input.pedestrianObstacles ?? []),
      ];
      const trafficActors: MobilityPose[] = [];

      for (const event of occurrences) {
        if (event.household === null) continue;
        const property = properties[event.household];
        if (property === undefined) continue;

        if (event.kind === "window-activity" && event.startMinute <= minute && minute < event.endMinute) {
          patchProperty(activity, property.role, { windowActivity: true });
        }
        if (event.kind === "mail-delivery" && event.endMinute <= minute) {
          patchProperty(activity, property.role, { mailServiced: true });
        }
      }

      const vehicleEventsByHousehold = new Map<
        number,
        readonly SceneNeighborhoodOccurrence[]
      >();
      for (let household = 0; household < properties.length; household += 1) {
        const events = occurrences.filter(
          (event) =>
            event.household === household &&
            (event.kind === "vehicle-departure" ||
              event.kind === "vehicle-arrival"),
        );
        if (events.length > 0) vehicleEventsByHousehold.set(household, events);
      }

      for (const [household, events] of vehicleEventsByHousehold) {
        const property = properties[household];
        if (property === undefined || property.drivewayX === null) continue;
        const departure = events.find(
          (event) => event.kind === "vehicle-departure",
        );
        const arrival = events.find((event) => event.kind === "vehicle-arrival");
        const parked =
          departure !== undefined && minute < departure.startMinute
            ? true
            : arrival !== undefined && minute >= arrival.endMinute;
        if (!parked) continue;
        const parking = propertyParking(property, safeSeed);
        if (parking === null) continue;
        patchProperty(activity, property.role, { vehicleParked: true });
        actors.push(
          makePose(
            counts,
            focus,
            `parked:${String(household)}`,
            "vehicle",
            parking,
            property.rotationY,
            0,
            "parking",
            property.role,
            true,
          ),
        );
      }

      const householdActors = active
        .filter(
          (event) =>
            event.kind === "resident-departure" ||
            event.kind === "resident-arrival" ||
            event.kind === "pet-walk" ||
            event.kind === "gardening" ||
            event.kind === "sprinkler" ||
            event.kind === "window-activity",
        )
        .sort(
          (left, right) =>
            left.startMinute - right.startMinute || left.id.localeCompare(right.id),
        );

      for (const event of householdActors) {
        if (event.household === null) continue;
        const property = properties[event.household];
        if (property === undefined) continue;
        const progress = eventProgress(event, minute);

        if (
          event.kind === "resident-departure" ||
          event.kind === "resident-arrival"
        ) {
          const pairedVehicleKind =
            event.kind === "resident-departure"
              ? "vehicle-departure"
              : "vehicle-arrival";
          const pairedVehicle = occurrences.find(
            (candidate) =>
              candidate.household === event.household &&
              candidate.kind === pairedVehicleKind,
          );
          const direction: -1 | 1 = (event.visualSeed & 1) === 0 ? 1 : -1;
          const outward = pedestrianRoute(
            property,
            safeSeed,
            direction,
            pairedVehicle !== undefined,
          );
          const route =
            event.kind === "resident-arrival"
              ? reverseRoute(outward, ":arrival")
              : outward;
          const sampled = sampleRouteProgress(route, progress);
          const doorOpen =
            event.kind === "resident-departure"
              ? progress < 0.2
              : progress > 0.8;
          patchProperty(activity, property.role, {
            doorOpen,
            windowActivity:
              event.kind === "resident-arrival" && progress > 0.82,
          });
          const resident = makePose(
            counts,
            focus,
            event.actorId,
            "resident",
            sampled.point,
            sampled.yaw,
            event.motion === "hurried" ? 1.62 : NORMAL_PEDESTRIAN_SPEED,
            doorOpen ? "door" : "none",
            property.role,
          );
          actors.push(resident);
          pedestrians.push(sampled.point);
          continue;
        }

        if (event.kind === "pet-walk") {
          const door = propertyDoor(property, safeSeed);
          const entry = propertyEntry(property, safeSeed);
          const sidewalk = propertySidewalk(property, safeSeed);
          const direction = (event.visualSeed & 1) === 0 ? 1 : -1;
          const outward = makeRoute(`${event.actorId}:walk`, [
            door,
            entry,
            sidewalk,
            Object.freeze({ x: sidewalk.x + direction * 12, z: sidewalk.z }),
          ]);
          const returning = progress >= 0.5;
          const routeProgress = returning ? (1 - progress) * 2 : progress * 2;
          const sampled = sampleRouteProgress(outward, routeProgress);
          const doorOpen = progress < 0.12 || progress > 0.88;
          patchProperty(activity, property.role, {
            doorOpen,
            windowActivity: progress > 0.92,
          });
          const pet = makePose(
            counts,
            focus,
            event.actorId,
            "pet",
            sampled.point,
            returning ? sampled.yaw + Math.PI : sampled.yaw,
            event.motion === "hurried" ? 1.55 : 1.3,
            doorOpen ? "door" : "none",
            property.role,
          );
          actors.push(pet);
          pedestrians.push(sampled.point);
          continue;
        }

        if (event.kind === "gardening") {
          const sidewalk = propertySidewalk(property, safeSeed);
          const access = residentialAccessLayout(property, safeSeed);
          const garden = Object.freeze({
            x: property.houseX + 1.8,
            z: access.pathCenterZ,
          });
          const route = makeRoute(event.actorId, [sidewalk, garden]);
          const gardening = progress >= 0.2 && progress < 0.8;
          const routeProgress =
            progress < 0.2
              ? progress / 0.2
              : progress < 0.8
                ? 1
                : 1 - (progress - 0.8) / 0.2;
          const sampled = sampleRouteProgress(route, routeProgress);
          patchProperty(activity, property.role, {
            gardenerPresent: gardening,
          });
          const gardener = makePose(
            counts,
            focus,
            event.actorId,
            "gardener",
            sampled.point,
            sampled.yaw,
            gardening ? 0 : NORMAL_PEDESTRIAN_SPEED,
            gardening ? "gardening" : "none",
            property.role,
          );
          actors.push(gardener);
          pedestrians.push(sampled.point);
          continue;
        }

        if (event.kind === "sprinkler") {
          patchProperty(activity, property.role, { sprinklerOn: true });
        }
      }

      const scheduledMail = occurrences
        .filter((event) => event.kind === "mail-delivery")
        .sort(
          (left, right) =>
            left.startMinute - right.startMinute ||
            left.endMinute - right.endMinute ||
            left.id.localeCompare(right.id),
        );
      const firstMail = scheduledMail[0];
      const lastMail = scheduledMail.at(-1);
      if (
        firstMail !== undefined &&
        lastMail !== undefined &&
        minute >= firstMail.startMinute &&
        minute < lastMail.endMinute
      ) {
        const activeMail = active.find((event) => event.kind === "mail-delivery");
        const span = Math.max(1, lastMail.endMinute - firstMail.startMinute);
        const progress = clamp01((minute - firstMail.startMinute) / span);
        const firstPoint = mailboxes[0]?.point ?? Object.freeze({ x: -96, z: 0 });
        const lastPoint =
          mailboxes.at(-1)?.point ?? Object.freeze({ x: 96, z: firstPoint.z });
        let point = Object.freeze({
          x: firstPoint.x + (lastPoint.x - firstPoint.x) * progress,
          z: firstPoint.z + (lastPoint.z - firstPoint.z) * progress,
        });
        let propertyRole: string | null = null;
        let interaction: MobilityInteraction = "none";
        if (activeMail?.household !== null && activeMail?.household !== undefined) {
          const mailbox = mailboxes.find(
            (candidate) => candidate.household === activeMail.household,
          );
          if (mailbox !== undefined) {
            point = mailbox.point;
            propertyRole = mailbox.propertyRole;
            interaction = "mailbox";
          }
        }
        const mailCarrier = makePose(
          counts,
          focus,
          "mail-carrier",
          "mail-carrier",
          point,
          Math.atan2(lastPoint.z - firstPoint.z, lastPoint.x - firstPoint.x),
          interaction === "mailbox" ? 0 : NORMAL_PEDESTRIAN_SPEED,
          interaction,
          propertyRole,
        );
        actors.push(mailCarrier);
        pedestrians.push(point);
      }

      const activeVehicles = active
        .filter(
          (event) =>
            event.kind === "vehicle-departure" ||
            event.kind === "vehicle-arrival",
        )
        .sort((left, right) => left.id.localeCompare(right.id));
      for (const event of activeVehicles) {
        if (event.household === null) continue;
        const property = properties[event.household];
        if (property === undefined) continue;
        const vehicle = drivewayVehiclePose(
          counts,
          focus,
          safeSeed,
          property,
          event,
          minute,
          pedestrians,
        );
        if (vehicle === null) continue;
        actors.push(vehicle);
        trafficActors.push(vehicle);
        patchProperty(activity, property.role, {
          vehicleParked: event.kind === "vehicle-arrival" && eventProgress(event, minute) > 0.9,
        });
      }

      const passThrough = active
        .filter(
          (event) =>
            event.kind === "vehicle-pass-through" ||
            event.kind === "bicycle-pass-through",
        )
        .sort(
          (left, right) =>
            left.startMinute - right.startMinute || left.id.localeCompare(right.id),
        );
      for (const event of passThrough) {
        if (routes.length === 0) break;
        const index = event.visualSeed % routes.length;
        const selected = routes[index] ?? routes[0];
        if (selected === undefined) break;
        const route =
          (event.visualSeed & 2) === 0
            ? selected
            : reverseRoute(selected, ":reverse");
        const kind =
          event.kind === "vehicle-pass-through" ? "vehicle" : "bicycle";
        const pose = trafficPoseAtProgress(
          counts,
          focus,
          event,
          kind,
          route,
          eventProgress(event, minute),
          conflicts,
          pedestrians,
          trafficActors,
        );
        actors.push(pose);
        trafficActors.push(pose);
      }

      return Object.freeze({
        actors: Object.freeze(actors),
        properties: Object.freeze([...activity.values()]),
        statisticalCounts: Object.freeze({ ...counts }),
      });
    },
  });
};
