import { Group, type Scene } from "three";

import { walkingCycleAtDistance } from "./gait.js";
import { PASSERBY_FOREGROUND_TARGET } from "./scene-capacity.js";
import {
  generateResidentialLayout,
  residentialAccessLayout,
  type ResidentialPoint,
} from "./residential-layout.js";
import { characterGroundClearance } from "./world-scale.js";
import {
  DEFAULT_STREET_SEED,
  gardenSignPosition,
  generateStreetNetwork,
  sidewalkLaneZ,
  type SidewalkSide,
  type StreetStripSpec,
} from "./street-layout.js";
import type { PasserbyBeat } from "./storyboard.js";

export { gardenSignPosition, sidewalkLaneZ };

export type CrowdPose = Readonly<{
  x: number;
  z: number;
  heading: number;
  pace: number;
  worldSpeed: number;
  travelDistance: number;
  side: SidewalkSide;
  routeId: string;
  seesAdvertisement: boolean;
  destinationRole: string | null;
  enteringHome: boolean;
}>;

export type CrowdSample = Readonly<{
  poses: readonly (CrowdPose | undefined)[];
  neighborChecks: number;
}>;

export type CrowdSimulation = Readonly<{
  sample(elapsedMs: number): CrowdSample;
}>;

const CROWD_CELL_SIZE = 1.08;
const CROWD_SEPARATION = 0.72;
const HOME_ROUTE_MAX_GAP = 1.35;
const HOME_ENTRY_RESERVE_METERS = 0.55;

type PedestrianRoute = Readonly<{
  id: string;
  streetId: string;
  side: SidewalkSide;
  width: number;
  points: readonly Readonly<{ x: number; z: number }>[];
  strips: readonly StreetStripSpec[];
  cumulative: readonly number[];
  total: number;
}>;

const sidewalkEndpoint = (
  strip: StreetStripSpec,
  direction: -1 | 1,
): Readonly<{ x: number; z: number }> => {
  const half = strip.length / 2;
  return Object.freeze({
    x: strip.x + Math.cos(strip.rotationY) * half * direction,
    z: strip.z + Math.sin(strip.rotationY) * half * direction,
  });
};

const makePedestrianRoute = (
  id: string,
  streetId: string,
  side: SidewalkSide,
  strips: readonly StreetStripSpec[],
): PedestrianRoute => {
  const ordered = [...strips].sort(
    (left, right) =>
      Math.floor(left.segmentIndex / 2) - Math.floor(right.segmentIndex / 2),
  );
  const first = ordered[0];
  if (first === undefined) {
    throw new Error("pedestrian route requires at least one sidewalk segment");
  }
  const points = [
    sidewalkEndpoint(first, -1),
    ...ordered.map((strip) => sidewalkEndpoint(strip, 1)),
  ];
  const cumulative: number[] = [0];
  let total = 0;
  for (const strip of ordered) {
    total += strip.length;
    cumulative.push(total);
  }
  return Object.freeze({
    id,
    streetId,
    side,
    width: first.width,
    points: Object.freeze(points),
    strips: Object.freeze(ordered),
    cumulative: Object.freeze(cumulative),
    total: Math.max(0.001, total),
  });
};

const contiguousSidewalkComponents = (
  strips: readonly StreetStripSpec[],
): readonly (readonly StreetStripSpec[])[] => {
  const ordered = [...strips].sort(
    (left, right) =>
      Math.floor(left.segmentIndex / 2) - Math.floor(right.segmentIndex / 2),
  );
  const components: StreetStripSpec[][] = [];

  for (const strip of ordered) {
    const current = components.at(-1);
    const previous = current?.at(-1);
    if (current === undefined || previous === undefined) {
      components.push([strip]);
      continue;
    }

    const previousRoadIndex = Math.floor(previous.segmentIndex / 2);
    const nextRoadIndex = Math.floor(strip.segmentIndex / 2);
    const previousEnd = sidewalkEndpoint(previous, 1);
    const nextStart = sidewalkEndpoint(strip, -1);
    const gap = Math.hypot(
      nextStart.x - previousEnd.x,
      nextStart.z - previousEnd.z,
    );
    const maximumJoinGap = Math.max(
      1.4,
      (previous.width + strip.width) * 0.9,
    );

    if (
      nextRoadIndex !== previousRoadIndex + 1 ||
      gap > maximumJoinGap
    ) {
      components.push([strip]);
    } else {
      current.push(strip);
    }
  }

  return Object.freeze(
    components.map((component) => Object.freeze(component)),
  );
};

