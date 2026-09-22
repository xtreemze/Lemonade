import { Group, Scene } from "three";
import { describe, expect, it } from "vitest";

import {
  ambientPopulationFor,
  createAmbientLife,
  petFollowPose,
  vehicleVariantSpec,
  xTravelYaw,
} from "../src/ambient-life.js";
import {
  createCrowdSimulation,
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

    expect(new Set(first.map((pose) => pose.side))).toEqual(
      new Set(["near", "far"]),
    );
    for (const pose of first) {
      expect(Math.abs(pose.x)).toBeLessThanOrEqual(106);
      expect(pose.z).toBeGreaterThanOrEqual(pose.routeMinZ);
      expect(pose.z).toBeLessThanOrEqual(pose.routeMaxZ);
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
        expect(distance).toBeGreaterThan(0.42);
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

  it("uses road-scale dimensions for sedan, sports, pickup, and truck bodies", () => {
    const sedan = vehicleVariantSpec("sedan");
    const sports = vehicleVariantSpec("sports");
    const pickup = vehicleVariantSpec("pickup");
    const truck = vehicleVariantSpec("truck");

    for (const spec of [sedan, sports, pickup, truck]) {
      expect(spec.length).toBeGreaterThan(4);
      expect(spec.width).toBeGreaterThan(1.7);
      expect(spec.wheelRadius).toBeGreaterThan(0.3);
    }
    expect(sports.bodyHeight).toBeLessThan(sedan.bodyHeight);
    expect(pickup.length).toBeGreaterThan(sedan.length);
    expect(truck.length).toBeGreaterThan(pickup.length);
    expect(truck.cabinHeight).toBeGreaterThan(sedan.cabinHeight);
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

  it("gives cyclists and drivers the same facial hair and clothing detail system", () => {
    const scene = new Scene();
    const ambient = createAmbientLife(scene, 0x1ead2026, []);
    ambient.update("sunny", "simulation", 2_000, 6_000);

    for (const role of ["ambient-rider", "ambient-driver"] as const) {
      let actor: Group | undefined;
      scene.traverse((object) => {
        if (object.userData["sceneRole"] === role && object instanceof Group) {
          actor = object;
        }
      });
      expect(actor).toBeDefined();
      if (actor === undefined) continue;

      const roles = new Set<string>();
      actor.traverse((object) => {
        const sceneRole: unknown = object.userData["sceneRole"];
        if (typeof sceneRole === "string") roles.add(sceneRole);
      });
      expect(roles.has("eye-white")).toBe(true);
      expect(roles.has("eye-pupil")).toBe(true);
      expect(roles.has("hair-cover")).toBe(true);
      expect(roles.has("hair-detail")).toBe(true);
      expect(roles.has("garment-detail")).toBe(true);
    }
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

  it("advances gait phase from measured world-space travel distance", () => {
    const earlier = crowdPosesAt(beats, 1, 1_000, 6_000)[0];
    const later = crowdPosesAt(beats, 1, 1_100, 6_000)[0];
    expect(earlier).toBeDefined();
    expect(later).toBeDefined();
    if (earlier === undefined || later === undefined) return;

    expect(later.travelDistance - earlier.travelDistance).toBeCloseTo(
      earlier.worldSpeed * 0.1,
      5,
    );
    expect(
      walkingCycleAtDistance(later.travelDistance, 1, 1, 0),
    ).toBeGreaterThan(
      walkingCycleAtDistance(earlier.travelDistance, 1, 1, 0),
    );
  });

  it("keeps walkers moving through the wider neighborhood at normal walking speed", () => {
    const early = crowdPosesAt(beats, 12, 250, 6_000);
    const late = crowdPosesAt(beats, 12, 5_750, 6_000);
    const extent = [...early, ...late].reduce(
      (max, pose) => Math.max(max, Math.abs(pose.x)),
      0,
    );
    expect(extent).toBeGreaterThan(42);
    for (const pose of [...early, ...late]) {
      expect(pose.worldSpeed).toBeGreaterThanOrEqual(1.15);
      expect(pose.worldSpeed).toBeLessThanOrEqual(2.05);
    }
  });

  it("provides enough ground clearance for adult and child seeded heights", () => {
    expect(crowdGroundClearance(0.68)).toBeGreaterThan(0.11);
    expect(crowdGroundClearance(0.9)).toBeGreaterThan(0.15);
    expect(crowdGroundClearance(1.2)).toBeGreaterThan(0.21);
    expect(walkingBodyLift(0.5, 1, 1, 0)).toBeGreaterThan(0);
  });

  it("reduces exposed street life in storms without changing simulation population math", () => {
    expect(ambientPopulationFor("sunny", "simulation")).toEqual({
      pets: 2,
      wildlife: 3,
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
