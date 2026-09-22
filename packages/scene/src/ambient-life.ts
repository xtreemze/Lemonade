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

import { characterProfileFor } from "./characters.js";
import { decorateCharacter } from "./character-detail.js";
import { updateNeighborhoodWind } from "./neighborhood.js";
import { WORLD_SCALE } from "./world-scale.js";
import {
  clampToSidewalk,
  roadLaneZ,
  sidewalkSideForZ,
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
      return Object.freeze({ pets: 2, wildlife: 4, bicycles: 2, vehicles: 1 });
    case "hot-and-dry":
      return Object.freeze({ pets: 1, wildlife: 0, bicycles: 1, vehicles: 1 });
    case "cloudy":
      return Object.freeze({ pets: 1, wildlife: 0, bicycles: 1, vehicles: 1 });
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
  const side = sidewalkSideForZ(owner.z);
  return Object.freeze({
    x: owner.x - direction * trailingDistance,
    z: clampToSidewalk(owner.z + lateral, side, 0.12),
    yaw: xTravelYaw(direction),
  });
};

const createBird = (color: number): Group => {
  const root = new Group();
  root.userData["sceneRole"] = "ambient-bird";
  const body = new Mesh(new SphereGeometry(0.12, 7, 5), material(color));
  body.scale.set(1.45, 0.72, 0.72);
  root.add(body);

  const head = new Mesh(new SphereGeometry(0.075, 7, 5), material(color));
  head.position.set(0.15, 0.035, 0);
  root.add(head);

  const beak = new Mesh(
    new CylinderGeometry(0, 0.035, 0.12, 5),
    material(0xd79b45),
  );
  beak.position.set(0.245, 0.025, 0);
  beak.rotation.z = -Math.PI / 2;
  root.add(beak);

  for (const direction of [-1, 1] as const) {
    const wing = new Mesh(new BoxGeometry(0.34, 0.025, 0.12), material(color));
    wing.userData["sceneRole"] = "ambient-bird-wing";
    wing.position.set(0, 0.02, direction * 0.16);
    wing.rotation.x = direction * 0.26;
    root.add(wing);
  }

  for (const direction of [-1, 1] as const) {
    const tail = new Mesh(new BoxGeometry(0.16, 0.025, 0.07), material(color));
    tail.position.set(-0.18, -0.015, direction * 0.055);
    tail.rotation.y = direction * 0.22;
    root.add(tail);
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

type TransportCharacterRig = Readonly<{
  root: Group;
  head: Mesh;
  arms: readonly [Group, Group];
  legs: readonly [Group, Group];
}>;

const createTransportCharacter = (
  seed: number,
  index: number,
): TransportCharacterRig => {
  const profile = characterProfileFor(seed, index);
  const root = new Group();
  root.userData["sceneRole"] = "transport-character";

  const torso = new Mesh(
    new CylinderGeometry(0.25, 0.34, 0.9, 10),
    material(profile.clothingColor),
  );
  torso.position.y = 1.05;
  const head = new Mesh(
    new SphereGeometry(0.27, 12, 8),
    material(profile.skinColor),
  );
  head.position.y = 1.78;
  root.add(torso, head);

  const arms = [-1, 1].map((direction) => {
    const arm = new Group();
    const upper = new Mesh(
      new CylinderGeometry(0.075, 0.082, 0.42, 8),
      material(profile.clothingColor),
    );
    upper.position.y = -0.21;
    arm.position.set(direction * 0.34, 1.37, 0);
    arm.rotation.z = direction * 0.08;
    arm.add(upper);
    root.add(arm);
    return arm;
  }) as [Group, Group];

  const legs = [-1, 1].map((direction) => {
    const leg = new Group();
    const upper = new Mesh(
      new CylinderGeometry(0.095, 0.105, 0.5, 8),
      material(profile.trouserColor),
    );
    upper.position.y = -0.25;
    leg.position.set(direction * 0.14, 0.72, 0);
    leg.add(upper);
    root.add(leg);
    return leg;
  }) as [Group, Group];

  decorateCharacter(root, head, profile, index);
  return Object.freeze({
    root,
    head,
    arms: Object.freeze(arms),
    legs: Object.freeze(legs),
  });
};

const createBicycle = (
  color: number,
  seed: number,
  index: number,
): Group => {
  const root = new Group();
  root.userData["sceneRole"] = "ambient-bicycle";
  const wheelMaterial = material(0x2f3438);
  const wheelRadius = WORLD_SCALE.bicycle.wheelDiameter / 2;
  const axleX = WORLD_SCALE.bicycle.length * 0.36;
  for (const x of [-axleX, axleX]) {
    const wheel = new Mesh(
      new CylinderGeometry(wheelRadius, wheelRadius, 0.045, 12),
      wheelMaterial,
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, wheelRadius, 0);
    root.add(wheel);
  }
  const frame = new Mesh(
    new BoxGeometry(WORLD_SCALE.bicycle.length * 0.7, 0.055, 0.055),
    material(color),
  );
  frame.position.y = wheelRadius + 0.16;
  frame.rotation.z = 0.08;
  root.add(frame);

  const rider = createTransportCharacter(seed, 500 + index);
  rider.root.userData["sceneRole"] = "ambient-rider";
  rider.root.scale.setScalar(0.58);
  rider.root.position.set(-0.02, wheelRadius - 0.08, 0);
  rider.root.rotation.z = -0.12;
  rider.arms[0].rotation.x = -0.92;
  rider.arms[1].rotation.x = -0.92;
  rider.legs[0].rotation.x = 0.82;
  rider.legs[1].rotation.x = -0.52;
  root.add(rider.root);
  return root;
};

const createVehicle = (
  color: number,
  seed: number,
  index: number,
): Group => {
  const root = new Group();
  root.userData["sceneRole"] = "ambient-vehicle";
  const body = new Mesh(
    new BoxGeometry(
      WORLD_SCALE.vehicle.length,
      WORLD_SCALE.vehicle.bodyHeight,
      WORLD_SCALE.vehicle.width,
    ),
    material(color),
  );
  body.position.y = 0.58;
  root.add(body);

  const cabinBase = new Mesh(
    new BoxGeometry(2, 0.18, WORLD_SCALE.vehicle.width * 0.9),
    material(color),
  );
  cabinBase.position.set(-0.28, 0.88, 0);
  root.add(cabinBase);
  const roof = new Mesh(
    new BoxGeometry(1.6, 0.08, WORLD_SCALE.vehicle.width * 0.9),
    material(color),
  );
  roof.position.set(-0.28, 1.5, 0);
  root.add(roof);

  const glass = new MeshStandardMaterial({
    color: 0xb9d2d8,
    transparent: true,
    opacity: 0.42,
    roughness: 0.2,
    depthWrite: false,
  });
  for (const z of [-WORLD_SCALE.vehicle.width * 0.455, WORLD_SCALE.vehicle.width * 0.455]) {
    const sideWindow = new Mesh(new BoxGeometry(1.5, 0.5, 0.025), glass.clone());
    sideWindow.position.set(-0.28, 1.2, z);
    root.add(sideWindow);
  }
  for (const x of [-1.05, 0.5]) {
    const endWindow = new Mesh(
      new BoxGeometry(0.025, 0.48, WORLD_SCALE.vehicle.width * 0.76),
      glass.clone(),
    );
    endWindow.position.set(x, 1.2, 0);
    root.add(endWindow);
  }

  const hood = new Mesh(
    new BoxGeometry(1.15, 0.28, WORLD_SCALE.vehicle.width * 0.88),
    material(color),
  );
  hood.position.set(1.5, 0.86, 0);
  root.add(hood);

  for (const x of [-1.35, 1.35]) {
    for (const z of [-0.78, 0.78]) {
      const wheel = new Mesh(
        new CylinderGeometry(0.32, 0.32, 0.22, 12),
        material(0x2c3034),
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.32, z);
      root.add(wheel);
    }
  }

  const driver = createTransportCharacter(seed ^ 0x51a7, 10_100 + index);
  driver.root.userData["sceneRole"] = "ambient-driver";
  driver.root.scale.setScalar(0.42);
  driver.root.position.set(-0.35, 0.72, 0.12);
  driver.arms[0].rotation.x = -0.72;
  driver.arms[1].rotation.x = -0.72;
  driver.legs[0].rotation.x = 0.62;
  driver.legs[1].rotation.x = 0.62;
  root.add(driver.root);

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
  const wildlife = [
    createBird(0x5d6971),
    createBird(0x795d4e),
    createBird(0x66795a),
    createBird(0x6f7890),
  ];
  const bicycles = [
    createBicycle(0x4f7f91, seed, 0),
    createBicycle(0xb45d4c, seed, 1),
  ];
  const vehicles = [
    createVehicle(0x7189a8, seed, 0),
    createVehicle(0xa65e52, seed, 1),
  ];

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
        const direction = index % 2 === 0 ? 1 : -1;
        const x = direction === 1
          ? -18 + progress * 36
          : 18 - progress * 36;
        bird.position.set(
          x,
          5.8 + index * 0.65 + Math.sin(progress * Math.PI * 4) * 0.25,
          -3 - index * 2.4,
        );
        bird.rotation.y = xTravelYaw(direction);
        bird.rotation.z =
          direction * Math.sin(progress * Math.PI * 12) * 0.08;
        for (const child of bird.children) {
          if (child.userData["sceneRole"] !== "ambient-bird-wing") continue;
          const side = Math.sign(child.position.z) || 1;
          child.rotation.x =
            side * (0.18 + Math.sin(progress * Math.PI * 18 + index) * 0.42);
        }
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