export const neighborhoodSidewalkRoutes = (
  seed = DEFAULT_STREET_SEED,
): readonly PedestrianRoute[] => {
  const network = generateStreetNetwork(seed);
  const groups = new Map<string, StreetStripSpec[]>();
  for (const strip of network.sidewalks) {
    const sideIndex = strip.segmentIndex % 2;
    const key = strip.streetId + ":" + String(sideIndex);
    const current = groups.get(key);
    if (current === undefined) groups.set(key, [strip]);
    else current.push(strip);
  }

  return Object.freeze(
    [...groups.entries()]
      .flatMap(([key, strips]) => {
        const separator = key.lastIndexOf(":");
        const streetId = key.slice(0, separator);
        const side: SidewalkSide = key.endsWith(":0") ? "near" : "far";
        const components = contiguousSidewalkComponents(strips);
        return components.map((component, componentIndex) =>
          makePedestrianRoute(
            components.length === 1 ? key : key + ":" + String(componentIndex),
            streetId,
            side,
            component,
          ),
        );
      })
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
};

const routeSupportsSideEntry = (route: PedestrianRoute): boolean => {
  const first = route.points[0];
  const last = route.points.at(-1);
  if (first === undefined || last === undefined) return false;
  return Math.abs(last.x - first.x) >= Math.abs(last.z - first.z);
};

const samplePedestrianRoute = (
  route: PedestrianRoute,
  distance: number,
): Readonly<{ x: number; z: number; yaw: number }> => {
  const bounded = Math.min(route.total, Math.max(0, distance));
  for (let index = 1; index < route.cumulative.length; index += 1) {
    const endDistance = route.cumulative[index];
    const startDistance = route.cumulative[index - 1];
    const strip = route.strips[index - 1];
    if (
      endDistance === undefined ||
      startDistance === undefined ||
      strip === undefined ||
      bounded > endDistance
    ) {
      continue;
    }
    const start = sidewalkEndpoint(strip, -1);
    const end = sidewalkEndpoint(strip, 1);
    const segmentLength = Math.max(0.001, endDistance - startDistance);
    const progress = (bounded - startDistance) / segmentLength;
    return Object.freeze({
      x: start.x + (end.x - start.x) * progress,
      z: start.z + (end.z - start.z) * progress,
      yaw: strip.rotationY,
    });
  }
  const last = route.strips.at(-1);
  if (last === undefined) {
    return Object.freeze({ x: 0, z: 0, yaw: 0 });
  }
  const end = sidewalkEndpoint(last, 1);
  return Object.freeze({
    x: end.x,
    z: end.z,
    yaw: last.rotationY,
  });
};

const deterministicUnit = (index: number, salt: number): number => {
  let value = Math.imul((index + 1) >>> 0, 0x9e3779b1) ^ (salt >>> 0);
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0xffff_ffff;
};

const routeFocusDistance = (route: PedestrianRoute): number => {
  const midpoint = samplePedestrianRoute(route, route.total / 2);
  return Math.hypot(midpoint.x, midpoint.z);
};

type PedestrianHomeEntry = Readonly<{
  role: string;
  sidewalk: ResidentialPoint;
  entry: ResidentialPoint;
  door: ResidentialPoint;
}>;

type RouteProjection = Readonly<{
  distance: number;
  point: ResidentialPoint;
  yaw: number;
  gap: number;
}>;

type HomeDestination = Readonly<{
  role: string;
  routeDistance: number;
  approach: PedestrianRoute;
  journeyDistance: number;
}>;

const pedestrianHomeEntryCache = new Map<
  number,
  readonly PedestrianHomeEntry[]
>();

const pedestrianHomeEntries = (seed: number): readonly PedestrianHomeEntry[] => {
  const safeSeed = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : DEFAULT_STREET_SEED;
  const cached = pedestrianHomeEntryCache.get(safeSeed);
  if (cached !== undefined) return cached;
  const layout = generateResidentialLayout(safeSeed);
  const properties = [
    ...layout.frontProperties,
    ...layout.middleProperties,
    ...layout.backProperties,
    ...layout.outerProperties,
  ];
  const entries = Object.freeze(
    properties
      .filter(
        (property) =>
          property.role !== "stand-home" &&
          property.role !== "stand-neighbor",
      )
      .map((property) => {
        const access = residentialAccessLayout(property, safeSeed);
        return Object.freeze({
          role: property.role,
          sidewalk: Object.freeze({
            x: access.sidewalkX,
            z: access.sidewalkCenterZ,
          }),
          entry: Object.freeze({ x: access.entryX, z: access.entryZ }),
          door: Object.freeze({ x: access.doorX, z: access.doorZ }),
        });
      }),
  );
  pedestrianHomeEntryCache.set(safeSeed, entries);
  return entries;
};

const projectPointToRoute = (
  route: PedestrianRoute,
  point: ResidentialPoint,
): RouteProjection | null => {
  let best: RouteProjection | null = null;
  for (let index = 0; index < route.strips.length; index += 1) {
    const strip = route.strips[index];
    const startDistance = route.cumulative[index];
    if (strip === undefined || startDistance === undefined) continue;
    const start = sidewalkEndpoint(strip, -1);
    const end = sidewalkEndpoint(strip, 1);
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthSquared = Math.max(0.0001, dx * dx + dz * dz);
    const progress = Math.min(
      1,
      Math.max(
        0,
        ((point.x - start.x) * dx + (point.z - start.z) * dz) /
          lengthSquared,
      ),
    );
    const projected = Object.freeze({
      x: start.x + dx * progress,
      z: start.z + dz * progress,
    });
    const gap = Math.hypot(point.x - projected.x, point.z - projected.z);
    const candidate = Object.freeze({
      distance: startDistance + strip.length * progress,
      point: projected,
      yaw: strip.rotationY,
      gap,
    });
    if (best === null || candidate.gap < best.gap) best = candidate;
  }
  return best;
};

const homeDestinationFor = (
  route: PedestrianRoute,
  direction: -1 | 1,
  actorIndex: number,
  travelBudget: number,
  seed: number,
): HomeDestination | null => {
  const candidates = pedestrianHomeEntries(seed)
    .map((home) => {
      const projection = projectPointToRoute(route, home.sidewalk);
      if (
        projection === null ||
        projection.gap > HOME_ROUTE_MAX_GAP ||
        projection.distance <= 0.8 ||
        projection.distance >= route.total - 0.8
      ) {
        return null;
      }
      const points = [
        projection.point,
        home.sidewalk,
        home.entry,
        home.door,
      ];
      const cumulative: number[] = [0];
      let total = 0;
      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        if (previous === undefined || current === undefined) continue;
        total += Math.hypot(current.x - previous.x, current.z - previous.z);
        cumulative.push(total);
      }
      const homeApproach: PedestrianRoute = Object.freeze({
        id: route.id + ":home:" + home.role,
        streetId: route.streetId,
        side: route.side,
        width: route.width,
        points: Object.freeze(points),
        strips: Object.freeze([]),
        cumulative: Object.freeze(cumulative),
        total: Math.max(0.001, total),
      });
      const sidewalkDistance =
        direction === -1
          ? projection.distance
          : route.total - projection.distance;
      return Object.freeze({
        role: home.role,
        routeDistance: projection.distance,
        approach: homeApproach,
        journeyDistance: sidewalkDistance + homeApproach.total,
      });
    })
    .filter((candidate): candidate is HomeDestination => candidate !== null)
    .filter(
      (candidate) =>
        candidate.journeyDistance + HOME_ENTRY_RESERVE_METERS <= travelBudget,
    )
    .sort(
      (left, right) =>
        left.journeyDistance - right.journeyDistance ||
        left.role.localeCompare(right.role),
    );

  if (candidates.length === 0) return null;
  const shortList = candidates.slice(0, Math.min(5, candidates.length));
  const choice = Math.floor(
    deterministicUnit(actorIndex, 809) * shortList.length,
  );
  return shortList[choice] ?? shortList[0] ?? null;
};

