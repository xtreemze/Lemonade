import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  type Scene,
  SphereGeometry,
} from "three";
import { type PropertyActivity, sprinklerEligibleAt } from "./neighborhood-mobility.js";
import {
  createPropertyAccessSurfaceField,
  type PropertyAccessSurfaceSpec,
} from "./property-access-surface-field.js";
import {
  DEFAULT_RESIDENTIAL_SEED,
  generateResidentialLayout,
  type ResidentialPropertySpec,
  residentialAccessLayout,
  residentialFootprintIntersectsHardscape,
} from "./residential-layout.js";
import { generateStreetNetwork, STREET_LAYOUT } from "./street-layout.js";
import { createStreetSurfaceField } from "./street-surface-field.js";
import { WORLD_SCALE } from "./world-scale.js";

const material = (color: number, flatShading = true): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading, roughness: 0.92 });

const box = (
  parent: Object3D,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  color: number,
): Mesh => {
  const mesh = new Mesh(new BoxGeometry(...size), material(color));
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
};

const road = (
  scene: Scene,
  width: number,
  depth: number,
  x: number,
  z: number,
  color: number,
  y = 0.014,
  role?: string,
): Mesh => {
  const mesh = new Mesh(new PlaneGeometry(width, depth), material(color));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  if (role !== undefined) {
    mesh.userData["sceneRole"] = role;
  }
  scene.add(mesh);
  return mesh;
};

const markWindResponsive = (root: Group, phase: number): Group => {
  root.userData["windResponsive"] = true;
  root.userData["windPhase"] = phase;
  root.userData["windBaseRotationX"] = root.rotation.x;
  root.userData["windBaseRotationZ"] = root.rotation.z;
  return root;
};

const detailedHouse = (color: number): Group => {
  const root = new Group();
  box(root, [5.8, 3.4, 4.5], [0, 1.7, 0], color);
  box(root, [5.95, 0.18, 4.62], [0, 0.18, 0], 0xc7_a9_80);
  const roof = new Mesh(new CylinderGeometry(0, 4.4, 2.25, 4), material(0x7f_4a_43));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 4.45;
  root.add(roof);

  const doorPivot = new Group();
  doorPivot.position.set(-WORLD_SCALE.house.doorWidth / 2, 0, 2.34);
  doorPivot.userData["sceneRole"] = "house-door";
  const door = box(
    doorPivot,
    [WORLD_SCALE.house.doorWidth, WORLD_SCALE.house.doorHeight, 0.18],
    [WORLD_SCALE.house.doorWidth / 2, WORLD_SCALE.house.doorHeight / 2, 0],
    0x48_6c_69,
  );
  door.userData["sceneRole"] = "house-door-panel";
  root.add(doorPivot);
  box(
    root,
    [WORLD_SCALE.house.doorWidth + 0.18, 0.12, 0.12],
    [0, WORLD_SCALE.house.doorHeight + 0.06, 2.47],
    0xf1_df_bd,
  );
  box(
    root,
    [0.11, WORLD_SCALE.house.doorHeight + 0.12, 0.12],
    [-(WORLD_SCALE.house.doorWidth / 2 + 0.07), WORLD_SCALE.house.doorHeight / 2, 2.47],
    0xf1_df_bd,
  );
  box(
    root,
    [0.11, WORLD_SCALE.house.doorHeight + 0.12, 0.12],
    [WORLD_SCALE.house.doorWidth / 2 + 0.07, WORLD_SCALE.house.doorHeight / 2, 2.47],
    0xf1_df_bd,
  );
  const knob = new Mesh(new SphereGeometry(0.055, 8, 6), material(0xc8_9a_3c));
  knob.position.set(0.3, 1.02, 2.47);
  root.add(knob);

  for (const x of [-1.7, 1.7]) {
    const windowPane = box(root, [0.92, 0.95, 0.14], [x, 2.1, 2.36], 0xb8_d9_d2);
    windowPane.userData["sceneRole"] = "house-window";
    box(root, [1.08, 0.1, 0.11], [x, 2.62, 2.46], 0xf1_df_bd);
    box(root, [1.08, 0.1, 0.11], [x, 1.58, 2.46], 0xf1_df_bd);
    box(root, [0.1, 1.05, 0.11], [x - 0.51, 2.1, 2.46], 0xf1_df_bd);
    box(root, [0.1, 1.05, 0.11], [x + 0.51, 2.1, 2.46], 0xf1_df_bd);
    box(root, [0.08, 0.95, 0.1], [x, 2.1, 2.47], 0xf1_df_bd);
    box(root, [0.92, 0.08, 0.1], [x, 2.1, 2.47], 0xf1_df_bd);
  }

  box(root, [3.8, 0.22, 1.05], [0, 0.25, 2.62], 0xb9_9b_78);
  box(root, [2.8, 0.16, 0.52], [0, 0.12, 3.05], 0xc9_b0_8d);
  box(root, [0.58, 1.15, 0.72], [1.75, 4.75, -0.72], 0x9b_5f_4f);

  const porchLamp = new Mesh(new SphereGeometry(0.12, 8, 6), material(0xff_d9_8a, false));
  porchLamp.position.set(0.92, 1.86, 2.5);
  root.add(porchLamp);
  return root;
};

