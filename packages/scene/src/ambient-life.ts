import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  type Scene,
  SphereGeometry,
  Vector3,
} from "three";
import { applyCharacterExpressionPose, decorateCharacter } from "./character-detail.js";
import { type CharacterGeometrySet, createCharacterGeometrySet } from "./character-geometry.js";
import {
  CHARACTER_ANATOMY,
  type CharacterPose,
  characterExpressionAt,
  characterPoseAtDistance,
  neutralCharacterPose,
  seatedCharacterPose,
  serviceInteractionPose,
} from "./character-model.js";
import {
  applyThreeCharacterPose,
  characterRotationYForRouteYaw,
  createThreeCharacterRig,
  type ThreeCharacterRig,
} from "./character-rig.js";
import { updateNeighborhoodActivity, updateNeighborhoodWind } from "./neighborhood.js";
import {
  createNeighborhoodMobilitySystem,
  type MobilityPose,
  type NeighborhoodMobilitySample,
} from "./neighborhood-mobility.js";
import { clampToSidewalk, sidewalkSideForZ } from "./street-layout.js";
import { WORLD_SCALE } from "./world-scale.js";

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
  update: (
    weather: AmbientWeather,
    phase: AmbientPhase,
    elapsedMs: number,
    durationMs: number,
    dayNumber?: number,
    focus?: Readonly<{ x: number; z: number }>,
  ) => NeighborhoodMobilitySample;
}>;

const material = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.88 });

const ambientNeutralExpression = neutralCharacterPose().expression;

const ambientUnit = (seed: number, salt: number): number => {
  let value = Math.imul((seed ^ salt) >>> 0, 0x9e_37_79_b1);
  value = Math.imul(value ^ (value >>> 16), 0x21_f0_aa_ad);
  return ((value ^ (value >>> 15)) >>> 0) / 0xff_ff_ff_ff;
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
  0x34_3a_40, 0x45_4b_52, 0x5d_69_71, 0x66_79_5a, 0x79_5d_4e, 0x6f_78_90,
] as const;

