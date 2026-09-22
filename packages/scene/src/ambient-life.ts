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
import {
  createNeighborhoodMobilitySystem,
  type MobilityPose,
  type NeighborhoodMobilitySample,
} from "./neighborhood-mobility.js";
import { WORLD_SCALE } from "./world-scale.js";
import {
  clampToSidewalk,
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
    dayNumber?: number,
    focus?: Readonly<{ x: number; z: number }>,
  ): NeighborhoodMobilitySample;
}>;

const material = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.88 });

const ambientUnit = (seed: number, salt: number): number => {
  let value = Math.imul((seed ^ salt) >>> 0, 0x9e3779b1);
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  return ((value ^ (value >>> 15)) >>> 0) / 0xffff_ffff;
};

export type BirdFlightProfile = Readonly<{
  color: number;
  direction: -1 | 1;
  routeOffset: number;
  speed: number;
  altitude: number;
  depth: number;
  verticalAmplitude: number;
  wingBeat: number;
  phase: number;
  scale: number;
}>;

const BIRD_PALETTE = [
  0x343a40,
  0x454b52,
  0x5d6971,
  0x66795a,
  0x795d4e,
  0x6f7890,
] as const;

export const birdFlightProfileFor = (
  seed: number,
  index: number,
): BirdFlightProfile => {
  const salt = 20_000 + index * 97;
  return Object.freeze({
    color:
      BIRD_PALETTE[
        Math.floor(ambientUnit(seed, salt) * BIRD_PALETTE.length) %
          BIRD_PALETTE.length
      ] ?? BIRD_PALETTE[0],
    direction: index % 2 === 0 ? 1 : -1,
    routeOffset: ambientUnit(seed, salt + 1),
    speed: 0.54 + ambientUnit(seed, salt + 2) * 0.34,
    altitude: 5.5 + ambientUnit(seed, salt + 3) * 2.5,
    depth: -2.5 - ambientUnit(seed, salt + 4) * 8.5,
    verticalAmplitude: 0.12 + ambientUnit(seed, salt + 5) * 0.28,
    wingBeat: 14 + ambientUnit(seed, salt + 6) * 8,
    phase: ambientUnit(seed, salt + 7) * Math.PI * 2,
    scale: 0.88 + ambientUnit(seed, salt + 8) * 0.28,
  });
};