const distantHouse = (color: number): Group => {
  const root = new Group();
  box(root, [5.8, 3.4, 4.5], [0, 1.7, 0], color);
  const roof = new Mesh(new CylinderGeometry(0, 4.4, 2.25, 4), material(0x76_50_48));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 4.45;
  root.add(roof);
  return root;
};

const distanceLod = (
  near: Group,
  far: Group,
  threshold: number,
  x: number,
  z: number,
  scale: number,
  rotationY = 0,
): Group => {
  const root = new Group();
  root.add(near, far);
  far.visible = false;
  root.position.set(x, 0, z);
  root.rotation.y = rotationY;
  root.scale.setScalar(scale);
  root.userData["lodMode"] = "distance-two-level";
  root.onBeforeRender = (_renderer, _scene, camera) => {
    const dx = camera.position.x - root.position.x;
    const dz = camera.position.z - root.position.z;
    const nearVisible = dx * dx + dz * dz < threshold * threshold;
    near.visible = nearVisible;
    far.visible = !nearVisible;
  };
  return root;
};

const houseLod = (x: number, z: number, color: number, scale: number, rotationY: number): Group =>
  distanceLod(detailedHouse(color), distantHouse(color), 34, x, z, scale, rotationY);

const plantUnit = (seed: number, salt: number): number => {
  let value = Math.imul((seed ^ salt) >>> 0, 0x9e_37_79_b1);
  value = Math.imul(value ^ (value >>> 16), 0x21_f0_aa_ad);
  return ((value ^ (value >>> 15)) >>> 0) / 0xff_ff_ff_ff;
};

const detailedTree = (color: number, seed: number): Group => {
  const root = new Group();
  const woodMaterial = material(0x76_52_32);
  const trunkHeight = 2.35 + plantUnit(seed, 11) * 0.75;
  const trunk = new Mesh(
    new CylinderGeometry(
      0.18 + plantUnit(seed, 13) * 0.08,
      0.31 + plantUnit(seed, 17) * 0.09,
      trunkHeight,
      7,
    ),
    woodMaterial,
  );
  trunk.position.y = trunkHeight / 2;
  trunk.rotation.z = (plantUnit(seed, 19) - 0.5) * 0.1;
  root.add(trunk);

  const branchGeometry = new CylinderGeometry(0.06, 0.14, 1, 12);
  for (const direction of [-1, 1] as const) {
    const branchLength = 0.82 + plantUnit(seed, 23 + direction) * 0.52;
    const branch = new Mesh(branchGeometry, woodMaterial);
    branch.scale.y = branchLength;
    branch.position.set(
      direction * (0.2 + plantUnit(seed, 29 + direction) * 0.18),
      trunkHeight * (0.62 + plantUnit(seed, 31 + direction) * 0.12),
      (plantUnit(seed, 37 + direction) - 0.5) * 0.26,
    );
    branch.rotation.x = -Math.PI / 2;
    branch.rotation.z = direction * (0.78 + plantUnit(seed, 41 + direction) * 0.28);
    root.add(branch);
  }

  const crownGeometry = new SphereGeometry(1.25, 10, 7);
  const foliageMaterial = material(color);
  const crownCount = 3 + Math.floor(plantUnit(seed, 47) * 3);
  for (let index = 0; index < crownCount; index += 1) {
    const angle = plantUnit(seed, 53 + index * 7) * Math.PI * 2;
    const radius = index === 0 ? 0 : 0.35 + plantUnit(seed, 59 + index * 5) * 0.65;
    const size = 0.88 + plantUnit(seed, 61 + index * 11) * 0.72;
    const crown = new Mesh(crownGeometry, foliageMaterial);
    crown.scale.set(
      size * (0.84 + plantUnit(seed, 67 + index) * 0.36),
      size * (0.9 + plantUnit(seed, 71 + index) * 0.34),
      size * (0.82 + plantUnit(seed, 73 + index) * 0.32),
    );
    crown.position.set(
      Math.cos(angle) * radius,
      trunkHeight + 0.66 + plantUnit(seed, 79 + index) * 0.92,
      Math.sin(angle) * radius * 0.48,
    );
    root.add(crown);
  }
  return root;
};

