import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type Object3D,
  type Scene,
} from "three";

import { updateNeighborhoodWind } from "./neighborhood.js";
import {
  clampToSidewalk,
  closestSidewalkSide,
  roadLaneZ,
} from "./street-layout.js";

export type AmbientWeather = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";
export type AmbientPhase = "idle" | "simulation" | "forecast";

export type AmbientPopulation = Readonly<{
  pets: number;
  wildlife: number;
  bicycles: number;
  vehicles: number;
}>;

export type AmbientOwnerAnchor = Readonly<{
  x: number;
  z: number;
  heading: number;
}>;

export type PetFollowPose = Readonly<{
  x: number;
  z: number;
  yaw: number;
}>;

export type AmbientLifeController = Readonly<{
  update(
    weather: AmbientWeather,
    phase: AmbientPhase,
    elapsedMs: number,
    durationMs: number,
  ): void;
}>;

const material = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.88 });

export const ambientPopulationFor = (
  weather: AmbientWeather,
  phase: AmbientPhase,
): AmbientPopulation => {
  if (phase !== "simulation") {
    return Object.freeze({ pets: 0, wildlife: 0, bicycles: 0, vehicles: 0 });
  }
  switch (weather) {
    case "sunny":
      return Object.freeze({ pets: 2, wildlife: 2, bicycles: 2, vehicles: 1 });
    case "hot-and-dry":
      return Object.freeze({ pets: 1, wildlife: 1, bicycles: 1, vehicles: 1 });
    case "cloudy":
      return Object.freeze({ pets: 1, wildlife: 1, bicycles: 1, vehicles: 1 });
    case "thunderstorm":
      return Object.freeze({ pets: 0, wildlife: 0, bicycles: 0, vehicles: 2 });
  }
};

export const xTravelYaw = (direction: number): number =>
  direction >= 0 ? 0 : Math.PI;

export const petFollowPose = (
  owner: AmbientOwnerAnchor,
  index: number,
): PetFollowPose => {
  // Pedestrians may turn their torso/head toward an advertisement while their
  // route still moves along X. Pets follow the route, not the owner's glance.
  const direction: -1 | 1 = Math.sin(owner.heading) >= 0 ? 1 : -1;
  const lateral = (index % 2 === 0 ? 1 : -1) * (0.15 + (index % 3) * 0.025);
  const trailingDistance = 0.66 + (index % 2) * 0.1;
  return Object.freeze({
    x: owner.x - direction * trailingDistance,
    z: clampToNearSidewalk(owner.z + lateral, 0.12),
    yaw: xTravelYaw(direction),
  });
};

const createBird = (color: number): Group => {
  const root = new Group();
  const body = new Mesh(new SphereGeometry(0.12, 7, 5), material(color));
  body.scale.set(1.45, 0.72, 0.72);
  root.add(body);
  for (const direction of [-1, 1] as const) {
    const wing = new Mesh(new BoxGeometry(0.34, 0.025, 0.12), material(color));
    wing.position.set(0, 0.02, direction * 0.16);
    wing.rotation.x = direction * 0.26;
    root.add(wing);
  }
  return root;
};

const createPet = (color: number): Group => {
  const root = new Group();
  root.userData["sceneRole"] = "ambient-pet";
  const body = new Mesh(new BoxGeometry(0.5, 0.28, 0.22), material(color));
  body.position.y = 0.3;
  const head = new Mesh(new SphereGeometry(0.16, 8, 6), material(color));
  head.position.set(0.3, 0.4, 0);
  root.add(body, head);
  for (const x of [-0.18, 0.18]) {
    for (const z of [-0.07, 0.07]) {
      const leg = new Mesh(new CylinderGeometry(0.025, 0.025, 0.24, 5), material(color));
      leg.position.set(x, 0.14, z);
      root.add(leg);
    }
  }
  const tail = new Mesh(new CylinderGeometry(0.022, 0.03, 0.32, 6), material(color));
  tail.position.set(-0.3, 0.42, 0);
  tail.rotation.z = -0.9;
  root.add(tail);
  return root;
};

const createBicycle = (color: number): Group => {
  const root = new Group();
  root.userData["sceneRole"] = "ambient-bicycle";
  const wheelMaterial = material(0x2f3438);
  for (const x of [-0.42, 0.42]) {
    const wheel = new Mesh(
      new CylinderGeometry(0.28, 0.28, 0.045, 12),
      wheelMaterial,
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.3, 0);
    root.add(wheel);
  }
  const frame = new Mesh(new BoxGeometry(0.76, 0.055, 0.055), material(color));
  frame.position.y = 0.42;
  frame.rotation.z = 0.08;
  root.add(frame);
  const rider = new Mesh(new SphereGeometry(0.13, 8, 6), material(0xd5a27d));
  rider.position.set(0, 1.15, 0);
  root.add(rider);
  const torso = new Mesh(new CylinderGeometry(0.14, 0.18, 0.55, 8), material(color));
  torso.position.set(0, 0.82, 0);
  torso.rotation.z = -0.18;
  root.add(torso);
  return root;
};

