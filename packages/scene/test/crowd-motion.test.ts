import { Group, Scene } from "three";
import { describe, expect, it } from "vitest";

import {
  ambientPopulationFor,
  birdFlightProfileFor,
  createAmbientLife,
  petFollowPose,
  vehicleVariantSpec,
  xTravelYaw,
} from "../src/ambient-life.js";
import {
  createCrowdSimulation,
  crowdGroundClearance,
  crowdPosesAt,
  neighborhoodSidewalkRoutes,
  walkingBodyLift,
} from "../src/crowd-motion.js";
import { walkingCycleAtDistance } from "../src/gait.js";
import {
  generateStreetNetwork,
  STREET_LAYOUT,
  roadLaneZ,
  type StreetStripSpec,
} from "../src/street-layout.js";
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

const pointIsInsideStrip = (
  x: number,
  z: number,
  strip: StreetStripSpec,
  margin = 0.08,
): boolean => {
  const dx = x - strip.x;
  const dz = z - strip.z;
  const cos = Math.cos(strip.rotationY);
  const sin = Math.sin(strip.rotationY);
  const localX = cos * dx + sin * dz;
  const localZ = -sin * dx + cos * dz;
  return (
    Math.abs(localX) <= strip.length / 2 + margin &&
    Math.abs(localZ) <= strip.width / 2 + margin
  );
};

const pointIsOnGeneratedStrip = (
  x: number,
  z: number,
  strips: readonly StreetStripSpec[],
): boolean => strips.some((strip) => pointIsInsideStrip(x, z, strip));

