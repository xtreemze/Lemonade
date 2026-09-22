import { Group, Scene } from "three";
import { describe, expect, it } from "vitest";

import {
  ambientPopulationFor,
  createAmbientLife,
  petFollowPose,
  xTravelYaw,
} from "../src/ambient-life.js";
import {
  createCrowdSimulation,
  crowdGroundClearance,
  crowdPosesAt,
  walkingBodyLift,
} from "../src/crowd-motion.js";
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

    expect(new Set(first.map((pose) => pose.side))).toEqual(
      new Set(["near", "far"]),
    );
    for (const pose of first) {
      expect(Math.abs(pose.x)).toBeLessThanOrEqual(12.8);
      const sidewalk =
        pose.side === "near"
          ? STREET_LAYOUT.nearSidewalk
          : STREET_LAYOUT.farSidewalk;
      expect(pose.z).toBeGreaterThanOrEqual(sidewalk.minZ);
      expect(pose.z).toBeLessThanOrEqual(sidewalk.maxZ);
      expect(
        pose.z < STREET_LAYOUT.road.minZ ||
          pose.z > STREET_LAYOUT.road.maxZ,
      ).toBe(true);
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

    const farOwner = Object.freeze({
      x: -2,
      z: 8.7,
      heading: -Math.PI / 2,
    });
    const farPet = petFollowPose(farOwner, 1);
    expect(farPet.x).toBeGreaterThan(farOwner.x);
    expect(farPet.z).toBeGreaterThanOrEqual(STREET_LAYOUT.farSidewalk.minZ);
    expect(farPet.z).toBeLessThanOrEqual(STREET_LAYOUT.farSidewalk.maxZ);
    expect(Math.abs(farPet.yaw)).toBeCloseTo(Math.PI);
  });

  it("keeps pet travel aligned to the street while the owner glances at an ad", () => {
    const scene = new Scene();
    const owner = new Group();
    owner.visible = true;
    owner.position.set(2, 0, 1.2);
    owner.rotation.y = Math.PI / 2 + 0.42;
    scene.add(owner);

    const ambient = createAmbientLife(scene, 17, [owner]);
    ambient.update("sunny", "simulation", 2_000, 6_000);

    const pet = scene.children.find(
      (object) => object.userData["sceneRole"] === "ambient-pet",
    );
    const bicycle = scene.children.find(
      (object) => object.userData["sceneRole"] === "ambient-bicycle",
    );
    const vehicle = scene.children.find(
      (object) => object.userData["sceneRole"] === "ambient-vehicle",
    );

    expect(pet?.visible).toBe(true);
    expect(pet?.position.x).toBeLessThan(owner.position.x);
    expect(pet?.rotation.y).toBeCloseTo(0);
    expect(pet?.position.z).toBeLessThan(STREET_LAYOUT.road.minZ);

    expect(Math.abs(bicycle?.rotation.y ?? 0)).toBeCloseTo(Math.PI);
    expect(bicycle?.position.z).toBeGreaterThan(STREET_LAYOUT.road.minZ);
    expect(vehicle?.rotation.y).toBeCloseTo(0);
    expect(vehicle?.position.z).toBeGreaterThan(STREET_LAYOUT.road.minZ);
  });

  it("uses a reusable spatial crowd sampler with travel-aligned gait speed", () => {
    const simulation = createCrowdSimulation(beats, 12, 6_000);
    const sample = simulation.sample(2_750);
    const repeated = simulation.sample(2_750);

    expect(repeated.poses).toEqual(sample.poses);
    expect(sample.poses).toHaveLength(12);
    expect(sample.neighborChecks).toBeLessThan(12 * 11 / 2);

    for (const pose of sample.poses) {
      expect(pose.worldSpeed).toBeGreaterThan(0);
      expect(pose.pace).toBeGreaterThan(0);
      const travelHeading = pose.heading > 0 ? Math.PI / 2 : -Math.PI / 2;
      expect(Math.abs(pose.heading - travelHeading)).toBeLessThan(0.6);
    }
  });

  it("provides enough ground clearance for adult and child seeded heights", () => {
    expect(crowdGroundClearance(0.68)).toBeGreaterThan(0.14);
    expect(crowdGroundClearance(0.9)).toBeGreaterThan(0.2);
    expect(crowdGroundClearance(1.2)).toBeGreaterThan(0.26);
    expect(walkingBodyLift(0.5, 1, 1, 0)).toBeGreaterThan(0);
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