const samplePolylineRoute = (
  route: PedestrianRoute,
  distance: number,
): Readonly<{ x: number; z: number; yaw: number }> => {
  const bounded = Math.min(route.total, Math.max(0, distance));
  for (let index = 1; index < route.points.length; index += 1) {
    const startDistance = route.cumulative[index - 1];
    const endDistance = route.cumulative[index];
    const start = route.points[index - 1];
    const end = route.points[index];
    if (
      startDistance === undefined ||
      endDistance === undefined ||
      start === undefined ||
      end === undefined ||
      bounded > endDistance
    ) {
      continue;
    }
    const segmentLength = Math.max(0.001, endDistance - startDistance);
    const progress = (bounded - startDistance) / segmentLength;
    return Object.freeze({
      x: start.x + (end.x - start.x) * progress,
      z: start.z + (end.z - start.z) * progress,
      yaw: Math.atan2(end.z - start.z, end.x - start.x),
    });
  }
  const end = route.points.at(-1) ?? { x: 0, z: 0 };
  const previous = route.points.at(-2) ?? end;
  return Object.freeze({
    x: end.x,
    z: end.z,
    yaw: Math.atan2(end.z - previous.z, end.x - previous.x),
  });
};

export const crowdGroundClearance = (heightScale: number): number =>
  characterGroundClearance(
    Math.max(
      0.62,
      Math.min(1.2, Number.isFinite(heightScale) ? heightScale : 1),
    ),
  );

