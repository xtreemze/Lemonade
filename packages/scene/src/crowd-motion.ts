import type { Group, Scene } from "three";

import { walkingCycleAtDistance } from "./gait.js";
import {
  clampToSidewalk,
  gardenSignPosition,
  sidewalkLaneZ,
  sidewalkLaneZForSide,
  sidewalkSideForActor,
  type SidewalkSide,
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
  seesAdvertisement: boolean;
}>;

export type CrowdSample = Readonly<{
  poses: readonly CrowdPose[];
  neighborChecks: number;
}>;

export type CrowdSimulation = Readonly<{
  sample(elapsedMs: number): CrowdSample;
}>;

const CROWD_CELL_SIZE = 0.72;
const CROWD_SEPARATION = 0.46;

const fract = (value: number): number => value - Math.floor(value);

const deterministicUnit = (index: number, salt: number): number => {
  let value = Math.imul((index + 1) >>> 0, 0x9e3779b1) ^ (salt >>> 0);
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0xffff_ffff;
};

export const crowdGroundClearance = (heightScale: number): number =>
  0.225 * Math.max(0.62, Math.min(1.2, Number.isFinite(heightScale) ? heightScale : 1));

const basePose = (
  beat: PasserbyBeat,
  actorIndex: number,
  elapsedMs: number,
  durationMs: number,
  actorCount: number,
): CrowdPose => {
  const safeDuration = Math.max(1, Number.isFinite(durationMs) ? durationMs : 1);
  const durationSeconds = safeDuration / 1_000;
  const count = Math.max(1, actorCount);
  const routeRate = 0.76 + deterministicUnit(actorIndex, 17) * 0.34;
  const phaseOffset = actorIndex / count + deterministicUnit(actorIndex, 29) * 0.11;
  const unwrappedProgress =
    (Math.max(0, elapsedMs) / safeDuration) * routeRate + phaseOffset;
  const progress = fract(unwrappedProgress);
  const direction = beat.direction;
  const startX = direction === -1 ? -12.5 : 12.5;
  const endX = -startX;
  const pathDistance = Math.abs(endX - startX);
  const x = startX + (endX - startX) * progress;

  const side = sidewalkSideForActor(beat.pedestrianIndex);
  const laneBase = sidewalkLaneZForSide(side, beat.lane);
  const meander = Math.sin(progress * Math.PI * 2 + actorIndex * 0.83) * 0.045;
  const attention = beat.seesAdvertisement
    ? Math.exp(-Math.pow((progress - 0.5) / 0.13, 2))
    : 0;
  const signSide = beat.signIndex >= 0 && beat.signIndex % 2 === 0 ? -1 : 1;
  const signPull = attention * signSide * 0.22;
  const standwardDrift = side === "near" ? -attention * 0.07 : -attention * 0.025;
  const z = clampToSidewalk(laneBase + meander + standwardDrift, side, 0.12);

  const worldSpeed = Math.abs(endX - startX) * routeRate / durationSeconds;
  const pace = Math.max(0.72, Math.min(1.7, worldSpeed / 1.55));
  const baseHeading = direction === -1 ? Math.PI / 2 : -Math.PI / 2;
  const attentionHeading =
    signSide * (side === "near" ? 0.48 : 0.32) * attention;
  return Object.freeze({
    x: x + signPull,
    z,
    heading: baseHeading + attentionHeading,
    pace,
    worldSpeed,
    travelDistance: pathDistance * unwrappedProgress,
    side,
    seesAdvertisement: beat.seesAdvertisement,
  });
};

interface MutableCrowdPose {
  x: number;
  z: number;
  heading: number;
  pace: number;
  worldSpeed: number;
  travelDistance: number;
  side: SidewalkSide;
  seesAdvertisement: boolean;
}

const cellCoordinate = (value: number): number => Math.floor(value / CROWD_CELL_SIZE);
const cellKey = (x: number, z: number): string =>
  String(cellCoordinate(x)) + ":" + String(cellCoordinate(z));

const separateCrowd = (poses: MutableCrowdPose[]): number => {
  const cells = new Map<string, number[]>();
  poses.forEach((pose, index) => {
    const key = cellKey(pose.x, pose.z);
    const bucket = cells.get(key);
    if (bucket === undefined) cells.set(key, [index]);
    else bucket.push(index);
  });

  let neighborChecks = 0;
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
          if (b?.side !== a.side) continue;
          neighborChecks += 1;

          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const distanceSquared = dx * dx + dz * dz;
          if (distanceSquared >= CROWD_SEPARATION * CROWD_SEPARATION) continue;

          const distance = Math.sqrt(Math.max(0.0001, distanceSquared));
          const deterministicSide =
            deterministicUnit(left + right, 71) < 0.5 ? -1 : 1;
          const separationSide =
            Math.abs(dz) > 0.01 ? Math.sign(dz) : deterministicSide;
          const push = (CROWD_SEPARATION - distance) * 0.52;
          a.z = clampToSidewalk(a.z - push * separationSide, a.side, 0.1);
          b.z = clampToSidewalk(b.z + push * separationSide, b.side, 0.1);
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
): CrowdSimulation => {
  const count = Math.max(0, Math.min(Math.trunc(actorCount), 48));
  const safeDuration = Math.max(1, Number.isFinite(durationMs) ? durationMs : 1);

  return Object.freeze({
    sample(elapsedMs: number): CrowdSample {
      if (count === 0 || beats.length === 0) {
        return Object.freeze({ poses: Object.freeze([]), neighborChecks: 0 });
      }

      const poses: MutableCrowdPose[] = Array.from({ length: count }, (_, index) => {
        const beat = beats[(index * 7) % beats.length];
        if (beat === undefined) throw new Error("crowd beat invariant failed");
        return { ...basePose(beat, index, elapsedMs, safeDuration, count) };
      });

      const neighborChecks = separateCrowd(poses);
      return Object.freeze({
        poses: Object.freeze(poses.map((pose) => Object.freeze(pose))),
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
): readonly CrowdPose[] =>
  createCrowdSimulation(beats, actorCount, durationMs).sample(elapsedMs).poses;

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
    const safeActorCount = Math.max(0, Math.min(Math.trunc(actorCount), 48));
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
      cachedSimulation = createCrowdSimulation(beats, safeActorCount, safeDurationMs);
    }
    return cachedSimulation.sample(elapsedMs).poses;
  };

  return Object.freeze({
    crowdPosesAt: sampledCrowdPosesAt,
    sidewalkLaneZ,
  });
};
