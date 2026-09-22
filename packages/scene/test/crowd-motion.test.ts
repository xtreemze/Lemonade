import { describe, expect, it } from "vitest";

import {
  ambientPopulationFor,
  petFollowPose,
  xTravelYaw,
} from "../src/ambient-life.js";
import {
  crowdGroundClearance,
  crowdPosesAt,
  walkingBodyLift,
} from "../src/crowd-motion.js";
import { walkingCycleAtDistance } from "../src/gait.js";
import { STREET_LAYOUT, roadLaneZ } from "../src/street-layout.js";
import type { PasserbyBeat } from "../src/storyboard.js";

const beats: readonly PasserbyBeat[] = Object.freeze(
  Array.from({ length: 12 }, (_, index) =>
    Object.freeze({
      pedestrianIndex: index,
      startAtMs: 0,
      endAtMs: 6_000,
      direction: index % 2 === 0 ? -1 as const : 1 as const,
      lane: index % 4,
      seesAdvertisement: index < 3,
      signIndex: index < 3 ? index : -1,
    }),
  ),
);

describe("crowd motion", () => {
  it("keeps deterministic pedestrian paths separated and entirely on the sidewalk", () => {
    const first = crowdPosesAt(beats, 12, 2_750, 6_000);
    const repeated = crowdPosesAt(beats, 12, 2_750, 6_000);
    expect(repeated).toEqual(first);
    expect(first).toHaveLength(12);

    for (const pose of first) {
      expect(Math.abs(pose.x)).toBeLessThanOrEqual(12.8);
      expect(pose.z).toBeGreaterThanOrEqual(STREET_LAYOUT.nearSidewalk.minZ);
      expect(pose.z).toBeLessThanOrEqual(STREET_LAYOUT.nearSidewalk.maxZ);
      expect(pose.z).toBeLessThan(STREET_LAYOUT.road.minZ);
    }

    for (let left = 0; left < first.length; left += 1) {
      const a = first[left];
      if (a === undefined) continue;
      for (let right = left + 1; right < first.length; right += 1) {
        const b = first[right];
        if (b === undefined) continue;
        const distance = Math.hypot(a.x - b.x, a.z - b.z);
        expect(distance).toBeGreaterThan(0.24);
      }
    }
  });

  it("keeps bicycles and vehicles in paved-road lanes and faces X-axis travel", () => {
    for (const kind of ["bicycle", "vehicle"] as const) {
      for (let index = 0; index < 2; index += 1) {
        const z = roadLaneZ(kind, index);
        expect(z).toBeGreaterThan(STREET_LAYOUT.road.minZ);
        expect(z).toBeLessThan(STREET_LAYOUT.road.maxZ);
      }
    }
    expect(xTravelYaw(1)).toBeCloseTo(0);
    expect(Math.abs(xTravelYaw(-1))).toBeCloseTo(Math.PI);
  });

  it("keeps pets behind their pedestrian owner on the same sidewalk", () => {
    const owner = Object.freeze({ x: 2, z: 1.2, heading: Math.PI / 2 });
    const pet = petFollowPose(owner, 0);
    expect(pet.x).toBeLessThan(owner.x);
    expect(pet.z).toBeGreaterThanOrEqual(STREET_LAYOUT.nearSidewalk.minZ);
    expect(pet.z).toBeLessThanOrEqual(STREET_LAYOUT.nearSidewalk.maxZ);
    expect(pet.yaw).toBeCloseTo(0);
  });

  it("provides enough ground clearance for adult and child seeded heights", () => {
    expect(crowdGroundClearance(0.68)).toBeGreaterThan(0.14);
    expect(crowdGroundClearance(0.9)).toBeGreaterThan(0.2);
    expect(crowdGroundClearance(1.2)).toBeGreaterThan(0.26);
    expect(walkingBodyLift(0.5, 0.9, 1, 0)).toBeGreaterThan(0);
  });

  it("advances gait from actual distance travelled rather than presentation time", () => {
    const earlier = crowdPosesAt(beats, 1, 1_000, 6_000)[0];
    const later = crowdPosesAt(beats, 1, 1_100, 6_000)[0];
    expect(earlier).toBeDefined();
    expect(later).toBeDefined();
    if (earlier === undefined || later === undefined) return;

    expect(later.travelDistance - earlier.travelDistance).toBeCloseTo(
      earlier.pace * 0.1,
      5,
    );
    expect(
      walkingCycleAtDistance(later.travelDistance, 1, 1, 0),
    ).toBeGreaterThan(
      walkingCycleAtDistance(earlier.travelDistance, 1, 1, 0),
    );
  });

  it("reduces exposed street life in storms without changing simulation population math", () => {
    expect(ambientPopulationFor("sunny", "simulation")).toEqual({
      pets: 2,
      wildlife: 2,
      bicycles: 2,
      vehicles: 1,
    });
    expect(ambientPopulationFor("thunderstorm", "simulation")).toEqual({
      pets: 0,
      wildlife: 0,
      bicycles: 0,
      vehicles: 2,
    });
    expect(ambientPopulationFor("sunny", "forecast")).toEqual({
      pets: 0,
      wildlife: 0,
      bicycles: 0,
      vehicles: 0,
    });
  });
});