const basePose = (
  beat: PasserbyBeat,
  actorIndex: number,
  elapsedMs: number,
  durationMs: number,
  routes: readonly PedestrianRoute[],
  seed: number,
): MutableCrowdPose | undefined => {
  const safeDuration = Math.max(1, Number.isFinite(durationMs) ? durationMs : 1);
  const worldSpeed = 1.18 + deterministicUnit(actorIndex, 17) * 0.26;
  const elapsedSeconds =
    Math.max(
      0,
      Math.min(elapsedMs - beat.startAtMs, safeDuration * 8),
    ) / 1_000;

  const remainingSeconds =
    Math.max(0, safeDuration - Math.max(0, beat.startAtMs)) / 1_000;
  const requiredTravelDistance = remainingSeconds * worldSpeed + 0.25;
  const supportsFullTraversal = (route: PedestrianRoute): boolean =>
    route.total >= requiredTravelDistance;
  const viableRoutes = routes.filter(supportsFullTraversal);
  const mainRoutes = viableRoutes.filter(
    (route) => route.streetId === "main",
  );
  const sideEntryRoutes = viableRoutes.filter(routeSupportsSideEntry);
  const neighborhoodRoutes = sideEntryRoutes.filter(
    (route) => route.streetId !== "main",
  );
  const foregroundRoutes = [...sideEntryRoutes].sort(
    (left, right) =>
      routeFocusDistance(left) - routeFocusDistance(right) ||
      left.id.localeCompare(right.id),
  );
  const requestedSide: SidewalkSide = actorIndex % 2 === 0 ? "near" : "far";
  const mainRoute =
    mainRoutes
      .filter((route) => route.side === requestedSide)
      .sort((left, right) => {
        const leftStart = left.points[0]?.x ?? 0;
        const leftEnd = left.points.at(-1)?.x ?? 0;
        const rightStart = right.points[0]?.x ?? 0;
        const rightEnd = right.points.at(-1)?.x ?? 0;
        return (
          Math.abs((leftStart + leftEnd) / 2) -
          Math.abs((rightStart + rightEnd) / 2)
        );
      })[0] ??
    mainRoutes[actorIndex % Math.max(1, mainRoutes.length)];
  const neighborhoodRoute =
    neighborhoodRoutes.length === 0
      ? undefined
      : neighborhoodRoutes[
          Math.floor(
            deterministicUnit(
              actorIndex,
              173 + beat.pedestrianIndex * 37,
            ) * neighborhoodRoutes.length,
          )
        ];
  const foregroundSideRoutes = foregroundRoutes.filter(
    (route) => route.side === requestedSide,
  );
  const foregroundPool =
    foregroundSideRoutes.length > 0 ? foregroundSideRoutes : foregroundRoutes;
  const foregroundRoute =
    foregroundPool.length === 0
      ? undefined
      : foregroundPool[
          Math.floor(
            deterministicUnit(
              actorIndex,
              431 + beat.pedestrianIndex * 23,
            ) * foregroundPool.length,
          )
        ];
  const fallbackRoutes = viableRoutes.length > 0 ? viableRoutes : routes;
  const usesForegroundCohort =
    actorIndex < PASSERBY_FOREGROUND_TARGET && beat.startAtMs === 0;
  const route =
    (usesForegroundCohort
      ? foregroundRoute ?? mainRoute
      : beat.seesAdvertisement
        ? mainRoute
        : neighborhoodRoute) ??
    fallbackRoutes[actorIndex % Math.max(1, fallbackRoutes.length)];
  if (route === undefined) {
    throw new Error("crowd motion requires generated sidewalk routes");
  }

  const initialDistribution = deterministicUnit(
    actorIndex,
    293 + beat.pedestrianIndex * 19,
  );
  const minimumStartDistance =
    beat.direction === -1 ? 0 : requiredTravelDistance;
  const maximumStartDistance =
    beat.direction === -1
      ? route.total - requiredTravelDistance
      : route.total;
  const foregroundSpread = Math.max(
    0,
    maximumStartDistance - minimumStartDistance,
  );
  const centeredStartDistance = Math.max(
    minimumStartDistance,
    Math.min(
      maximumStartDistance,
      route.total / 2 +
        (initialDistribution - 0.5) * foregroundSpread,
    ),
  );
  const spawnDistance = usesForegroundCohort
    ? centeredStartDistance
    : beat.direction === -1
      ? 0
      : route.total;
  const travelBudget = remainingSeconds * worldSpeed;
  const homeDestination = usesForegroundCohort
    ? null
    : homeDestinationFor(
        route,
        beat.direction,
        actorIndex,
        travelBudget,
        seed,
      );
  const distanceTravelled = elapsedSeconds * worldSpeed;
  const sidewalkTravelToHome =
    homeDestination === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(homeDestination.routeDistance - spawnDistance);
  const enteringHome =
    homeDestination !== null && distanceTravelled >= sidewalkTravelToHome;

  let sampled: Readonly<{ x: number; z: number; yaw: number }>;
  let routeDistance: number;
  let lateralLimit: number;
  let lateralOffset: number;
  let progress: number;

  if (enteringHome && homeDestination !== null) {
    const approachDistance = distanceTravelled - sidewalkTravelToHome;
    if (approachDistance > homeDestination.approach.total) return undefined;
    sampled = samplePolylineRoute(homeDestination.approach, approachDistance);
    routeDistance = homeDestination.routeDistance;
    progress = routeDistance / route.total;
    lateralLimit = 0.12;
    lateralOffset = 0;
  } else {
    routeDistance =
      beat.direction === -1
        ? spawnDistance + distanceTravelled
        : spawnDistance - distanceTravelled;
    if (homeDestination !== null) {
      routeDistance =
        beat.direction === -1
          ? Math.min(routeDistance, homeDestination.routeDistance)
          : Math.max(routeDistance, homeDestination.routeDistance);
    }
    if (routeDistance < 0 || routeDistance > route.total) return undefined;
    progress = routeDistance / route.total;
    sampled = samplePedestrianRoute(route, routeDistance);
    const laneFraction = (Math.abs(Math.trunc(beat.lane)) % 4) / 3;
    lateralLimit = Math.max(0.2, route.width / 2 - 0.22);
    const laneOffset = (laneFraction - 0.5) * lateralLimit * 1.45;
    const meander =
      Math.sin(progress * Math.PI * 2 + actorIndex * 0.83) * 0.045;
    lateralOffset = Math.max(
      -lateralLimit,
      Math.min(lateralLimit, laneOffset + meander),
    );
  }

  const travelYaw =
    sampled.yaw + (enteringHome || beat.direction === -1 ? 0 : Math.PI);
  const normalX = -Math.sin(sampled.yaw);
  const normalZ = Math.cos(sampled.yaw);
  const attention =
    !enteringHome && beat.seesAdvertisement
      ? Math.exp(-Math.pow((progress - 0.5) / 0.13, 2))
      : 0;
  const signSide = beat.signIndex >= 0 && beat.signIndex % 2 === 0 ? -1 : 1;
  const signPull = attention * signSide * 0.22;
  const attentionHeading =
    signSide * (route.side === "near" ? 0.48 : 0.32) * attention;
  const heading = Math.PI / 2 - travelYaw + attentionHeading;

  return {
    x:
      sampled.x +
      normalX * lateralOffset +
      (!enteringHome && route.streetId === "main" ? signPull : 0),
    z: sampled.z + normalZ * lateralOffset,
    heading,
    pace: Math.max(0.82, Math.min(1.18, worldSpeed / 1.3)),
    worldSpeed,
    travelDistance: distanceTravelled,
    side: route.side,
    routeId: route.id,
    seesAdvertisement: beat.seesAdvertisement,
    destinationRole: homeDestination?.role ?? null,
    enteringHome,
    centerX: sampled.x,
    centerZ: sampled.z,
    normalX,
    normalZ,
    tangentX: Math.cos(travelYaw),
    tangentZ: Math.sin(travelYaw),
    lateralOffset,
    lateralLimit,
  };
};