const distantTree = (color: number, seed: number): Group => {
  const root = new Group();
  const trunkHeight = 2.3 + plantUnit(seed, 83) * 0.55;
  const trunk = new Mesh(new CylinderGeometry(0.2, 0.3, trunkHeight, 5), material(0x76_52_32));
  trunk.position.y = trunkHeight / 2;
  const crown = new Mesh(
    new SphereGeometry(1.9 + plantUnit(seed, 89) * 0.42, 7, 5),
    material(color),
  );
  crown.scale.set(1, 0.9 + plantUnit(seed, 97) * 0.25, 0.92);
  crown.position.y = trunkHeight + 1.1;
  root.add(trunk, crown);
  return root;
};

const treeLod = (
  x: number,
  z: number,
  scale: number,
  color: number,
  phase: number,
  seed: number,
): Group => {
  const variant = Math.floor(plantUnit(seed, 101) * 1000);
  const root = distanceLod(detailedTree(color, seed), distantTree(color, seed), 28, x, z, scale);
  root.userData["sceneRole"] = "procedural-tree";
  root.userData["plantVariant"] = variant;
  root.userData["proceduralSeed"] = seed >>> 0;
  root.userData["proceduralTechnique"] = "seeded-distance-lod";
  return markWindResponsive(root, phase);
};

const detailedShrub = (color: number, seed: number): Group => {
  const root = new Group();
  const crownGeometry = new SphereGeometry(1, 8, 6);
  const crownMaterial = material(color);
  const lobeCount = 3 + Math.floor(plantUnit(seed, 107) * 3);
  for (let index = 0; index < lobeCount; index += 1) {
    const angle = plantUnit(seed, 109 + index * 7) * Math.PI * 2;
    const radius = 0.16 + plantUnit(seed, 113 + index * 5) * 0.48;
    const size = 0.52 + plantUnit(seed, 127 + index * 11) * 0.48;
    const crown = new Mesh(crownGeometry, crownMaterial);
    crown.scale.set(
      size * (0.9 + plantUnit(seed, 131 + index) * 0.32),
      size * (0.82 + plantUnit(seed, 137 + index) * 0.3),
      size * (0.88 + plantUnit(seed, 139 + index) * 0.28),
    );
    crown.position.set(Math.cos(angle) * radius, size * 0.68, Math.sin(angle) * radius * 0.65);
    root.add(crown);
  }
  return root;
};

const distantShrub = (color: number, seed: number): Group => {
  const root = new Group();
  const size = 0.72 + plantUnit(seed, 149) * 0.38;
  const crown = new Mesh(new SphereGeometry(size, 6, 4), material(color));
  crown.scale.set(1.2, 0.72, 0.92);
  crown.position.y = size * 0.62;
  root.add(crown);
  return root;
};

const shrubLod = (
  x: number,
  z: number,
  scale: number,
  color: number,
  phase: number,
  seed: number,
): Group => {
  const root = distanceLod(detailedShrub(color, seed), distantShrub(color, seed), 18, x, z, scale);
  root.userData["sceneRole"] = "procedural-shrub";
  root.userData["plantVariant"] = Math.floor(plantUnit(seed, 151) * 1000);
  root.userData["proceduralSeed"] = seed >>> 0;
  root.userData["proceduralTechnique"] = "seeded-distance-lod";
  return markWindResponsive(root, phase);
};

