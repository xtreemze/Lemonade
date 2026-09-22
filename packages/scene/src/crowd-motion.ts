import type { Group, Scene } from "three";

import {
  clampToNearSidewalk,
  gardenSignPosition,
  sidewalkLaneZ,
} from "./street-layout.js";
import { walkingCycleAtDistance } from "./gait.js";
import type { PasserbyBeat } from "./storyboard.js";

export { gardenSignPosition, sidewalkLaneZ };

export type CrowdPose = Readonly<{
  x: number;
  z: number;
  heading: number;
  pace: number;
  travelDistance: number;
  seesAdvertisement: boolean;
}>;

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
  const count = Math.max(1, actorCount);
  const speedMultiplier = 0.76 + deterministicUnit(actorIndex, 17) * 0.34;
  const phaseOffset = actorIndex / count + deterministicUnit(actorIndex, 29) * 0.11;
  const unwrappedProgress =
    (Math.max(0, elapsedMs) / safeDuration) * speedMultiplier + phaseOffset;
  const progress = fract(unwrappedProgress);
  const direction = beat.direction;
  const startX = direction === -1 ? -12.5 : 12.5;
  const endX = -startX;
  const pathDistance = Math.abs(endX - startX);
  const x = startX + (endX - startX) * progress;
  const worldSpeed = pathDistance * speedMultiplier / (safeDuration / 1000);

  const laneBase = sidewalkLaneZ(beat.lane);
  const meander = Math.sin(progress * Math.PI * 2 + actorIndex * 0.83) * 0.045;
  const attention = beat.seesAdvertisement
    ? Math.exp(-Math.pow((progress - 0.5) / 0.13, 2))
    : 0;
  const signSide = beat.signIndex >= 0 && beat.signIndex % 2 === 0 ? -1 : 1;
  const signPull = attention * signSide * 0.22;
  const z = clampToNearSidewalk(laneBase + meander - attention * 0.07, 0.12);

  const baseHeading = direction === -1 ? Math.PI / 2 : -Math.PI / 2;
  const attentionHeading = signSide * 0.48 * attention;
  return Object.freeze({
    x: x + signPull,
    z,
    heading: baseHeading + attentionHeading,
    pace: worldSpeed,
    travelDistance: pathDistance * unwrappedProgress,
    seesAdvertisement: beat.seesAdvertisement,
  });
};

export const crowdPosesAt = (
  beats: readonly PasserbyBeat[],
  actorCount: number,
  elapsedMs: number,
  durationMs: number,
): readonly CrowdPose[] => {
  const count = Math.max(0, Math.min(Math.trunc(actorCount), 48));
  if (count === 0 || beats.length === 0) return Object.freeze([]);

  const poses = Array.from({ length: count }, (_, index) => {
    const beat = beats[(index * 7) % beats.length];
    if (beat === undefined) {
      throw new Error("crowd beat invariant failed");
    }
    return { ...basePose(beat, index, elapsedMs, durationMs, count) };
  });

  // Deterministic local separation keeps walkers from occupying the same
  // sidewalk space without allowing avoidance to spill them into the road.
  for (let pass = 0; pass < 2; pass += 1) {
    for (let left = 0; left < poses.length; left += 1) {
      const a = poses[left];
      if (a === undefined) continue;
      for (let right = left + 1; right < poses.length; right += 1) {
        const b = poses[right];
        if (b === undefined) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const distanceSquared = dx * dx + dz * dz;
        if (distanceSquared >= 0.46 * 0.46) continue;
        const direction = deterministicUnit(left + right, pass + 71) < 0.5 ? -1 : 1;
        const push = (0.46 - Math.sqrt(Math.max(0.0001, distanceSquared))) * 0.52;
        a.z = clampToNearSidewalk(a.z - push * direction, 0.1);
        b.z = clampToNearSidewalk(b.z + push * direction, 0.1);
      }
    }
  }

  return Object.freeze(poses.map((pose) => Object.freeze(pose)));
};

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
  return Object.freeze({ crowdPosesAt, sidewalkLaneZ });
};
