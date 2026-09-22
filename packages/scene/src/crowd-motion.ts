import type { Group, Scene } from "three";

import { walkingCycleAtDistance } from "./gait.js";
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
}>;

export type CrowdSample = Readonly<{
  poses: readonly (CrowdPose | undefined)[];
  neighborChecks: number;
}>;

export type CrowdSimulation = Readonly<{
  sample(elapsedMs: number): CrowdSample;
}>;

const CROWD_CELL_SIZE = 0.72;
const CROWD_SEPARATION = 0.46;

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

const contiguousSidewalkRuns = (
  strips: readonly StreetStripSpec[],
): readonly (readonly StreetStripSpec[])[] => {
  const ordered = [...strips].sort(
    (left, right) =>
      Math.floor(left.segmentIndex / 2) - Math.floor(right.segmentIndex / 2),
  );
  const runs: StreetStripSpec[][] = [];
  for (const strip of ordered) {
    const current = runs.at(-1);
    if (current === undefined) {
      runs.push([strip]);
      continue;
    }
    const previous = current.at(-1);
    if (previous === undefined) {
      current.push(strip);
      continue;
    }

    const previousRoadSegment = Math.floor(previous.segmentIndex / 2);
    const currentRoadSegment = Math.floor(strip.segmentIndex / 2);
    const previousEnd = sidewalkEndpoint(previous, 1);
    const currentStart = sidewalkEndpoint(strip, -1);
    const gap = Math.hypot(
      currentStart.x - previousEnd.x,
      currentStart.z - previousEnd.z,
    );
    if (currentRoadSegment !== previousRoadSegment + 1 || gap > 0.75) {
      runs.push([strip]);
      continue;
    }
    current.push(strip);
  }
  return Object.freeze(runs.map((run) => Object.freeze(run)));
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
        return contiguousSidewalkRuns(strips).map((run, runIndex) =>
          makePedestrianRoute(
            key + ":" + String(runIndex),
            streetId,
            side,
            run,
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
): MutableCrowdPose | undefined => {
  const safeDuration = Math.max(1, Number.isFinite(durationMs) ? durationMs : 1);
  const worldSpeed = 1.18 + deterministicUnit(actorIndex, 17) * 0.26;
  const elapsedSeconds =
    Math.max(
      0,
      Math.min(elapsedMs - beat.startAtMs, safeDuration * 8),
    ) / 1_000;

  const mainRoutes = routes.filter((route) => route.streetId === "main");
  const neighborhoodRoutes = routes.filter(
    (route) => route.streetId !== "main" && routeSupportsSideEntry(route),
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
  const route =
    (beat.seesAdvertisement ? mainRoute : neighborhoodRoute) ??
    routes[actorIndex % Math.max(1, routes.length)];
  if (route === undefined) {
    throw new Error("crowd motion requires generated sidewalk routes");
  }

  const requestedEntryOffset = beat.seesAdvertisement
    ? 10 + deterministicUnit(actorIndex, 29) * 6
    : 38 + deterministicUnit(actorIndex, 29) * 18;
  const sideEntryOffset = Math.min(route.total * 0.42, requestedEntryOffset);
  const spawnDistance =
    beat.direction === -1
      ? Math.max(0, route.total / 2 - sideEntryOffset)
      : Math.min(route.total, route.total / 2 + sideEntryOffset);
  const distanceTravelled = elapsedSeconds * worldSpeed;
  const routeDistance =
    beat.direction === -1
      ? spawnDistance + distanceTravelled
      : spawnDistance - distanceTravelled;
  if (routeDistance < 0 || routeDistance > route.total) return undefined;
  const progress = routeDistance / route.total;
  const sampled = samplePedestrianRoute(route, routeDistance);
  const travelYaw =
    sampled.yaw + (beat.direction === -1 ? 0 : Math.PI);
  const normalX = -Math.sin(sampled.yaw);
  const normalZ = Math.cos(sampled.yaw);
  const laneFraction = (Math.abs(Math.trunc(beat.lane)) % 4) / 3;
  const lateralLimit = Math.max(0.2, route.width / 2 - 0.22);
  const laneOffset = (laneFraction - 0.5) * lateralLimit * 1.45;
  const meander =
    Math.sin(progress * Math.PI * 2 + actorIndex * 0.83) * 0.045;
  const lateralOffset = Math.max(
    -lateralLimit,
    Math.min(lateralLimit, laneOffset + meander),
  );

  const attention = beat.seesAdvertisement
    ? Math.exp(-Math.pow((progress - 0.5) / 0.13, 2))
    : 0;
  const signSide = beat.signIndex >= 0 && beat.signIndex % 2 === 0 ? -1 : 1;
  const signPull = attention * signSide * 0.22;
  const attentionHeading =
    signSide * (route.side === "near" ? 0.48 : 0.32) * attention;
  const heading = Math.PI / 2 - travelYaw + attentionHeading;

  return {
    x: sampled.x + normalX * lateralOffset + (route.streetId === "main" ? signPull : 0),
    z: sampled.z + normalZ * lateralOffset,
    heading,
    pace: Math.max(0.82, Math.min(1.18, worldSpeed / 1.3)),
    worldSpeed,
    travelDistance: distanceTravelled,
    side: route.side,
    routeId: route.id,
    seesAdvertisement: beat.seesAdvertisement,
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
              const yieldDistance = (CROWD_SEPARATION - distance) * 0.58;
              a.x -= a.tangentX * yieldDistance;
              a.z -= a.tangentZ * yieldDistance;
              b.x -= b.tangentX * yieldDistance;
              b.z -= b.tangentZ * yieldDistance;
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
        if (elapsedMs < beat.startAtMs || elapsedMs >= beat.endAtMs) return undefined;
        return basePose(beat, index, elapsedMs, safeDuration, routes);
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

  return Object.freeze({
    crowdPosesAt: sampledCrowdPosesAt,
    sidewalkLaneZ,
  });
};