interface MutableCrowdPose {
  x: number;
  z: number;
  heading: number;
  pace: number;
  worldSpeed: number;
  travelDistance: number;
  side: SidewalkSide;
  routeId: string;
  seesAdvertisement: boolean;
  destinationRole: string | null;
  enteringHome: boolean;
  centerX: number;
  centerZ: number;
  normalX: number;
  normalZ: number;
  tangentX: number;
  tangentZ: number;
  lateralOffset: number;
  lateralLimit: number;
}

const cellCoordinate = (value: number): number => Math.floor(value / CROWD_CELL_SIZE);
const cellKey = (x: number, z: number): string =>
  String(cellCoordinate(x)) + ":" + String(cellCoordinate(z));

const separateCrowd = (poses: (MutableCrowdPose | undefined)[]): number => {
  let neighborChecks = 0;
  for (let pass = 0; pass < 3; pass += 1) {
    const cells = new Map<string, number[]>();
    poses.forEach((pose, index) => {
      if (pose === undefined) return;
      const key = cellKey(pose.x, pose.z);
      const bucket = cells.get(key);
      if (bucket === undefined) cells.set(key, [index]);
      else bucket.push(index);
    });

    for (let left = 0; left < poses.length; left += 1) {
      const a = poses[left];
      if (a === undefined) continue;
      const cellX = cellCoordinate(a.x);
      const cellZ = cellCoordinate(a.z);

      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
          const bucket = cells.get(
            String(cellX + offsetX) + ":" + String(cellZ + offsetZ),
          );
          if (bucket === undefined) continue;
          for (const right of bucket) {
            if (right <= left) continue;
            const b = poses[right];
            if (b === undefined) continue;
            neighborChecks += 1;

            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const distanceSquared = dx * dx + dz * dz;
            if (distanceSquared >= CROWD_SEPARATION * CROWD_SEPARATION) continue;

            const distance = Math.sqrt(Math.max(0.0001, distanceSquared));
            const deterministicSide =
              deterministicUnit(left + right, 71) < 0.5 ? -1 : 1;
            if (a.routeId !== b.routeId) {
              const separationSide =
                deterministicSide === -1 ? -1 : 1;
              const push = (CROWD_SEPARATION - distance) * 0.52;
              const previousAOffset = a.lateralOffset;
              const previousBOffset = b.lateralOffset;
              a.lateralOffset = Math.max(
                -a.lateralLimit,
                Math.min(
                  a.lateralLimit,
                  a.lateralOffset - push * separationSide,
                ),
              );
              b.lateralOffset = Math.max(
                -b.lateralLimit,
                Math.min(
                  b.lateralLimit,
                  b.lateralOffset + push * separationSide,
                ),
              );
              a.x = a.centerX + a.normalX * a.lateralOffset;
              a.z = a.centerZ + a.normalZ * a.lateralOffset;
              b.x = b.centerX + b.normalX * b.lateralOffset;
              b.z = b.centerZ + b.normalZ * b.lateralOffset;

              const lateralResolved =
                Math.abs(a.lateralOffset - previousAOffset) +
                Math.abs(b.lateralOffset - previousBOffset);
              if (lateralResolved < push * 0.7) {
                const yielder = deterministicSide < 0 ? a : b;
                const yieldDistance =
                  (CROWD_SEPARATION - distance) * 0.16;
                yielder.x -= yielder.tangentX * yieldDistance;
                yielder.z -= yielder.tangentZ * yieldDistance;
              }
              continue;
            }
            const lateralDelta = b.lateralOffset - a.lateralOffset;
            const separationSide =
              Math.abs(lateralDelta) > 0.01
                ? Math.sign(lateralDelta)
                : deterministicSide;
            const push = (CROWD_SEPARATION - distance) * 0.52;
            const previousAOffset = a.lateralOffset;
            const previousBOffset = b.lateralOffset;
            a.lateralOffset = Math.max(
              -a.lateralLimit,
              Math.min(a.lateralLimit, a.lateralOffset - push * separationSide),
            );
            b.lateralOffset = Math.max(
              -b.lateralLimit,
              Math.min(b.lateralLimit, b.lateralOffset + push * separationSide),
            );
            a.x = a.centerX + a.normalX * a.lateralOffset;
            a.z = a.centerZ + a.normalZ * a.lateralOffset;
            b.x = b.centerX + b.normalX * b.lateralOffset;
            b.z = b.centerZ + b.normalZ * b.lateralOffset;
            const lateralResolved =
              Math.abs(a.lateralOffset - previousAOffset) +
              Math.abs(b.lateralOffset - previousBOffset);
            if (lateralResolved < push * 0.7) {
              const yieldDistance = (CROWD_SEPARATION - distance) * 0.34;
              a.x -= a.tangentX * yieldDistance;
              a.z -= a.tangentZ * yieldDistance;
              b.x -= b.tangentX * yieldDistance;
              b.z -= b.tangentZ * yieldDistance;
            }
          }
        }
      }
    }
  }

  return neighborChecks;
};

