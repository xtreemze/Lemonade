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
import { PASSERBY_BASE_ACTIVE_COUNT, PASSERBY_FOREGROUND_TARGET } from "../src/scene-capacity.js";
import type { PasserbyBeat } from "../src/storyboard.js";
import { createStreetStoryboard } from "../src/storyboard-create.js";
import {
  generateStreetNetwork,
  roadLaneZ,
  STREET_LAYOUT,
  type StreetStripSpec,
} from "../src/street-layout.js";

const beats: readonly PasserbyBeat[] = Object.freeze(
  Array.from({ length: 12 }, (_, index) =>
    Object.freeze({
      pedestrianIndex: index,
      startAtMs: 0,
      endAtMs: 6000,
      direction: index % 2 === 0 ? (-1 as const) : (1 as const),
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
    Math.abs(localX) <= strip.length / 2 + margin && Math.abs(localZ) <= strip.width / 2 + margin
  );
};

const pointIsOnGeneratedStrip = (
  x: number,
  z: number,
  strips: readonly StreetStripSpec[],
): boolean => strips.some((strip) => pointIsInsideStrip(x, z, strip));

describe("crowd motion", () => {
  it("keeps deterministic pedestrian paths separated and entirely on the sidewalk", () => {
    const first = crowdPosesAt(beats, 12, 2750, 6000);
    const repeated = crowdPosesAt(beats, 12, 2750, 6000);
    expect(repeated).toEqual(first);
    expect(first).toHaveLength(12);

    expect(new Set(first.map((pose) => pose?.side).filter(Boolean))).toEqual(
      new Set(["near", "far"]),
    );
    const routeIds = new Set(
      first
        .map((pose) => pose?.routeId)
        .filter((routeId): routeId is string => routeId !== undefined),
    );
    expect(routeIds.size).toBeGreaterThan(4);
    expect([...routeIds].some((routeId) => routeId.startsWith("main:0"))).toBe(true);
    expect([...routeIds].some((routeId) => routeId.startsWith("main:1"))).toBe(true);
    const generatedRouteIds = new Set(neighborhoodSidewalkRoutes().map((route) => route.id));
    const generatedSidewalks = generateStreetNetwork().sidewalks;
    for (const pose of first) {
      if (pose === undefined) {
        continue;
      }
      expect(Number.isFinite(pose.x)).toBe(true);
      expect(Number.isFinite(pose.z)).toBe(true);
      expect(generatedRouteIds.has(pose.routeId)).toBe(true);
      expect(pointIsOnGeneratedStrip(pose.x, pose.z, generatedSidewalks)).toBe(true);
    }

    for (let left = 0; left < first.length; left += 1) {
      const a = first[left];
      if (a === undefined) {
        continue;
      }
      for (let right = left + 1; right < first.length; right += 1) {
        const b = first[right];
        if (b === undefined) {
          continue;
        }
        const distance = Math.hypot(a.x - b.x, a.z - b.z);
        expect(distance).toBeGreaterThan(0.42);
      }
    }
  });

  it("keeps sidewalk routes contiguous and prevents frame-to-frame pedestrian teleports", () => {
    const routes = neighborhoodSidewalkRoutes();
    for (const route of routes) {
      for (let index = 1; index < route.strips.length; index += 1) {
        const previous = route.strips[index - 1];
        const current = route.strips[index];
        if (previous === undefined || current === undefined) {
          continue;
        }
        expect(Math.floor(current.segmentIndex / 2)).toBe(
          Math.floor(previous.segmentIndex / 2) + 1,
        );
      }
    }

    const longBeats = Object.freeze(
      beats.map((beat) =>
        Object.freeze({
          ...beat,
          startAtMs: 0,
          endAtMs: 12_000,
        }),
      ),
    );
    const simulation = createCrowdSimulation(longBeats, 12, 12_000);
    let previous = simulation.sample(0).poses;
    for (let elapsedMs = 100; elapsedMs < 12_000; elapsedMs += 100) {
      const current = simulation.sample(elapsedMs).poses;
      for (let index = 0; index < current.length; index += 1) {
        const before = previous[index];
        const after = current[index];
        if (before === undefined || after === undefined) {
          continue;
        }
        expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(1.25);
      }
      previous = current;
    }
  });

  it("uses left/right side-entry routes instead of top/bottom pedestrian approaches", () => {
    const sample = crowdPosesAt(beats, 12, 2750, 6000);
    const routes = new Map(neighborhoodSidewalkRoutes().map((route) => [route.id, route] as const));
    for (const pose of sample) {
      if (pose === undefined) {
        continue;
      }
      const route = routes.get(pose.routeId);
      expect(route).toBeDefined();
      if (route === undefined) {
        continue;
      }
      const first = route.points[0];
      const last = route.points.at(-1);
      expect(first).toBeDefined();
      expect(last).toBeDefined();
      if (first === undefined || last === undefined) {
        continue;
      }
      expect(Math.abs(last.x - first.x)).toBeGreaterThanOrEqual(Math.abs(last.z - first.z));
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

  it("does not rebind a visible pet to another pedestrian when its owner disappears", () => {
    const scene = new Scene();
    const firstOwner = new Group();
    firstOwner.visible = true;
    firstOwner.position.set(-12, 0, STREET_LAYOUT.nearSidewalk.centerZ);
    firstOwner.rotation.y = Math.PI / 2;
    const secondOwner = new Group();
    secondOwner.visible = true;
    secondOwner.position.set(12, 0, STREET_LAYOUT.nearSidewalk.centerZ);
    secondOwner.rotation.y = Math.PI / 2;
    scene.add(firstOwner, secondOwner);

    const ambient = createAmbientLife(scene, 0x51_a7, [firstOwner, secondOwner]);
    ambient.update("sunny", "simulation", 2000, 14_000);

    const firstPet = scene.children
      .filter((object) => object.userData["sceneRole"] === "ambient-pet")
      .find((pet) => pet.visible && Math.abs(pet.position.x - firstOwner.position.x) < 2);
    const secondPet = scene.children
      .filter((object) => object.userData["sceneRole"] === "ambient-pet")
      .find((pet) => pet.visible && Math.abs(pet.position.x - secondOwner.position.x) < 2);
    expect(firstPet).toBeDefined();
    expect(secondPet).toBeDefined();
    if (firstPet === undefined || secondPet === undefined) {
      return;
    }

    firstOwner.visible = false;
    ambient.update("sunny", "simulation", 2016, 14_000);

    expect(firstPet.visible).toBe(false);
    expect(secondPet.visible).toBe(true);
    expect(Math.abs(secondPet.position.x - secondOwner.position.x)).toBeLessThan(2);
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
    ambient.update("sunny", "simulation", 2000, 6000);
    const network = generateStreetNetwork(seed);

    const pet = scene.children.find(
      (object) => object.userData["sceneRole"] === "ambient-pet" && object.visible,
    );
    const bicycles = scene.children.filter(
      (object) => object.userData["sceneRole"] === "ambient-bicycle" && object.visible,
    );
    const vehicles = scene.children.filter(
      (object) => object.userData["sceneRole"] === "ambient-vehicle" && object.visible,
    );

    expect(pet).toBeDefined();
    expect(pet?.position.x).toBeLessThan(owner.position.x);
    expect(
      pet !== undefined &&
        pointIsOnGeneratedStrip(pet.position.x, pet.position.z, network.sidewalks),
    ).toBe(true);

    expect(bicycles.length).toBeGreaterThan(0);
    expect(vehicles.length).toBeGreaterThan(0);
    for (const actor of [...bicycles, ...vehicles]) {
      expect(Number.isFinite(actor.rotation.y)).toBe(true);
      const mobilityActorId: unknown = actor.userData["mobilityActorId"];
      if (mobilityActorId === "resident-vehicle") {
        continue;
      }
      expect(pointIsOnGeneratedStrip(actor.position.x, actor.position.z, network.roads)).toBe(true);
    }
  });

  it("gives cyclists and drivers the same facial hair and clothing detail system", () => {
    const scene = new Scene();
    const ambient = createAmbientLife(scene, 0x1e_ad_20_26, []);
    ambient.update("sunny", "simulation", 2000, 6000);

    for (const role of ["ambient-rider", "ambient-driver"] as const) {
      let actor: Group | undefined;
      scene.traverse((object) => {
        if (object.userData["sceneRole"] === role && object instanceof Group) {
          actor = object;
        }
      });
      expect(actor).toBeDefined();
      if (actor === undefined) {
        continue;
      }

      const roles = new Set<string>();
      actor.traverse((object) => {
        const sceneRole: unknown = object.userData["sceneRole"];
        if (typeof sceneRole === "string") {
          roles.add(sceneRole);
        }
      });
      expect(roles.has("eye-white")).toBe(true);
      expect(roles.has("eye-pupil")).toBe(true);
      expect(roles.has("hair-cover")).toBe(true);
      expect(roles.has("hair-detail")).toBe(true);
      expect(roles.has("garment-detail")).toBe(true);
      expect(actor.userData["characterRig"]).toBe("shared-three");
      expect(actor.scale.y).toBeGreaterThan(0.5);
    }
  });

  it("derives deterministic varied bird flight profiles from the scene seed", () => {
    const first = Array.from({ length: 4 }, (_, index) =>
      birdFlightProfileFor(0x1e_ad_20_26, index),
    );
    const repeated = Array.from({ length: 4 }, (_, index) =>
      birdFlightProfileFor(0x1e_ad_20_26, index),
    );
    const alternate = Array.from({ length: 4 }, (_, index) =>
      birdFlightProfileFor(0x1e_ad_20_27, index),
    );

    expect(repeated).toEqual(first);
    expect(alternate).not.toEqual(first);
    expect(new Set(first.map((profile) => profile.direction))).toEqual(new Set([-1, 1]));
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
    const ambient = createAmbientLife(scene, 0x1e_ad_20_26, []);
    ambient.update("sunny", "simulation", 2000, 10_000);

    const birds = scene.children.filter(
      (object) => object.userData["sceneRole"] === "ambient-bird" && object.visible,
    );
    expect(birds).toHaveLength(4);
    expect(birds.some((bird) => Math.abs(bird.rotation.y) < 0.01)).toBe(true);
    expect(birds.some((bird) => Math.abs(Math.abs(bird.rotation.y) - Math.PI) < 0.01)).toBe(true);

    ambient.update("cloudy", "simulation", 2000, 10_000);
    expect(birds.every((bird) => !bird.visible)).toBe(true);
  });

  it("uses a reusable spatial crowd sampler with travel-aligned gait speed", () => {
    const simulation = createCrowdSimulation(beats, 12, 6000);
    const sample = simulation.sample(2750);
    const repeated = simulation.sample(2750);

    expect(repeated.poses).toEqual(sample.poses);
    expect(sample.poses).toHaveLength(12);
    expect(sample.neighborChecks).toBeLessThan((12 * 11) / 2);

    for (const pose of sample.poses) {
      if (pose === undefined) {
        continue;
      }
      expect(pose.worldSpeed).toBeGreaterThan(0);
      expect(pose.pace).toBeGreaterThan(0);
      expect(Number.isFinite(pose.heading)).toBe(true);
      expect(pose.routeId.length).toBeGreaterThan(0);
    }
  });

  it("advances gait phase from measured world-space travel distance", () => {
    const earlier = crowdPosesAt(beats, 1, 1000, 6000)[0];
    const later = crowdPosesAt(beats, 1, 1100, 6000)[0];
    expect(earlier).toBeDefined();
    expect(later).toBeDefined();
    if (earlier === undefined || later === undefined) {
      return;
    }

    expect(later.travelDistance - earlier.travelDistance).toBeCloseTo(earlier.worldSpeed * 0.1, 5);
    expect(walkingCycleAtDistance(later.travelDistance, 1, 1, 0)).toBeGreaterThan(
      walkingCycleAtDistance(earlier.travelDistance, 1, 1, 0),
    );
  });

  it("keeps walkers moving through the wider neighborhood at normal walking speed", () => {
    const early = crowdPosesAt(beats, PASSERBY_BASE_ACTIVE_COUNT, 250, 6000);
    const late = crowdPosesAt(beats, PASSERBY_BASE_ACTIVE_COUNT, 5750, 6000);
    const allPoses = [...early, ...late].filter((pose) => pose !== undefined);
    const extent = allPoses.reduce((max, pose) => Math.max(max, Math.abs(pose.x)), 0);
    expect(extent).toBeGreaterThan(42);
    for (const pose of allPoses) {
      expect(pose.worldSpeed).toBeGreaterThanOrEqual(1.18);
      expect(pose.worldSpeed).toBeLessThanOrEqual(1.44);
    }
  });

  it("starts late pedestrians at a route boundary and moves them immediately", () => {
    const lateBeat: PasserbyBeat = Object.freeze({
      pedestrianIndex: 0,
      startAtMs: 1000,
      endAtMs: 5000,
      direction: -1,
      lane: 0,
      seesAdvertisement: true,
      signIndex: 0,
    });
    const simulation = createCrowdSimulation([lateBeat], 1, 6000);

    expect(simulation.sample(999).poses[0]).toBeUndefined();
    const spawned = simulation.sample(1000).poses[0];
    const moved = simulation.sample(1100).poses[0];
    expect(spawned).toBeDefined();
    expect(moved).toBeDefined();
    if (spawned === undefined || moved === undefined) {
      return;
    }

    expect(spawned.travelDistance).toBeCloseTo(0, 6);
    expect(moved.travelDistance).toBeCloseTo(moved.worldSpeed * 0.1, 5);
    expect(Math.hypot(moved.x - spawned.x, moved.z - spawned.z)).toBeGreaterThan(0.08);
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
    expect(ambientPopulationFor("sunny", "idle")).toEqual({
      pets: 0,
      wildlife: 0,
      bicycles: 0,
      vehicles: 0,
    });
  });

  it("never teleports an active pedestrian between sidewalk samples", () => {
    const simulation = createCrowdSimulation(beats, 12, 12_000);
    let previous = simulation.sample(0).poses;

    for (let elapsedMs = 50; elapsedMs <= 12_000; elapsedMs += 50) {
      const current = simulation.sample(elapsedMs).poses;
      for (let index = 0; index < current.length; index += 1) {
        const before = previous[index];
        const after = current[index];
        if (before === undefined || after === undefined) {
          continue;
        }
        const displacement = Math.hypot(after.x - before.x, after.z - before.z);
        const expectedTravel = Math.max(before.worldSpeed, after.worldSpeed) * 0.05;
        expect(displacement).toBeLessThanOrEqual(expectedTravel + 0.28);
      }
      previous = current;
    }
  });

  it("keeps ordinary pedestrians within a normal walking-speed envelope", () => {
    const simulation = createCrowdSimulation(beats, 12, 12_000);
    const sampled = [
      ...simulation.sample(1000).poses,
      ...simulation.sample(6000).poses,
      ...simulation.sample(11_000).poses,
    ].filter((pose) => pose !== undefined);

    expect(sampled.length).toBeGreaterThan(0);
    for (const pose of sampled) {
      expect(pose.worldSpeed).toBeGreaterThanOrEqual(1.18);
      expect(pose.worldSpeed).toBeLessThanOrEqual(1.44);
    }
  });

  it("keeps twenty foreground pedestrians present and moving for the full simulation presentation", () => {
    const storyboard = createStreetStoryboard({
      durationMs: 16_000,
      prepared: 20,
      sold: 0,
      visibleSigns: 0,
      priceCents: 150,
      ambientPedestrianCount: 4,
    });
    expect(storyboard.passersBy.length).toBeGreaterThanOrEqual(PASSERBY_FOREGROUND_TARGET);

    const simulation = createCrowdSimulation(
      storyboard.passersBy,
      PASSERBY_BASE_ACTIVE_COUNT,
      storyboard.durationMs,
    );
    let previous = simulation.sample(0).poses;
    expect(previous.filter((pose) => pose !== undefined).length).toBeGreaterThanOrEqual(
      PASSERBY_FOREGROUND_TARGET,
    );

    const foregroundAtStart = previous.slice(0, PASSERBY_FOREGROUND_TARGET);
    const backgroundAtStart = previous
      .slice(PASSERBY_FOREGROUND_TARGET)
      .filter((pose) => pose !== undefined);
    const averageRadius = (poses: readonly NonNullable<(typeof previous)[number]>[]): number =>
      poses.reduce((total, pose) => total + Math.hypot(pose.x, pose.z), 0) /
      Math.max(1, poses.length);
    const definedForeground = foregroundAtStart.filter(
      (pose): pose is NonNullable<typeof pose> => pose !== undefined,
    );
    expect(definedForeground).toHaveLength(PASSERBY_FOREGROUND_TARGET);
    expect(definedForeground.every((pose) => pose.routeId.startsWith("main:"))).toBe(true);
    expect(backgroundAtStart.length).toBeGreaterThan(0);
    expect(averageRadius(definedForeground)).toBeLessThan(averageRadius(backgroundAtStart));

    for (let elapsedMs = 250; elapsedMs < storyboard.durationMs; elapsedMs += 250) {
      const current = simulation.sample(elapsedMs).poses;
      const foreground = current.slice(0, PASSERBY_FOREGROUND_TARGET);
      expect(foreground.filter((pose) => pose !== undefined).length).toBe(
        PASSERBY_FOREGROUND_TARGET,
      );

      for (let index = 0; index < PASSERBY_FOREGROUND_TARGET; index += 1) {
        const before = previous[index];
        const after = current[index];
        expect(before).toBeDefined();
        expect(after).toBeDefined();
        if (before === undefined || after === undefined) {
          continue;
        }

        expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.04);
        expect(after.travelDistance).toBeGreaterThan(before.travelDistance);
      }
      previous = current;
    }
  });

  it("does not expire a pedestrian mid-route only because its beat window ended", () => {
    const shortBeat: PasserbyBeat = Object.freeze({
      pedestrianIndex: 0,
      startAtMs: 0,
      endAtMs: 900,
      direction: -1,
      lane: 0,
      seesAdvertisement: false,
      signIndex: -1,
    });
    const simulation = createCrowdSimulation([shortBeat], 1, 12_000);
    const beforeBeatEnd = simulation.sample(800).poses[0];
    const afterBeatEnd = simulation.sample(1200).poses[0];
    const muchLater = simulation.sample(8000).poses[0];

    expect(beforeBeatEnd).toBeDefined();
    expect(afterBeatEnd).toBeDefined();
    expect(muchLater).toBeDefined();
    if (beforeBeatEnd === undefined || afterBeatEnd === undefined || muchLater === undefined) {
      return;
    }

    expect(
      Math.hypot(afterBeatEnd.x - beforeBeatEnd.x, afterBeatEnd.z - beforeBeatEnd.z),
    ).toBeGreaterThan(0.1);
    expect(muchLater.travelDistance).toBeGreaterThan(afterBeatEnd.travelDistance);
  });
});