const flower = (x: number, z: number, color: number, phase: number, seed: number): Group => {
  const root = new Group();
  const stemGeometry = new CylinderGeometry(0.018, 0.025, 1, 5);
  const blossomGeometry = new SphereGeometry(0.055, 7, 5);
  const stemMaterial = material(0x4f_82_46);
  const centerMaterial = material(0xe1_ad_35);
  const petalMaterial = material(color);
  const flowerCount = 5;

  for (let flowerIndex = 0; flowerIndex < flowerCount; flowerIndex += 1) {
    const cluster = new Group();
    const radius = flowerIndex === 0 ? 0 : 0.12 + plantUnit(seed, 157 + flowerIndex * 11) * 0.18;
    const angle = plantUnit(seed, 163 + flowerIndex * 13) * Math.PI * 2;
    const height = 0.32 + plantUnit(seed, 167 + flowerIndex * 17) * 0.11;
    const stem = new Mesh(stemGeometry, stemMaterial);
    stem.scale.y = height;
    stem.position.y = height / 2;
    cluster.add(stem);

    const centerY = height + 0.035;
    const center = new Mesh(blossomGeometry, centerMaterial);
    center.position.y = centerY;
    cluster.add(center);

    const petalPhase = plantUnit(seed, 173 + flowerIndex * 19) * Math.PI * 2;
    for (let petalIndex = 0; petalIndex < 5; petalIndex += 1) {
      const petalAngle = petalPhase + (petalIndex / 5) * Math.PI * 2;
      const petal = new Mesh(blossomGeometry, petalMaterial);
      petal.scale.set(1.3, 0.7, 0.55);
      petal.position.set(
        Math.cos(petalAngle) * 0.075,
        centerY + Math.sin(petalAngle) * 0.075,
        0.012,
      );
      cluster.add(petal);
    }
    cluster.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    root.add(cluster);
  }

  root.position.set(x, 0, z);
  root.userData["sceneRole"] = "garden-flower";
  root.userData["flowerCount"] = flowerCount;
  root.userData["proceduralSeed"] = seed >>> 0;
  return markWindResponsive(root, phase);
};

// Half-thickness of a fence's end posts (box width 0.12 / 2). The outermost
// posts are centered at +/-width/2, so they overhang the nominal `width` by
// this much on each side; callers validating hardscape clearance must add it.
const FENCE_POST_HALF_THICKNESS = 0.06;

const fenceRun = (x: number, z: number, width: number): Group => {
  const root = new Group();
  box(root, [width, 0.1, 0.1], [0, 0.56, 0], 0xe9_df_c7);
  box(root, [width, 0.1, 0.1], [0, 0.92, 0], 0xe9_df_c7);
  const posts = 6;
  for (let index = 0; index < posts; index += 1) {
    const offset = -width / 2 + (index / (posts - 1)) * width;
    box(root, [0.12, 1.2, 0.12], [offset, 0.6, 0], 0xf4_ea_d4);
  }
  root.position.set(x, 0, z);
  root.userData["sceneRole"] = "fence";
  return root;
};

const mailbox = (x: number, z: number): Group => {
  const root = new Group();
  box(root, [0.12, 1.05, 0.12], [0, 0.53, 0], 0x6e_5a_43);
  box(root, [0.48, 0.32, 0.34], [0, 1.08, 0], 0x54_7c_85);
  box(root, [0.42, 0.25, 0.035], [0, 1.08, 0.19], 0x45_6b_73);
  box(root, [0.08, 0.42, 0.08], [0.27, 1.18, 0], 0xc9_5b_4c);
  root.position.set(x, 0, z);
  root.rotation.y = -Math.PI / 2;
  root.userData["sceneRole"] = "mailbox";
  root.userData["streetFacingYaw"] = -Math.PI / 2;
  return root;
};

const sprinkler = (x: number, z: number, propertyRole: string): Group => {
  const root = new Group();
  root.position.set(x, 0.03, z);
  root.visible = false;
  root.userData["sceneRole"] = "yard-sprinkler";
  root.userData["propertyRole"] = propertyRole;
  const hub = new Mesh(new CylinderGeometry(0.08, 0.1, 0.16, 8), material(0x64_7b_83));
  hub.position.y = 0.08;
  root.add(hub);
  const arm = new Group();
  arm.userData["sceneRole"] = "sprinkler-arm";
  box(arm, [0.7, 0.035, 0.035], [0, 0.19, 0], 0x73_93_a0);
  box(arm, [0.035, 0.035, 0.22], [0.34, 0.19, 0.1], 0x73_93_a0);
  box(arm, [0.035, 0.035, 0.22], [-0.34, 0.19, -0.1], 0x73_93_a0);
  root.add(arm);
  return root;
};