export const createCrowdSimulation = (
  beats: readonly PasserbyBeat[],
  actorCount: number,
  durationMs: number,
  seed = DEFAULT_STREET_SEED,
): CrowdSimulation => {
  const count = Math.max(0, Math.min(Math.trunc(actorCount), 48));
  const safeDuration = Math.max(1, Number.isFinite(durationMs) ? durationMs : 1);
  const routes = neighborhoodSidewalkRoutes(seed);

  return Object.freeze({
    sample(elapsedMs: number): CrowdSample {
      if (count === 0 || beats.length === 0) {
        return Object.freeze({ poses: Object.freeze([]), neighborChecks: 0 });
      }

      const poses: (MutableCrowdPose | undefined)[] = Array.from({ length: count }, (_, index) => {
        const beat = beats[(index * 7) % beats.length];
        if (beat === undefined) throw new Error("crowd beat invariant failed");
        if (elapsedMs < beat.startAtMs) return undefined;
        return basePose(beat, index, elapsedMs, safeDuration, routes, seed);
      });

      const neighborChecks = separateCrowd(poses);
      return Object.freeze({
        poses: Object.freeze(
          poses.map((pose) =>
            pose === undefined
              ? undefined
              : Object.freeze({
                  x: pose.x,
                  z: pose.z,
                  heading: pose.heading,
                  pace: pose.pace,
                  worldSpeed: pose.worldSpeed,
                  travelDistance: pose.travelDistance,
                  side: pose.side,
                  routeId: pose.routeId,
                  seesAdvertisement: pose.seesAdvertisement,
                  destinationRole: pose.destinationRole,
                  enteringHome: pose.enteringHome,
                }),
          ),
        ),
        neighborChecks,
      });
    },
  });
};