export const ambientPopulationFor = (
  weather: AmbientWeather,
  phase: AmbientPhase,
): AmbientPopulation => {
  if (phase === "forecast") {
    return Object.freeze({ pets: 0, wildlife: 0, bicycles: 0, vehicles: 2 });
  }
  if (phase !== "simulation") {
    return Object.freeze({ pets: 0, wildlife: 0, bicycles: 0, vehicles: 0 });
  }
  switch (weather) {
    case "sunny":
      return Object.freeze({ pets: 2, wildlife: 4, bicycles: 3, vehicles: 8 });
    case "hot-and-dry":
      return Object.freeze({ pets: 1, wildlife: 0, bicycles: 2, vehicles: 8 });
    case "cloudy":
      return Object.freeze({ pets: 1, wildlife: 0, bicycles: 2, vehicles: 8 });
    case "thunderstorm":
      return Object.freeze({ pets: 0, wildlife: 0, bicycles: 0, vehicles: 4 });
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

const createBird = (profile: BirdFlightProfile): Group => {
  const root = new Group();
  root.userData["sceneRole"] = "ambient-bird";
  root.userData["proceduralFlightProfile"] = profile;
  root.scale.setScalar(profile.scale);

  const plumage = material(profile.color);
  const wingGeometry = new BoxGeometry(0.34, 0.025, 0.12);
  const tailGeometry = new BoxGeometry(0.16, 0.025, 0.07);

  const body = new Mesh(new SphereGeometry(0.12, 7, 5), plumage);
  body.scale.set(1.45, 0.72, 0.72);
  root.add(body);

  const head = new Mesh(new SphereGeometry(0.075, 7, 5), plumage);
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
    const wing = new Mesh(wingGeometry, plumage);
    wing.userData["sceneRole"] = "ambient-bird-wing";
    wing.position.set(0, 0.02, direction * 0.16);
    wing.rotation.x = direction * 0.26;
    root.add(wing);
  }

  for (const direction of [-1, 1] as const) {
    const tail = new Mesh(tailGeometry, plumage);
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

export type VehicleVariant = "sedan" | "sports" | "pickup" | "truck";

export type VehicleVariantSpec = Readonly<{
  length: number;
  width: number;
  bodyHeight: number;
  cabinHeight: number;
  wheelRadius: number;
}>;

export const vehicleVariantSpec = (
  variant: VehicleVariant,
): VehicleVariantSpec => {
  switch (variant) {
    case "sports":
      return Object.freeze({
        length: 4.35,
        width: 1.82,
        bodyHeight: 0.58,
        cabinHeight: 0.44,
        wheelRadius: 0.34,
      });
    case "pickup":
      return Object.freeze({
        length: 5.25,
        width: 1.96,
        bodyHeight: 0.78,
        cabinHeight: 0.78,
        wheelRadius: 0.4,
      });
    case "truck":
      return Object.freeze({
        length: 5.8,
        width: 2.06,
        bodyHeight: 0.92,
        cabinHeight: 1.05,
        wheelRadius: 0.43,
      });
    case "sedan":
      return Object.freeze({
        length: 4.65,
        width: 1.88,
        bodyHeight: 0.68,
        cabinHeight: 0.62,
        wheelRadius: 0.36,
      });
  }
};

const createVehicle = (
  color: number,
  seed: number,
  index: number,
  variant: VehicleVariant,
): Group => {
  const spec = vehicleVariantSpec(variant);
  const root = new Group();
  root.userData["sceneRole"] = "ambient-vehicle";
  root.userData["vehicleVariant"] = variant;

  const body = new Mesh(
    new BoxGeometry(spec.length, spec.bodyHeight, spec.width),
    material(color),
  );
  body.position.y = spec.wheelRadius + spec.bodyHeight * 0.62;
  root.add(body);

  const cabinLength =
    variant === "truck"
      ? spec.length * 0.32
      : variant === "pickup"
        ? spec.length * 0.4
        : spec.length * 0.48;
  const cabinX =
    variant === "truck" ? spec.length * 0.25 : -spec.length * 0.08;
  const cabinBase = new Mesh(
    new BoxGeometry(cabinLength, 0.16, spec.width * 0.9),
    material(color),
  );
  cabinBase.position.set(
    cabinX,
    spec.wheelRadius + spec.bodyHeight + 0.08,
    0,
  );
  root.add(cabinBase);

  const glass = new MeshStandardMaterial({
    color: 0xb9d2d8,
    transparent: true,
    opacity: 0.42,
    roughness: 0.2,
    depthWrite: false,
  });
  const windowHeight = Math.max(0.34, spec.cabinHeight * 0.72);
  for (const z of [-spec.width * 0.455, spec.width * 0.455]) {
    const sideWindow = new Mesh(
      new BoxGeometry(cabinLength * 0.8, windowHeight, 0.025),
      glass.clone(),
    );
    sideWindow.position.set(
      cabinX,
      spec.wheelRadius + spec.bodyHeight + spec.cabinHeight * 0.5,
      z,
    );
    root.add(sideWindow);
  }

  const roof = new Mesh(
    new BoxGeometry(cabinLength * 0.9, 0.08, spec.width * 0.9),
    material(color),
  );
  roof.position.set(
    cabinX,
    spec.wheelRadius + spec.bodyHeight + spec.cabinHeight,
    0,
  );
  root.add(roof);

  if (variant === "pickup") {
    const bed = new Mesh(
      new BoxGeometry(spec.length * 0.34, spec.bodyHeight * 0.46, spec.width * 0.88),
      material(color),
    );
    bed.position.set(
      -spec.length * 0.31,
      spec.wheelRadius + spec.bodyHeight * 0.84,
      0,
    );
    root.add(bed);
  } else if (variant === "truck") {
    const cargo = new Mesh(
      new BoxGeometry(spec.length * 0.48, 1.7, spec.width * 0.94),
      material(color),
    );
    cargo.position.set(
      -spec.length * 0.24,
      spec.wheelRadius + 1.36,
      0,
    );
    root.add(cargo);
  } else {
    const hood = new Mesh(
      new BoxGeometry(
        spec.length * 0.24,
        spec.bodyHeight * 0.34,
        spec.width * 0.88,
      ),
      material(color),
    );
    hood.position.set(
      spec.length * 0.39,
      spec.wheelRadius + spec.bodyHeight * 1.02,
      0,
    );
    root.add(hood);
  }

  const axleX = spec.length * 0.31;
  const wheelZ = spec.width * 0.47;
  for (const x of [-axleX, axleX]) {
    for (const z of [-wheelZ, wheelZ]) {
      const wheel = new Mesh(
        new CylinderGeometry(
          spec.wheelRadius,
          spec.wheelRadius,
          0.18,
          12,
        ),
        material(0x2c3034),
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, spec.wheelRadius, z);
      root.add(wheel);
    }
  }

  const driver = createTransportCharacter(seed ^ 0x51a7, 10_100 + index);
  driver.root.userData["sceneRole"] = "ambient-driver";
  driver.root.scale.setScalar(0.42);
  driver.root.position.set(
    cabinX,
    spec.wheelRadius + spec.bodyHeight * 0.7,
    0.12,
  );
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

const applyTransportWalk = (
  rig: TransportCharacterRig,
  elapsedMs: number,
  speed: number,
): void => {
  const cycle = elapsedMs * 0.009 * Math.max(0.4, speed);
  const stride = Math.sin(cycle) * 0.52;
  rig.legs[0].rotation.x = stride;
  rig.legs[1].rotation.x = -stride;
  rig.arms[0].rotation.x = -stride * 0.72;
  rig.arms[1].rotation.x = stride * 0.72;
  rig.root.position.y = Math.abs(Math.sin(cycle)) * 0.018;
};

const placeRig = (
  rig: TransportCharacterRig,
  pose: MobilityPose | undefined,
  elapsedMs: number,
): void => {
  rig.root.visible = pose?.visible === true;
  if (!pose?.visible) return;
  rig.root.position.set(pose.x, 0, pose.z);
  rig.root.rotation.y = -pose.yaw;
  applyTransportWalk(rig, elapsedMs, pose.speed);
  if (pose.interaction === "gardening") {
    rig.arms[0].rotation.x = -1.05;
    rig.arms[1].rotation.x = -0.72;
    rig.root.rotation.z = Math.sin(elapsedMs * 0.004) * 0.08;
  } else if (pose.interaction === "mailbox") {
    rig.arms[1].rotation.x = -1.15;
  }
};

export const createAmbientLife = (
  scene: Scene,
  seed: number,
  owners: readonly Object3D[] = [],
  mobilitySeed = seed,
): AmbientLifeController => {
  const pets = [createPet(0xa96f45), createPet(0x3e3a36), createPet(0xd1b48b)];
  const wildlifeProfiles = Array.from({ length: 4 }, (_, index) =>
    birdFlightProfileFor(seed ^ 0x42495244, index),
  );
  const wildlife = wildlifeProfiles.map((profile) => createBird(profile));
  const bicycles = [
    createBicycle(0x4f7f91, seed, 0),
    createBicycle(0xb45d4c, seed, 1),
    createBicycle(0x75864f, seed, 2),
  ];
  const vehicles = [
    createVehicle(0x7189a8, seed, 0, "sedan"),
    createVehicle(0xa65e52, seed, 1, "sports"),
    createVehicle(0x6b7c61, seed, 2, "pickup"),
    createVehicle(0x8a796d, seed, 3, "truck"),
    createVehicle(0x526f86, seed, 4, "sedan"),
    createVehicle(0xb17b45, seed, 5, "sports"),
    createVehicle(0x63745f, seed, 6, "pickup"),
    createVehicle(0x7d7270, seed, 7, "sedan"),
  ];
  const residents = [
    createTransportCharacter(seed ^ 0x7341, 12_000),
    createTransportCharacter(seed ^ 0x7341, 12_001),
    createTransportCharacter(seed ^ 0x7341, 12_002),
    createTransportCharacter(seed ^ 0x7341, 12_003),
  ];
  const mailCarrier = createTransportCharacter(seed ^ 0x4d41494c, 12_100);
  const gardener = createTransportCharacter(seed ^ 0x47415244, 12_200);
  mailCarrier.root.userData["sceneRole"] = "ambient-mail-carrier";
  gardener.root.userData["sceneRole"] = "ambient-gardener";
  residents.forEach((resident, index) => {
    resident.root.userData["sceneRole"] = "ambient-resident";
    resident.root.userData["residentIndex"] = index;
  });

  const mobility = createNeighborhoodMobilitySystem(mobilitySeed);

  for (const actor of [
    ...pets,
    ...wildlife,
    ...bicycles,
    ...vehicles,
    ...residents.map((resident) => resident.root),
    mailCarrier.root,
    gardener.root,
  ]) {
    actor.visible = false;
    scene.add(actor);
  }

  return Object.freeze({
    update(
      weather,
      phase,
      elapsedMs,
      durationMs,
      dayNumber = 1,
      focus = Object.freeze({ x: 0, z: 0 }),
    ): NeighborhoodMobilitySample {
      updateNeighborhoodWind(scene, elapsedMs / 1000, weather);
      const population = ambientPopulationFor(weather, phase);
      const pedestrianObstacles: Readonly<{ x: number; z: number }>[] = [];

      pets.slice(0, 2).forEach((pet, index) => {
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
        pedestrianObstacles.push({ x: pose.x, z: pose.z });
      });

      for (const owner of owners) {
        if (!owner.visible) continue;
        pedestrianObstacles.push({
          x: owner.position.x,
          z: owner.position.z,
        });
      }

      const sample = mobility.sample({
        weather,
        phase,
        elapsedMs,
        durationMs,
        dayNumber,
        focus,
        pedestrianObstacles,
      });

      const residentPet = sample.actors.find((actor) => actor.id === "resident-pet");
      const homePet = pets[2];
      if (homePet !== undefined) {
        homePet.visible = residentPet?.visible === true;
        if (residentPet?.visible === true) {
          const gait = Math.sin(elapsedMs * 0.011 + 2.7);
          homePet.position.set(residentPet.x, Math.abs(gait) * 0.018, residentPet.z);
          homePet.rotation.y = -residentPet.yaw;
          homePet.rotation.z = gait * 0.025;
        }
      }

      const residentPoses = sample.actors.filter(
        (actor) => actor.kind === "resident",
      );
      residents.forEach((resident, index) => {
        placeRig(resident, residentPoses[index], elapsedMs);
      });
      placeRig(
        mailCarrier,
        sample.actors.find((actor) => actor.kind === "mail-carrier"),
        elapsedMs,
      );
      placeRig(
        gardener,
        sample.actors.find((actor) => actor.kind === "gardener"),
        elapsedMs,
      );

      wildlife.forEach((bird, index) => {
        bird.visible = index < population.wildlife;
        if (!bird.visible) return;
        const profile = wildlifeProfiles[index];
        if (profile === undefined) return;
        const progress = routeProgress(
          elapsedMs,
          durationMs,
          profile.routeOffset,
          profile.speed,
        );
        const x = profile.direction === 1
          ? -20 + progress * 40
          : 20 - progress * 40;
        bird.position.set(
          x,
          profile.altitude +
            Math.sin(progress * Math.PI * 4 + profile.phase) *
              profile.verticalAmplitude,
          profile.depth,
        );
        bird.rotation.y = xTravelYaw(profile.direction);
        bird.rotation.z =
          profile.direction *
          Math.sin(progress * Math.PI * 12 + profile.phase) *
          0.08;
        for (const child of bird.children) {
          if (child.userData["sceneRole"] !== "ambient-bird-wing") continue;
          const side = Math.sign(child.position.z) || 1;
          child.rotation.x =
            side *
            (0.18 +
              Math.sin(
                progress * Math.PI * profile.wingBeat + profile.phase,
              ) *
                0.42);
        }
      });

      const bicyclePoses = sample.actors.filter(
        (actor) => actor.kind === "bicycle" && actor.visible,
      );
      bicycles.forEach((bike, index) => {
        const pose = index < population.bicycles ? bicyclePoses[index] : undefined;
        bike.visible = pose !== undefined;
        if (pose === undefined) return;
        bike.userData["mobilityActorId"] = pose.id;
        bike.position.set(pose.x, 0.02, pose.z);
        bike.rotation.y = -pose.yaw;
      });

      const allVehiclePoses = sample.actors.filter(
        (actor) => actor.kind === "vehicle" && actor.visible,
      );
      const residentVehicle = allVehiclePoses.find(
        (actor) => actor.id === "resident-vehicle",
      );
      const throughTraffic = allVehiclePoses.filter(
        (actor) => actor.id !== "resident-vehicle",
      );
      const vehiclePoses = [
        ...(residentVehicle === undefined ? [] : [residentVehicle]),
        ...throughTraffic.slice(
          0,
          Math.max(
            0,
            population.vehicles - (residentVehicle === undefined ? 0 : 1),
          ),
        ),
      ];
      vehicles.forEach((vehicle, index) => {
        const pose = vehiclePoses[index];
        vehicle.visible = pose !== undefined;
        if (pose === undefined) return;
        vehicle.userData["mobilityActorId"] = pose.id;
        vehicle.position.set(pose.x, 0.02, pose.z);
        vehicle.rotation.y = -pose.yaw;
      });
      return sample;
    },
  });
};