const distantHill = (
  scene: Scene,
  x: number,
  z: number,
  width: number,
  height: number,
  color: number,
): void => {
  const hill = new Mesh(new SphereGeometry(1, 12, 7), material(color));
  hill.scale.set(width, height, width * 0.4);
  hill.position.set(x, -height * 0.22, z);
  scene.add(hill);
};

const atmosphereBand = (
  scene: Scene,
  z: number,
  y: number,
  width: number,
  height: number,
  color: number,
  opacity: number,
): void => {
  const hazeMaterial = new MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 1,
    depthWrite: false,
  });
  const band = new Mesh(new PlaneGeometry(width, height), hazeMaterial);
  band.position.set(0, y, z);
  scene.add(band);
};

export type NeighborhoodStats = Readonly<{
  houseLods: number;
  featuredHomes: number;
  frontProperties: number;
  driveways: number;
  treeLods: number;
  shrubs: number;
  flowers: number;
  yardDetails: number;
  pavedRoads: number;
  windResponsive: number;
  roadSegments: number;
  worldSpan: number;
}>;

export type FrontPropertySpec = ResidentialPropertySpec;

const HOUSE_PALETTE = [
  0xc9_7d_65, 0xd5_6f_52, 0xd4_aa_61, 0xd5_a6_6d, 0x8d_a9_a1, 0xc2_7a_68, 0xdf_b7_6f,
] as const;
const TREE_PALETTE = [
  0x66_8e_53, 0x5f_8d_56, 0x50_7f_4b, 0x6d_98_5e, 0x58_85_4f, 0x67_8f_52, 0x4f_81_4c,
] as const;
const FLOWER_PALETTE = [0xe9_8d_9e, 0xf1_c7_5b, 0x9e_83_c7, 0xf4_ee_e5, 0xd9_70_58] as const;

export const FRONT_PROPERTY_LAYOUT: readonly FrontPropertySpec[] =
  generateResidentialLayout(DEFAULT_RESIDENTIAL_SEED).frontProperties;

export type NeighborhoodWeather = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";

type WindRegistry = Readonly<{
  rootChildCount: number;
  objects: readonly Object3D[];
}>;

const windRegistryByScene = new WeakMap<Scene, WindRegistry>();

const refreshWindRegistry = (scene: Scene): WindRegistry => {
  const objects: Object3D[] = [];
  scene.traverse((object) => {
    if (object.userData["windResponsive"] === true) {
      objects.push(object);
    }
  });
  const registry = Object.freeze({
    rootChildCount: scene.children.length,
    objects: Object.freeze(objects),
  });
  windRegistryByScene.set(scene, registry);
  return registry;
};

const windRegistryFor = (scene: Scene): WindRegistry => {
  const cached = windRegistryByScene.get(scene);
  if (cached?.rootChildCount === scene.children.length) {
    return cached;
  }
  return refreshWindRegistry(scene);
};

export const weatherWindStrength = (weather: NeighborhoodWeather): number => {
  switch (weather) {
    case "sunny":
      return 0.012;
    case "cloudy":
      return 0.022;
    case "hot-and-dry":
      return 0.034;
    case "thunderstorm":
      return 0.11;
  }
};

export const weatherWindGustAt = (
  weather: NeighborhoodWeather,
  seconds: number,
  phase = 0,
): number => {
  const primary = Math.sin(seconds * 1.25 + phase) * 0.62;
  const secondary = Math.sin(seconds * 2.7 + phase * 1.7) * 0.26;
  const flutter = Math.sin(seconds * 5.1 + phase * 0.73) * 0.12;
  if (weather !== "thunderstorm") {
    return primary + secondary + flutter;
  }

  const gustWindow = Math.max(0, Math.sin(seconds * 0.72 + phase * 0.31 + 0.8));
  const burst = gustWindow * gustWindow * gustWindow * gustWindow;
  return (primary + secondary + flutter) * (1 + burst * 0.75);
};