export const birdFlightProfileFor = (seed: number, index: number): BirdFlightProfile => {
  const salt = 20_000 + index * 97;
  return Object.freeze({
    color:
      BIRD_PALETTE[
        Math.floor(ambientUnit(seed, salt) * BIRD_PALETTE.length) % BIRD_PALETTE.length
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

export const xTravelYaw = (direction: number): number => (direction >= 0 ? 0 : Math.PI);

export const petFollowPose = (owner: AmbientOwnerAnchor, index: number): PetFollowPose => {
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

  const beak = new Mesh(new CylinderGeometry(0, 0.035, 0.12, 5), material(0xd7_9b_45));
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

type TransportCharacterRig = ThreeCharacterRig;

const createTransportCharacter = (
  geometries: CharacterGeometrySet,
  seed: number,
  index: number,
): TransportCharacterRig => {
  const rig = createThreeCharacterRig(geometries, seed, index);
  rig.root.userData["sceneRole"] = "transport-character";
  decorateCharacter(rig.root, rig.head, rig.profile, index);
  return rig;
};

const createBicycle = (
  geometries: CharacterGeometrySet,
  color: number,
  seed: number,
  index: number,
): Group => {
  const root = new Group();
  root.userData["sceneRole"] = "ambient-bicycle";
  const wheelMaterial = material(0x2f_34_38);
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

  const rider = createTransportCharacter(geometries, seed, 500 + index);
  rider.root.userData["sceneRole"] = "ambient-rider";
  applyThreeCharacterPose(rider, seatedCharacterPose("rider"));
  rider.root.position.set(-0.02, wheelRadius - 0.08, 0);
  rider.root.rotation.y = characterRotationYForRouteYaw(0);
  rider.root.rotation.z = -0.12;
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

export const vehicleVariantSpec = (variant: VehicleVariant): VehicleVariantSpec => {
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
  geometries: CharacterGeometrySet,
  color: number,
  seed: number,
  index: number,
  variant: VehicleVariant,
): Group => {
  const spec = vehicleVariantSpec(variant);
  const root = new Group();
  root.userData["sceneRole"] = "ambient-vehicle";
  root.userData["vehicleVariant"] = variant;

  const body = new Mesh(new BoxGeometry(spec.length, spec.bodyHeight, spec.width), material(color));
  body.position.y = spec.wheelRadius + spec.bodyHeight * 0.62;
  root.add(body);

  const cabinLength =
    variant === "truck"
      ? spec.length * 0.32
      : variant === "pickup"
        ? spec.length * 0.4
        : spec.length * 0.48;
  const cabinX = variant === "truck" ? spec.length * 0.25 : -spec.length * 0.08;
  const cabinBase = new Mesh(new BoxGeometry(cabinLength, 0.16, spec.width * 0.9), material(color));
  cabinBase.position.set(cabinX, spec.wheelRadius + spec.bodyHeight + 0.08, 0);
  root.add(cabinBase);

  const glass = new MeshStandardMaterial({
    color: 0xb9_d2_d8,
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
    sideWindow.position.set(cabinX, spec.wheelRadius + spec.bodyHeight + spec.cabinHeight * 0.5, z);
    root.add(sideWindow);
  }

  const roof = new Mesh(
    new BoxGeometry(cabinLength * 0.9, 0.08, spec.width * 0.9),
    material(color),
  );
  roof.position.set(cabinX, spec.wheelRadius + spec.bodyHeight + spec.cabinHeight, 0);
  root.add(roof);

  if (variant === "pickup") {
    const bed = new Mesh(
      new BoxGeometry(spec.length * 0.34, spec.bodyHeight * 0.46, spec.width * 0.88),
      material(color),
    );
    bed.position.set(-spec.length * 0.31, spec.wheelRadius + spec.bodyHeight * 0.84, 0);
    root.add(bed);
  } else if (variant === "truck") {
    const cargo = new Mesh(
      new BoxGeometry(spec.length * 0.48, 1.7, spec.width * 0.94),
      material(color),
    );
    cargo.position.set(-spec.length * 0.24, spec.wheelRadius + 1.36, 0);
    root.add(cargo);
  } else {
    const hood = new Mesh(
      new BoxGeometry(spec.length * 0.24, spec.bodyHeight * 0.34, spec.width * 0.88),
      material(color),
    );
    hood.position.set(spec.length * 0.39, spec.wheelRadius + spec.bodyHeight * 1.02, 0);
    root.add(hood);
  }

  const axleX = spec.length * 0.31;
  const wheelZ = spec.width * 0.47;
  for (const x of [-axleX, axleX]) {
    for (const z of [-wheelZ, wheelZ]) {
      const wheel = new Mesh(
        new CylinderGeometry(spec.wheelRadius, spec.wheelRadius, 0.18, 12),
        material(0x2c_30_34),
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, spec.wheelRadius, z);
      root.add(wheel);
    }
  }

  const driver = createTransportCharacter(geometries, seed ^ 0x51_a7, 10_100 + index);
  driver.root.userData["sceneRole"] = "ambient-driver";
  applyThreeCharacterPose(driver, seatedCharacterPose("driver"));
  const roofY = spec.wheelRadius + spec.bodyHeight + spec.cabinHeight;
  driver.root.rotation.y = characterRotationYForRouteYaw(0);
  driver.root.updateMatrixWorld(true);
  const headCenter = driver.head.getWorldPosition(new Vector3());
  const renderedHeadRadiusY =
    CHARACTER_ANATOMY.head.radius *
    1.04 *
    driver.profile.heightScale *
    WORLD_SCALE.character.renderScale;
  const renderedHeadTop = headCenter.y + renderedHeadRadiusY;
  driver.root.position.set(cabinX, roofY - renderedHeadTop - 0.04, 0.12);
  root.add(driver.root);

  return root;
};

const VEHICLE_VARIANTS = [
  "sedan",
  "sports",
  "pickup",
  "truck",
] as const satisfies readonly VehicleVariant[];

const VEHICLE_COLORS = [
  0x71_89_a8, 0xa6_5e_52, 0x6b_7c_61, 0x8a_79_6d, 0x52_6f_86, 0xb1_7b_45, 0x63_74_5f, 0x7d_72_70,
] as const;

const BICYCLE_COLORS = [0x4f_7f_91, 0xb4_5d_4c, 0x75_86_4f] as const;

const actorIdentitySalt = (actorId: string): number => {
  let hash = 0x81_1c_9d_c5;
  for (let index = 0; index < actorId.length; index += 1) {
    hash = Math.imul(hash ^ actorId.charCodeAt(index), 0x01_00_01_93);
  }
  return hash >>> 0;
};

const createBicycleForActor = (
  geometries: CharacterGeometrySet,
  seed: number,
  actorId: string,
): Group => {
  const identitySalt = actorIdentitySalt(actorId);
  const profileSeed = seed ^ identitySalt;
  const color =
    BICYCLE_COLORS[
      Math.floor(ambientUnit(profileSeed, 29_001) * BICYCLE_COLORS.length) % BICYCLE_COLORS.length
    ] ?? BICYCLE_COLORS[0];
  const bicycle = createBicycle(geometries, color, profileSeed, identitySalt % 20_000);
  bicycle.userData["mobilityActorId"] = actorId;
  return bicycle;
};

const createVehicleForActor = (
  geometries: CharacterGeometrySet,
  seed: number,
  actorId: string,
): Group => {
  const identitySalt = actorIdentitySalt(actorId);
  const profileSeed = seed ^ identitySalt;
  const variant =
    VEHICLE_VARIANTS[
      Math.floor(ambientUnit(profileSeed, 30_001) * VEHICLE_VARIANTS.length) %
        VEHICLE_VARIANTS.length
    ] ?? "sedan";
  const color =
    VEHICLE_COLORS[
      Math.floor(ambientUnit(profileSeed, 30_002) * VEHICLE_COLORS.length) % VEHICLE_COLORS.length
    ] ?? VEHICLE_COLORS[0];
  const vehicle = createVehicle(geometries, color, profileSeed, identitySalt % 20_000, variant);
  vehicle.userData["mobilityActorId"] = actorId;
  return vehicle;
};

const BIRD_RECYCLE_GAP = 0.12;

export const birdRouteProgressAt = (
  elapsedMs: number,
  durationMs: number,
  offset: number,
  speed: number,
): number | null => {
  const duration = Math.max(1, durationMs);
  const cycle = (Math.max(0, elapsedMs) / duration) * Math.max(0, speed) + offset;
  const wrapped = cycle - Math.floor(cycle);
  const activeSpan = 1 - BIRD_RECYCLE_GAP;
  if (wrapped >= activeSpan) {
    return null;
  }
  return wrapped / activeSpan;
};

export type TransportGait = Readonly<{
  stride: number;
  lift: number;
}>;

export const transportGaitAt = (elapsedMs: number, speed: number): TransportGait => {
  if (speed <= 0) {
    return Object.freeze({ stride: 0, lift: 0 });
  }
  const cycle = elapsedMs * 0.009 * speed;
  return Object.freeze({
    stride: Math.sin(cycle) * 0.52,
    lift: Math.abs(Math.sin(cycle)) * 0.018,
  });
};

const REDUCED_DETAIL_ROLES = new Set([
  "face-expression",
  "eye-white",
  "eye-pupil",
  "hair-detail",
  "garment-detail",
  "character-bag",
]);

const applyMobilityRenderDetail = (root: Object3D, detail: MobilityPose["detail"]): void => {
  root.userData["mobilityDetail"] = detail;
  root.traverse((child) => {
    const role: unknown = child.userData["sceneRole"];
    if (typeof role !== "string" || !REDUCED_DETAIL_ROLES.has(role)) {
      return;
    }
    child.visible = detail === "full";
  });
};

const distributedTrafficPoses = (
  poses: readonly MobilityPose[],
  limit: number,
): readonly MobilityPose[] => {
  const safeLimit = Math.max(0, Math.trunc(limit));
  if (safeLimit === 0) {
    return Object.freeze([]);
  }

  const primaryByStreet = new Map<string, MobilityPose>();
  const extras: MobilityPose[] = [];
  for (const pose of poses) {
    const match = /^traffic-vehicle:([^:]+):v\d+$/.exec(pose.id);
    const streetId = match?.[1];
    if (streetId !== undefined && !primaryByStreet.has(streetId)) {
      primaryByStreet.set(streetId, pose);
    } else {
      extras.push(pose);
    }
  }

  return Object.freeze([...primaryByStreet.values(), ...extras].slice(0, safeLimit));
};

const placeRig = (
  rig: TransportCharacterRig,
  pose: MobilityPose | undefined,
  elapsedMs: number,
): void => {
  rig.root.visible = pose?.visible === true;
  if (!pose?.visible) {
    return;
  }
  applyMobilityRenderDetail(rig.root, pose.detail);
  rig.root.position.set(pose.x, 0, pose.z);
  rig.root.rotation.y = characterRotationYForRouteYaw(pose.yaw);
  rig.root.rotation.z = 0;
  // Clock-driven actors expose authoritative locomotion distance. Legacy
  // service/crossing actors remain on a temporary renderer fallback until #212
  // migrates their motion to the same actor-owned clock.
  const travelDistance =
    pose.travelDistance ?? (Math.max(0, elapsedMs) / 1000) * Math.max(0, pose.speed);
  const serviceInteraction =
    pose.interaction === "gardening" || pose.interaction === "mailbox"
      ? serviceInteractionPose(pose.interaction, elapsedMs)
      : null;
  const preserveLocomotionPose =
    serviceInteraction === null && (pose.travelDistance !== null || pose.speed > 0);
  const characterPose =
    serviceInteraction ??
    characterPoseAtDistance(rig.profile, travelDistance, {
      moving: preserveLocomotionPose,
    });
  applyThreeCharacterPose(rig, characterPose);
  applyCharacterExpressionPose(
    rig.head,
    characterExpressionAt(characterPose.expression, actorIdentitySalt(pose.id), elapsedMs),
  );
};

export const createAmbientLife = (
  scene: Scene,
  seed: number,
  owners: readonly Object3D[] = [],
  mobilitySeed = seed,
): AmbientLifeController => {
  const characterGeometries = createCharacterGeometrySet();
  const pets = [createPet(0xa9_6f_45), createPet(0x3e_3a_36), createPet(0xd1_b4_8b)];
  const wildlifeProfiles = Array.from({ length: 4 }, (_, index) =>
    birdFlightProfileFor(seed ^ 0x42_49_52_44, index),
  );
  const wildlife = wildlifeProfiles.map((profile) => createBird(profile));
  const bicycleVisuals = new Map<string, Group>();
  const vehicleVisuals = new Map<string, Group>();
  const ambientPetOwners = pets.slice(0, 2).map((_, index) => owners[index]);
  const residents = [
    createTransportCharacter(characterGeometries, seed ^ 0x73_41, 12_000),
    createTransportCharacter(characterGeometries, seed ^ 0x73_41, 12_001),
    createTransportCharacter(characterGeometries, seed ^ 0x73_41, 12_002),
    createTransportCharacter(characterGeometries, seed ^ 0x73_41, 12_003),
  ];
  const mailCarrier = createTransportCharacter(characterGeometries, seed ^ 0x4d_41_49_4c, 12_100);
  const gardener = createTransportCharacter(characterGeometries, seed ^ 0x47_41_52_44, 12_200);
  mailCarrier.root.userData["sceneRole"] = "ambient-mail-carrier";
  gardener.root.userData["sceneRole"] = "ambient-gardener";
  residents.forEach((resident, index) => {
    resident.root.userData["sceneRole"] = "ambient-resident";
    resident.root.userData["residentIndex"] = index;
  });

  const mobility = createNeighborhoodMobilitySystem(mobilitySeed);

  const bicycleForActor = (actorId: string): Group => {
    const existing = bicycleVisuals.get(actorId);
    if (existing !== undefined) {
      return existing;
    }
    const bicycle = createBicycleForActor(characterGeometries, seed, actorId);
    bicycle.visible = false;
    bicycleVisuals.set(actorId, bicycle);
    scene.add(bicycle);
    return bicycle;
  };

  const vehicleForActor = (actorId: string): Group => {
    const existing = vehicleVisuals.get(actorId);
    if (existing !== undefined) {
      return existing;
    }
    const vehicle = createVehicleForActor(characterGeometries, seed, actorId);
    vehicle.visible = false;
    vehicleVisuals.set(actorId, vehicle);
    scene.add(vehicle);
    return vehicle;
  };

  for (const actor of [
    ...pets,
    ...wildlife,
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
        const owner = ambientPetOwners[index];
        pet.visible = index < population.pets && owner?.visible === true;
        if (!pet.visible || owner === undefined) {
          return;
        }
        const pose = petFollowPose(
          {
            x: owner.position.x,
            z: owner.position.z,
            heading: owner.rotation.y,
          },
          index,
        );
        const gait = Math.sin(elapsedMs * 0.012 + index * 1.7 + (seed & 15) * 0.21);
        pet.position.set(pose.x, Math.abs(gait) * 0.018, pose.z);
        pet.rotation.y = pose.yaw;
        pet.rotation.z = gait * 0.025;
        pedestrianObstacles.push({ x: pose.x, z: pose.z });
      });

      for (const owner of owners) {
        if (!owner.visible) {
          continue;
        }
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

      updateNeighborhoodActivity(scene, sample.properties, elapsedMs);

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

      const residentPoses = sample.actors.filter((actor) => actor.kind === "resident");
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
        if (index >= population.wildlife) {
          bird.visible = false;
          return;
        }
        const profile = wildlifeProfiles[index];
        if (profile === undefined) {
          bird.visible = false;
          return;
        }
        const progress = birdRouteProgressAt(
          elapsedMs,
          durationMs,
          profile.routeOffset,
          profile.speed,
        );
        bird.visible = progress !== null;
        if (progress === null) {
          return;
        }
        const x = profile.direction === 1 ? -20 + progress * 40 : 20 - progress * 40;
        bird.position.set(
          x,
          profile.altitude +
            Math.sin(progress * Math.PI * 4 + profile.phase) * profile.verticalAmplitude,
          profile.depth,
        );
        bird.rotation.y = xTravelYaw(profile.direction);
        bird.rotation.z =
          profile.direction * Math.sin(progress * Math.PI * 12 + profile.phase) * 0.08;
        for (const child of bird.children) {
          if (child.userData["sceneRole"] !== "ambient-bird-wing") {
            continue;
          }
          const side = Math.sign(child.position.z) || 1;
          child.rotation.x =
            side * (0.18 + Math.sin(progress * Math.PI * profile.wingBeat + profile.phase) * 0.42);
        }
      });

      const bicyclePoses = sample.actors.filter(
        (actor) => actor.kind === "bicycle" && actor.visible,
      );
      for (const bicycle of bicycleVisuals.values()) {
        bicycle.visible = false;
      }
      for (const pose of bicyclePoses.slice(0, population.bicycles)) {
        const bicycle = bicycleForActor(pose.id);
        bicycle.visible = true;
        bicycle.userData["mobilityActorId"] = pose.id;
        applyMobilityRenderDetail(bicycle, pose.detail);
        bicycle.position.set(pose.x, 0.02, pose.z);
        bicycle.rotation.y = -pose.yaw;
        applyCharacterExpressionPose(
          bicycle,
          characterExpressionAt(ambientNeutralExpression, actorIdentitySalt(pose.id), elapsedMs),
        );
      }

      const allVehiclePoses = sample.actors.filter(
        (actor) => actor.kind === "vehicle" && actor.visible,
      );
      const residentVehicle = allVehiclePoses.find((actor) => actor.id === "resident-vehicle");
      const throughTraffic = allVehiclePoses.filter((actor) => actor.id !== "resident-vehicle");
      const vehiclePoses = [
        ...(residentVehicle === undefined ? [] : [residentVehicle]),
        ...distributedTrafficPoses(
          throughTraffic,
          Math.max(0, population.vehicles - (residentVehicle === undefined ? 0 : 1)),
        ),
      ];
      for (const vehicle of vehicleVisuals.values()) {
        vehicle.visible = false;
      }
      for (const pose of vehiclePoses) {
        const vehicle = vehicleForActor(pose.id);
        vehicle.visible = true;
        vehicle.userData["mobilityActorId"] = pose.id;
        applyMobilityRenderDetail(vehicle, pose.detail);
        vehicle.position.set(pose.x, 0.02, pose.z);
        vehicle.rotation.y = -pose.yaw;
        applyCharacterExpressionPose(
          vehicle,
          characterExpressionAt(ambientNeutralExpression, actorIdentitySalt(pose.id), elapsedMs),
        );
      }
      return sample;
    },
  });
};