export const crowdPosesAt = (
  beats: readonly PasserbyBeat[],
  actorCount: number,
  elapsedMs: number,
  durationMs: number,
  seed = DEFAULT_STREET_SEED,
): readonly (CrowdPose | undefined)[] =>
  createCrowdSimulation(beats, actorCount, durationMs, seed).sample(elapsedMs).poses;

export const walkingBodyLift = (
  travelDistance: number,
  heightScale: number,
  walkPace: number,
  strideOffset: number,
): number => {
  const cycle = walkingCycleAtDistance(
    travelDistance,
    heightScale,
    walkPace,
    strideOffset,
  );
  const stance = Math.abs(Math.sin(cycle));
  return 0.018 + stance * 0.028;
};

export type StreetMotion = Readonly<{
  crowdPosesAt: typeof crowdPosesAt;
  sidewalkLaneZ: typeof sidewalkLaneZ;
  openHomeEntryDoors(propertyRoles: readonly string[]): void;
}>;

export const initializeStreetMotion = (
  scene: Scene,
  signs: readonly Readonly<{ root: Group }>[],
  seed = DEFAULT_STREET_SEED,
): StreetMotion => {
  signs.forEach((sign, index) => {
    const position = gardenSignPosition(index);
    sign.root.position.set(position.x, position.y, position.z);
    sign.root.rotation.y = position.rotationY;
    scene.add(sign.root);
  });

  let cachedBeats: readonly PasserbyBeat[] | null = null;
  let cachedActorCount = -1;
  let cachedDurationMs = -1;
  let cachedSimulation: CrowdSimulation | null = null;

  const sampledCrowdPosesAt: typeof crowdPosesAt = (
    beats,
    actorCount,
    elapsedMs,
    durationMs,
  ) => {
    const safeActorCount = Math.max(0, Math.min(Math.trunc(actorCount), 64));
    const safeDurationMs = Math.max(1, Number.isFinite(durationMs) ? durationMs : 1);
    if (
      cachedSimulation === null ||
      cachedBeats !== beats ||
      cachedActorCount !== safeActorCount ||
      cachedDurationMs !== safeDurationMs
    ) {
      cachedBeats = beats;
      cachedActorCount = safeActorCount;
      cachedDurationMs = safeDurationMs;
      cachedSimulation = createCrowdSimulation(
        beats,
        safeActorCount,
        safeDurationMs,
        seed,
      );
    }
    return cachedSimulation.sample(elapsedMs).poses;
  };

  const openHomeEntryDoors = (propertyRoles: readonly string[]): void => {
    if (propertyRoles.length === 0) return;
    const active = new Set(propertyRoles);
    scene.traverse((object) => {
      if (object.userData["sceneRole"] !== "house-door" || !(object instanceof Group)) {
        return;
      }
      let current = object.parent;
      while (current !== null) {
        const propertyRole = current.userData["propertyRole"];
        if (typeof propertyRole === "string") {
          if (active.has(propertyRole)) object.rotation.y = -1.08;
          return;
        }
        current = current.parent;
      }
    });
  };

  return Object.freeze({
    crowdPosesAt: sampledCrowdPosesAt,
    sidewalkLaneZ,
    openHomeEntryDoors,
  });
};