export const updateNeighborhoodWind = (
  scene: Scene,
  seconds: number,
  weather: NeighborhoodWeather,
): void => {
  const strength = weatherWindStrength(weather);
  for (const object of windRegistryFor(scene).objects) {
    const phase = typeof object.userData["windPhase"] === "number" ? object.userData["windPhase"] : 0;
    const baseX =
      typeof object.userData["windBaseRotationX"] === "number" ? object.userData["windBaseRotationX"] : 0;
    const baseZ =
      typeof object.userData["windBaseRotationZ"] === "number" ? object.userData["windBaseRotationZ"] : 0;
    const gust = weatherWindGustAt(weather, seconds, phase);
    const sceneRole: unknown = object.userData["sceneRole"];
    const response =
      sceneRole === "garden-flower" ? 1.65 : sceneRole === "procedural-shrub" ? 1.3 : 1;
    object.rotation.x = baseX + gust * strength * response * 0.32;
    object.rotation.z = baseZ + gust * strength * response;
  }
};

const propertyRoleForObject = (object: Object3D): string | null => {
  let current: Object3D | null = object;
  while (current !== null) {
    const role: unknown = current.userData["propertyRole"];
    if (typeof role === "string") {
      return role;
    }
    current = current.parent;
  }
  return null;
};

export const updateNeighborhoodActivity = (
  scene: Scene,
  activities: readonly PropertyActivity[],
  elapsedMs: number,
): void => {
  const byRole = new Map(activities.map((activity) => [activity.propertyRole, activity] as const));
  scene.traverse((object) => {
    const sceneRole: unknown = object.userData["sceneRole"];
    const propertyRole = propertyRoleForObject(object);
    if (propertyRole === null) {
      return;
    }
    const activity = byRole.get(propertyRole);
    if (activity === undefined) {
      return;
    }

    if (sceneRole === "house-door" && object instanceof Group) {
      object.rotation.y = activity.doorOpen ? -1.08 : 0;
      return;
    }

    if (sceneRole === "house-window" && object instanceof Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const candidate of materials) {
        if (!(candidate instanceof MeshStandardMaterial)) {
          continue;
        }
        candidate.emissive.setHex(activity.windowActivity ? 0xff_c8_6a : 0x00_00_00);
        candidate.emissiveIntensity = activity.windowActivity ? 0.38 : 0;
      }
      return;
    }

    if (sceneRole === "yard-sprinkler" && object instanceof Group) {
      object.visible = activity.sprinklerOn;
      if (!object.visible) {
        return;
      }
      const arm = object.children.find((child) => child.userData["sceneRole"] === "sprinkler-arm");
      if (arm !== undefined) {
        arm.rotation.y = elapsedMs * 0.0045;
      }
    }
  });
};