describe("crowd motion", () => {
  it("keeps deterministic pedestrian paths separated and entirely on the sidewalk", () => {
    const first = crowdPosesAt(beats, 12, 2_750, 6_000);
    const repeated = crowdPosesAt(beats, 12, 2_750, 6_000);
    expect(repeated).toEqual(first);
    expect(first).toHaveLength(12);

    expect(new Set(first.map((pose) => pose?.side).filter(Boolean))).toEqual(
      new Set(["near", "far"]),
    );
    const routeIds = new Set(first.map((pose) => pose?.routeId).filter(Boolean));
    expect(routeIds.size).toBeGreaterThan(4);
    expect(routeIds.has("main:0")).toBe(true);
    expect(routeIds.has("main:1")).toBe(true);
    const generatedRouteIds = new Set(
      neighborhoodSidewalkRoutes().map((route) => route.id),
    );
    const generatedSidewalks = generateStreetNetwork().sidewalks;
    for (const pose of first) {
      if (pose === undefined) continue;
      expect(Number.isFinite(pose.x)).toBe(true);
      expect(Number.isFinite(pose.z)).toBe(true);
      expect(generatedRouteIds.has(pose.routeId)).toBe(true);
      expect(
        pointIsOnGeneratedStrip(pose.x, pose.z, generatedSidewalks),
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

  it("keeps pets on sidewalks and traffic on generated roads as neighborhood routes turn", () => {
    const scene = new Scene();
    const owner = new Group();
    owner.visible = true;
    owner.position.set(2, 0, 1.2);
    owner.rotation.y = Math.PI / 2 + 0.42;
    scene.add(owner);

    const seed = 17;
    const ambient = createAmbientLife(scene, seed, [owner]);
    ambient.update("sunny", "simulation", 2_000, 6_000);
    const network = generateStreetNetwork(seed);

    const pet = scene.children.find(
      (object) =>
        object.userData["sceneRole"] === "ambient-pet" && object.visible,
    );
    const bicycles = scene.children.filter(
      (object) =>
        object.userData["sceneRole"] === "ambient-bicycle" && object.visible,
    );
    const vehicles = scene.children.filter(
      (object) =>
        object.userData["sceneRole"] === "ambient-vehicle" && object.visible,
    );

    expect(pet).toBeDefined();
    expect(pet?.position.x).toBeLessThan(owner.position.x);
    expect(
      pet !== undefined &&
        pointIsOnGeneratedStrip(
          pet.position.x,
          pet.position.z,
          network.sidewalks,
        ),
    ).toBe(true);

    expect(bicycles.length).toBeGreaterThan(0);
    expect(vehicles.length).toBeGreaterThan(0);
    for (const actor of [...bicycles, ...vehicles]) {
      expect(Number.isFinite(actor.rotation.y)).toBe(true);
      const mobilityActorId: unknown = actor.userData["mobilityActorId"];
      if (mobilityActorId === "resident-vehicle") continue;
      expect(
        pointIsOnGeneratedStrip(
          actor.position.x,
          actor.position.z,
          network.roads,
        ),
      ).toBe(true);
    }
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

  it("derives deterministic varied bird flight profiles from the scene seed", () => {
    const first = Array.from({ length: 4 }, (_, index) =>
      birdFlightProfileFor(0x1ead2026, index),
    );
    const repeated = Array.from({ length: 4 }, (_, index) =>
      birdFlightProfileFor(0x1ead2026, index),
    );
    const alternate = Array.from({ length: 4 }, (_, index) =>
      birdFlightProfileFor(0x1ead2027, index),
    );

    expect(repeated).toEqual(first);
    expect(alternate).not.toEqual(first);
    expect(new Set(first.map((profile) => profile.direction))).toEqual(
      new Set([-1, 1]),
    );
    expect(new Set(first.map((profile) => profile.depth)).size).toBe(4);
    expect(new Set(first.map((profile) => profile.altitude)).size).toBe(4);
    for (const profile of first) {
      expect(profile.speed).toBeGreaterThanOrEqual(0.54);
      expect(profile.speed).toBeLessThanOrEqual(0.88);
      expect(profile.scale).toBeGreaterThanOrEqual(0.88);
      expect(profile.scale).toBeLessThanOrEqual(1.16);
    }
  });

  it("flies sunny-day birds across town in both street directions", () => {
    const scene = new Scene();
    const ambient = createAmbientLife(scene, 0x1ead2026, []);
    ambient.update("sunny", "simulation", 2_000, 10_000);

    const birds = scene.children.filter(
      (object) => object.userData["sceneRole"] === "ambient-bird" && object.visible,
    );
    expect(birds).toHaveLength(4);
    expect(birds.some((bird) => Math.abs(bird.rotation.y) < 0.01)).toBe(true);
    expect(birds.some((bird) => Math.abs(Math.abs(bird.rotation.y) - Math.PI) < 0.01)).toBe(true);

    ambient.update("cloudy", "simulation", 2_000, 10_000);
    expect(
      birds.every((bird) => !bird.visible),
    ).toBe(true);
  });

  it("uses a reusable spatial crowd sampler with travel-aligned gait speed", () => {
    const simulation = createCrowdSimulation(beats, 12, 6_000);
    const sample = simulation.sample(2_750);
    const repeated = simulation.sample(2_750);

    expect(repeated.poses).toEqual(sample.poses);
    expect(sample.poses).toHaveLength(12);
    expect(sample.neighborChecks).toBeLessThan(12 * 11 / 2);

    for (const pose of sample.poses) {
      if (pose === undefined) continue;
      expect(pose.worldSpeed).toBeGreaterThan(0);
      expect(pose.pace).toBeGreaterThan(0);
      expect(Number.isFinite(pose.heading)).toBe(true);
      expect(pose.routeId.length).toBeGreaterThan(0);
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
    const allPoses = [...early, ...late].filter((pose) => pose !== undefined);
    const extent = allPoses.reduce(
      (max, pose) => Math.max(max, Math.abs(pose.x)),
      0,
    );
    expect(extent).toBeGreaterThan(42);
    for (const pose of allPoses) {
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
      wildlife: 4,
      bicycles: 3,
      vehicles: 8,
    });
    expect(ambientPopulationFor("cloudy", "simulation")).toMatchObject({
      wildlife: 0,
      bicycles: 2,
      vehicles: 8,
    });
    expect(ambientPopulationFor("hot-and-dry", "simulation")).toMatchObject({
      wildlife: 0,
      bicycles: 2,
      vehicles: 8,
    });
    expect(ambientPopulationFor("thunderstorm", "simulation")).toEqual({
      pets: 0,
      wildlife: 0,
      bicycles: 0,
      vehicles: 4,
    });
    expect(ambientPopulationFor("sunny", "forecast")).toEqual({
      pets: 0,
      wildlife: 0,
      bicycles: 0,
      vehicles: 2,
    });
  });
});