const createVehicle = (color: number): Group => {
  const root = new Group();
  root.userData["sceneRole"] = "ambient-vehicle";
  const body = new Mesh(new BoxGeometry(1.65, 0.52, 0.82), material(color));
  body.position.y = 0.48;
  root.add(body);
  const cabin = new Mesh(new BoxGeometry(0.84, 0.42, 0.72), material(0xb9d2d8));
  cabin.position.set(-0.12, 0.92, 0);
  root.add(cabin);
  const hood = new Mesh(new BoxGeometry(0.4, 0.16, 0.7), material(color));
  hood.position.set(0.75, 0.7, 0);
  root.add(hood);
  for (const x of [-0.55, 0.55]) {
    for (const z of [-0.36, 0.36]) {
      const wheel = new Mesh(
        new CylinderGeometry(0.18, 0.18, 0.12, 10),
        material(0x2c3034),
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.24, z);
      root.add(wheel);
    }
  }
  return root;
};

const routeProgress = (
  elapsedMs: number,
  durationMs: number,
  offset: number,
  speed: number,
): number => {
  const duration = Math.max(1, durationMs);
  const progress = elapsedMs / duration * speed + offset;
  return progress - Math.floor(progress);
};

export const createAmbientLife = (
  scene: Scene,
  seed: number,
  owners: readonly Object3D[] = [],
): AmbientLifeController => {
  const pets = [createPet(0xa96f45), createPet(0x3e3a36), createPet(0xd1b48b)];
  const wildlife = [createBird(0x5d6971), createBird(0x795d4e)];
  const bicycles = [createBicycle(0x4f7f91), createBicycle(0xb45d4c)];
  const vehicles = [createVehicle(0x7189a8), createVehicle(0xa65e52)];

  for (const actor of [...pets, ...wildlife, ...bicycles, ...vehicles]) {
    actor.visible = false;
    scene.add(actor);
  }

  return Object.freeze({
    update(weather, phase, elapsedMs, durationMs): void {
      updateNeighborhoodWind(scene, elapsedMs / 1000, weather);
      const population = ambientPopulationFor(weather, phase);
      pets.forEach((pet, index) => {
        const owner = owners.find((candidate, ownerIndex) =>
          candidate.visible && ownerIndex >= index,
        ) ?? owners.find((candidate) => candidate.visible);
        pet.visible = index < population.pets && owner !== undefined;
        if (!pet.visible || owner === undefined) return;
        const pose = petFollowPose({
          x: owner.position.x,
          z: owner.position.z,
          heading: owner.rotation.y,
        }, index);
        const gait = Math.sin(elapsedMs * 0.012 + index * 1.7 + (seed & 15) * 0.21);
        pet.position.set(pose.x, Math.abs(gait) * 0.018, pose.z);
        pet.rotation.y = pose.yaw;
        pet.rotation.z = gait * 0.025;
      });
      wildlife.forEach((bird, index) => {
        bird.visible = index < population.wildlife;
        if (!bird.visible) return;
        const progress = routeProgress(
          elapsedMs,
          durationMs,
          index * 0.39 + 0.12,
          0.62 + index * 0.08,
        );
        bird.position.set(
          -16 + progress * 32,
          5.8 + index * 0.8 + Math.sin(progress * Math.PI * 4) * 0.25,
          -3 - index * 3,
        );
        bird.rotation.y = 0;
        bird.rotation.z = Math.sin(progress * Math.PI * 12) * 0.08;
      });
      bicycles.forEach((bike, index) => {
        const direction = index % 2 === 0 ? -1 : 1;
        const progress = routeProgress(
          elapsedMs,
          durationMs,
          index * 0.47 + 0.18,
          0.9 + index * 0.12,
        );
        bike.visible = index < population.bicycles && progress > 0.08 && progress < 0.78;
        if (!bike.visible) return;
        const x = direction === 1
          ? -18 + progress * 36
          : 18 - progress * 36;
        bike.position.set(x, 0.02, roadLaneZ("bicycle", index));
        bike.rotation.y = xTravelYaw(direction);
      });
      vehicles.forEach((vehicle, index) => {
        const direction = index % 2 === 0 ? 1 : -1;
        const progress = routeProgress(
          elapsedMs,
          durationMs,
          index * 0.53 + 0.08,
          0.52 + index * 0.09,
        );
        vehicle.visible = index < population.vehicles && progress > 0.04 && progress < 0.82;
        if (!vehicle.visible) return;
        const x = direction === 1
          ? -20 + progress * 40
          : 20 - progress * 40;
        vehicle.position.set(x, 0.02, roadLaneZ("vehicle", index));
        vehicle.rotation.y = xTravelYaw(direction);
      });
    },
  });
};