export const populateNeighborhood = (
  scene: Scene,
  seed = DEFAULT_RESIDENTIAL_SEED,
): NeighborhoodStats => {
  const worldSpan = 240;
  const layout = generateResidentialLayout(seed);
  const streetNetwork = generateStreetNetwork(seed);
  let roadSegments = streetNetwork.roads.length + streetNetwork.sidewalks.length;
  const pavedRoads = streetNetwork.roads.length;

  const streetSurfaces = createStreetSurfaceField(streetNetwork.roads, streetNetwork.sidewalks);
  for (const anchor of streetSurfaces.anchors) {
    scene.add(anchor);
  }
  for (const mesh of streetSurfaces.meshes) {
    scene.add(mesh);
  }

  for (let x = -115; x <= 115; x += 7.5) {
    road(scene, 3.2, 0.075, x, STREET_LAYOUT.road.centerZ, 0xd8_c9_78, 0.026, "road-marking");
  }

  const allProperties = [
    ...layout.frontProperties,
    ...layout.middleProperties,
    ...layout.backProperties,
    ...layout.outerProperties,
  ];
  const propertyAccessSurfaces: PropertyAccessSurfaceSpec[] = [];
  for (const property of allProperties) {
    const access = residentialAccessLayout(property, seed);
    if (property.drivewayX !== null) {
      propertyAccessSurfaces.push(
        Object.freeze({
          role: "driveway",
          length: access.drivewayLength,
          width: WORLD_SCALE.street.drivewayWidth,
          x: access.drivewayCenterX,
          z: access.drivewayCenterZ,
          rotationY: access.drivewayRotationY,
        }),
        Object.freeze({
          role: "front-path",
          length: access.pathLength,
          width: access.pathWidth,
          x: access.pathCenterX,
          z: access.pathCenterZ,
          rotationY: access.pathRotationY,
        }),
      );
      roadSegments += 2;
    }
    const color = HOUSE_PALETTE[property.color] ?? HOUSE_PALETTE[0];
    const home = houseLod(
      property.houseX,
      property.houseZ,
      color,
      property.scale,
      property.rotationY,
    );
    home.userData["sceneRole"] = layout.frontProperties.includes(property)
      ? property.role
      : `residential-${property.role}`;
    home.userData["propertyRole"] = property.role;
    home.name = `building-${property.role}`;
    scene.add(home);
  }

  const propertyAccessField = createPropertyAccessSurfaceField(propertyAccessSurfaces);
  for (const anchor of propertyAccessField.anchors) {
    scene.add(anchor);
  }
  for (const mesh of propertyAccessField.meshes) {
    scene.add(mesh);
  }

  const housePositions = [
    ...layout.middleProperties,
    ...layout.backProperties,
    ...layout.outerProperties,
  ];

  const yardDetails: Group[] = [];
  const clearYardX = (
    preferredX: number,
    z: number,
    halfWidth: number,
    halfDepth: number,
  ): number | null => {
    const step = 0.45;
    for (let attempt = 0; attempt <= 18; attempt += 1) {
      const magnitude = Math.ceil(attempt / 2) * step;
      const direction = attempt === 0 ? 0 : attempt % 2 === 1 ? 1 : -1;
      const x = preferredX + magnitude * direction;
      if (!residentialFootprintIntersectsHardscape({ x, z }, layout, halfWidth, halfDepth)) {
        return x;
      }
    }
    return null;
  };
  const addYardDetailIfClear = (detail: Group, halfWidth: number, halfDepth: number): void => {
    if (
      residentialFootprintIntersectsHardscape(
        { x: detail.position.x, z: detail.position.z },
        layout,
        halfWidth,
        halfDepth,
      )
    ) {
      return;
    }
    const intersectsTree = layout.trees.some((tree) => {
      const clearance = 3.2 * tree.scale;
      return (
        Math.abs(tree.x - detail.position.x) <= clearance + halfWidth &&
        Math.abs(tree.z - detail.position.z) <= clearance + halfDepth
      );
    });
    if (intersectsTree) {
      return;
    }
    yardDetails.push(detail);
  };

  for (const property of layout.frontProperties) {
    if (property.mailboxX === null) {
      continue;
    }
    const safeX = clearYardX(property.mailboxX, -0.3, 0.3, 0.3);
    if (safeX === null) {
      continue;
    }
    yardDetails.push(mailbox(safeX, -0.3));
  }

  const fencedProperties = [
    ...layout.frontProperties,
    ...layout.middleProperties,
    ...layout.backProperties,
  ];
  for (const property of fencedProperties) {
    const access = residentialAccessLayout(property, seed);
    const fenceZ =
      access.entryZ +
      access.frontDirection * Math.min(1.15, Math.max(0.72, access.pathDepth * 0.18));
    const lotHalfWidth = Math.max(3.8, 4.45 * property.scale);
    const gaps = [
      Object.freeze({
        minX: access.pathCenterX - Math.max(0.86, access.pathWidth / 2 + 0.34),
        maxX: access.pathCenterX + Math.max(0.86, access.pathWidth / 2 + 0.34),
      }),
      ...(property.drivewayX === null
        ? []
        : [
            Object.freeze({
              minX: property.drivewayX - WORLD_SCALE.street.drivewayWidth / 2 - 0.28,
              maxX: property.drivewayX + WORLD_SCALE.street.drivewayWidth / 2 + 0.28,
            }),
          ]),
    ]
      .map((gap) =>
        Object.freeze({
          minX: Math.max(property.houseX - lotHalfWidth, gap.minX),
          maxX: Math.min(property.houseX + lotHalfWidth, gap.maxX),
        }),
      )
      .filter((gap) => gap.maxX > gap.minX)
      .sort((left, right) => left.minX - right.minX);

    let cursor = property.houseX - lotHalfWidth;
    for (const gap of gaps) {
      const width = gap.minX - cursor;
      if (width >= 1.15) {
        const fence = fenceRun(cursor + width / 2, fenceZ, width);
        fence.userData["propertyRole"] = property.role;
        // fenceRun's end posts are centered at +/-width/2 with their own
        // half-thickness (0.06), so the rendered fence is actually
        // FENCE_POST_HALF_THICKNESS wider than `width` on each side.
        addYardDetailIfClear(fence, width / 2 + FENCE_POST_HALF_THICKNESS, 0.06);
      }
      cursor = Math.max(cursor, gap.maxX);
    }
    const finalWidth = property.houseX + lotHalfWidth - cursor;
    if (finalWidth >= 1.15) {
      const fence = fenceRun(cursor + finalWidth / 2, fenceZ, finalWidth);
      fence.userData["propertyRole"] = property.role;
      addYardDetailIfClear(fence, finalWidth / 2 + FENCE_POST_HALF_THICKNESS, 0.06);
    }
  }
  for (const detail of yardDetails) {
    scene.add(detail);
  }

  allProperties.forEach((property, index) => {
    if (!sprinklerEligibleAt(index, property, layout, seed)) {
      return;
    }
    const access = residentialAccessLayout(property, seed);
    const lateral = index % 2 === 0 ? 2.15 : -2.15;
    const x = property.houseX + lateral;
    const z = access.pathCenterZ;
    scene.add(sprinkler(x, z, property.role));
  });

  layout.trees.forEach((planting, index) => {
    const color = TREE_PALETTE[planting.paletteIndex] ?? TREE_PALETTE[0];
    const tree = treeLod(
      planting.x,
      planting.z,
      planting.scale,
      color,
      index * 0.71,
      seed ^ Math.imul(index + 1, 0x4_5d_9f_3b),
    );
    tree.userData["propertyRole"] = planting.propertyRole;
    tree.userData["yardZone"] = planting.yardZone;
    scene.add(tree);
  });

  layout.shrubs.forEach((planting, index) => {
    const color = TREE_PALETTE[planting.paletteIndex] ?? TREE_PALETTE[0];
    const shrub = shrubLod(
      planting.x,
      planting.z,
      planting.scale,
      color,
      18 + index * 0.83,
      seed ^ Math.imul(index + 1, 0x27_d4_eb_2d),
    );
    shrub.userData["propertyRole"] = planting.propertyRole;
    shrub.userData["yardZone"] = planting.yardZone;
    scene.add(shrub);
  });

  layout.flowers.forEach((planting, index) => {
    const color = FLOWER_PALETTE[planting.paletteIndex] ?? FLOWER_PALETTE[0];
    const bed = flower(
      planting.x,
      planting.z,
      color,
      40 + index * 0.91,
      seed ^ Math.imul(index + 1, 0x16_56_67_b1),
    );
    bed.userData["propertyRole"] = planting.propertyRole;
    bed.userData["yardZone"] = planting.yardZone;
    scene.add(bed);
  });

  distantHill(scene, -94, -102, 34, 13, 0x71_89_67);
  distantHill(scene, -48, -108, 38, 15, 0x6b_82_64);
  distantHill(scene, 4, -112, 42, 16, 0x74_8b_6c);
  distantHill(scene, 62, -106, 36, 14, 0x67_7e_61);
  distantHill(scene, 104, -100, 30, 12, 0x71_89_67);
  atmosphereBand(scene, -82, 12, 260, 42, 0xb9_c8_bd, 0.08);
  atmosphereBand(scene, -116, 15, 300, 48, 0xc8_d2_ca, 0.11);

  refreshWindRegistry(scene);

  return Object.freeze({
    houseLods: layout.frontProperties.length + housePositions.length,
    featuredHomes: 1,
    frontProperties: layout.frontProperties.length,
    driveways: allProperties.filter((property) => property.drivewayX !== null).length,
    treeLods: layout.trees.length,
    shrubs: layout.shrubs.length,
    flowers: layout.flowers.length,
    yardDetails: yardDetails.length,
    pavedRoads,
    windResponsive: layout.trees.length + layout.shrubs.length + layout.flowers.length,
    roadSegments,
    worldSpan,
  });
};
