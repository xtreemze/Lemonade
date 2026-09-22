import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  type Object3D,
  type Scene,
} from "three";

import {
  DEFAULT_RESIDENTIAL_SEED,
  generateResidentialLayout,
  residentialFootprintIntersectsHardscape,
  type ResidentialPropertySpec,
} from "./residential-layout.js";
import { STREET_LAYOUT } from "./street-layout.js";

const material = (color: number, flatShading = true): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading, roughness: 0.92 });

const box = (
  parent: Object3D,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  color: number,
): void => {
  const mesh = new Mesh(new BoxGeometry(...size), material(color));
  mesh.position.set(...position);
  parent.add(mesh);
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
  if (role !== undefined) mesh.userData["sceneRole"] = role;
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
  box(root, [5.95, 0.18, 4.62], [0, 0.18, 0], 0xc7a980);
  const roof = new Mesh(
    new CylinderGeometry(0, 4.4, 2.25, 4),
    material(0x7f4a43),
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 4.45;
  root.add(roof);

  box(root, [1.05, 2.0, 0.18], [0, 1.05, 2.34], 0x486c69);
  box(root, [1.22, 0.12, 0.12], [0, 2.08, 2.47], 0xf1dfbd);
  box(root, [0.11, 2.12, 0.12], [-0.59, 1.08, 2.47], 0xf1dfbd);
  box(root, [0.11, 2.12, 0.12], [0.59, 1.08, 2.47], 0xf1dfbd);
  const knob = new Mesh(new SphereGeometry(0.07, 8, 6), material(0xc89a3c));
  knob.position.set(0.33, 1.05, 2.47);
  root.add(knob);

  for (const x of [-1.7, 1.7]) {
    box(root, [0.92, 0.95, 0.14], [x, 2.1, 2.36], 0xb8d9d2);
    box(root, [1.08, 0.1, 0.11], [x, 2.62, 2.46], 0xf1dfbd);
    box(root, [1.08, 0.1, 0.11], [x, 1.58, 2.46], 0xf1dfbd);
    box(root, [0.1, 1.05, 0.11], [x - 0.51, 2.1, 2.46], 0xf1dfbd);
    box(root, [0.1, 1.05, 0.11], [x + 0.51, 2.1, 2.46], 0xf1dfbd);
    box(root, [0.08, 0.95, 0.1], [x, 2.1, 2.47], 0xf1dfbd);
    box(root, [0.92, 0.08, 0.1], [x, 2.1, 2.47], 0xf1dfbd);
  }

  box(root, [3.8, 0.22, 1.05], [0, 0.25, 2.62], 0xb99b78);
  box(root, [2.8, 0.16, 0.52], [0, 0.12, 3.05], 0xc9b08d);
  box(root, [0.58, 1.15, 0.72], [1.75, 4.75, -0.72], 0x9b5f4f);

  const porchLamp = new Mesh(new SphereGeometry(0.12, 8, 6), material(0xffd98a, false));
  porchLamp.position.set(0.92, 1.86, 2.5);
  root.add(porchLamp);
  return root;
};

const distantHouse = (color: number): Group => {
  const root = new Group();
  box(root, [5.8, 3.4, 4.5], [0, 1.7, 0], color);
  const roof = new Mesh(
    new CylinderGeometry(0, 4.4, 2.25, 4),
    material(0x765048),
  );
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

const houseLod = (
  x: number,
  z: number,
  color: number,
  scale: number,
  rotationY: number,
): Group => distanceLod(
  detailedHouse(color),
  distantHouse(color),
  34,
  x,
  z,
  scale,
  rotationY,
);

const plantUnit = (seed: number, salt: number): number => {
  let value = Math.imul((seed ^ salt) >>> 0, 0x9e3779b1);
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  return ((value ^ (value >>> 15)) >>> 0) / 0xffff_ffff;
};

const detailedTree = (color: number, seed: number): Group => {
  const root = new Group();
  const trunkHeight = 2.35 + plantUnit(seed, 11) * 0.75;
  const trunk = new Mesh(
    new CylinderGeometry(
      0.18 + plantUnit(seed, 13) * 0.08,
      0.31 + plantUnit(seed, 17) * 0.09,
      trunkHeight,
      7,
    ),
    material(0x765232),
  );
  trunk.position.y = trunkHeight / 2;
  trunk.rotation.z = (plantUnit(seed, 19) - 0.5) * 0.1;
  root.add(trunk);

  for (const direction of [-1, 1] as const) {
    const branchLength = 0.82 + plantUnit(seed, 23 + direction) * 0.52;
    const branch = new Mesh(
      new CylinderGeometry(0.06, 0.1, branchLength, 6),
      material(0x765232),
    );
    branch.position.set(
      direction * (0.2 + plantUnit(seed, 29 + direction) * 0.18),
      trunkHeight * (0.62 + plantUnit(seed, 31 + direction) * 0.12),
      (plantUnit(seed, 37 + direction) - 0.5) * 0.26,
    );
    branch.rotation.z = direction * (0.78 + plantUnit(seed, 41 + direction) * 0.28);
    root.add(branch);
  }

  const crownCount = 3 + Math.floor(plantUnit(seed, 47) * 3);
  for (let index = 0; index < crownCount; index += 1) {
    const angle = plantUnit(seed, 53 + index * 7) * Math.PI * 2;
    const radius = index === 0 ? 0 : 0.35 + plantUnit(seed, 59 + index * 5) * 0.65;
    const size = 0.88 + plantUnit(seed, 61 + index * 11) * 0.72;
    const crown = new Mesh(
      new SphereGeometry(1.25 * size, 10, 7),
      material(color),
    );
    crown.scale.set(
      0.84 + plantUnit(seed, 67 + index) * 0.36,
      0.9 + plantUnit(seed, 71 + index) * 0.34,
      0.82 + plantUnit(seed, 73 + index) * 0.32,
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
  const trunk = new Mesh(
    new CylinderGeometry(0.2, 0.3, trunkHeight, 5),
    material(0x765232),
  );
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
  const variant = Math.floor(plantUnit(seed, 101) * 1_000);
  const root = distanceLod(
    detailedTree(color, seed),
    distantTree(color, seed),
    28,
    x,
    z,
    scale,
  );
  root.userData["sceneRole"] = "procedural-tree";
  root.userData["plantVariant"] = variant;
  return markWindResponsive(root, phase);
};

const detailedShrub = (color: number, seed: number): Group => {
  const root = new Group();
  const lobeCount = 3 + Math.floor(plantUnit(seed, 107) * 3);
  for (let index = 0; index < lobeCount; index += 1) {
    const angle = plantUnit(seed, 109 + index * 7) * Math.PI * 2;
    const radius = 0.16 + plantUnit(seed, 113 + index * 5) * 0.48;
    const size = 0.52 + plantUnit(seed, 127 + index * 11) * 0.48;
    const crown = new Mesh(new SphereGeometry(size, 8, 6), material(color));
    crown.scale.set(
      0.9 + plantUnit(seed, 131 + index) * 0.32,
      0.82 + plantUnit(seed, 137 + index) * 0.3,
      0.88 + plantUnit(seed, 139 + index) * 0.28,
    );
    crown.position.set(
      Math.cos(angle) * radius,
      size * 0.68,
      Math.sin(angle) * radius * 0.65,
    );
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
  const root = distanceLod(
    detailedShrub(color, seed),
    distantShrub(color, seed),
    18,
    x,
    z,
    scale,
  );
  root.userData["sceneRole"] = "procedural-shrub";
  root.userData["plantVariant"] = Math.floor(plantUnit(seed, 151) * 1_000);
  return markWindResponsive(root, phase);
};

const flower = (
  x: number,
  z: number,
  color: number,
  phase: number,
): Group => {
  const root = new Group();
  const stem = new Mesh(
    new CylinderGeometry(0.018, 0.025, 0.38, 5),
    material(0x4f8246),
  );
  stem.position.y = 0.19;
  root.add(stem);
  const center = new Mesh(new SphereGeometry(0.055, 7, 5), material(0xe1ad35));
  center.position.y = 0.42;
  root.add(center);
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2;
    const petal = new Mesh(new SphereGeometry(0.055, 7, 5), material(color));
    petal.scale.set(1.3, 0.7, 0.55);
    petal.position.set(
      Math.cos(angle) * 0.075,
      0.42 + Math.sin(angle) * 0.075,
      0.012,
    );
    root.add(petal);
  }
  root.position.set(x, 0, z);
  root.userData["sceneRole"] = "garden-flower";
  return markWindResponsive(root, phase);
};

const fenceRun = (x: number, z: number, width: number): Group => {
  const root = new Group();
  box(root, [width, 0.1, 0.1], [0, 0.56, 0], 0xe9dfc7);
  box(root, [width, 0.1, 0.1], [0, 0.92, 0], 0xe9dfc7);
  const posts = 6;
  for (let index = 0; index < posts; index += 1) {
    const offset = -width / 2 + (index / (posts - 1)) * width;
    box(root, [0.12, 1.2, 0.12], [offset, 0.6, 0], 0xf4ead4);
  }
  root.position.set(x, 0, z);
  root.userData["sceneRole"] = "fence";
  return root;
};

const mailbox = (x: number, z: number): Group => {
  const root = new Group();
  box(root, [0.12, 1.05, 0.12], [0, 0.53, 0], 0x6e5a43);
  box(root, [0.48, 0.32, 0.34], [0, 1.08, 0], 0x547c85);
  box(root, [0.42, 0.25, 0.035], [0, 1.08, 0.19], 0x456b73);
  box(root, [0.08, 0.42, 0.08], [0.27, 1.18, 0], 0xc95b4c);
  root.position.set(x, 0, z);
  root.rotation.y = 0;
  root.userData["sceneRole"] = "mailbox";
  root.userData["streetFacingYaw"] = 0;
  return root;
};

const fenceRunDepth = (x: number, z: number, depth: number): Group => {
  const root = fenceRun(0, 0, depth);
  root.position.set(x, 0, z);
  root.rotation.y = Math.PI / 2;
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
  0xc97d65,
  0xd56f52,
  0xd4aa61,
  0xd5a66d,
  0x8da9a1,
  0xc27a68,
  0xdfb76f,
] as const;
const TREE_PALETTE = [
  0x668e53,
  0x5f8d56,
  0x507f4b,
  0x6d985e,
  0x58854f,
  0x678f52,
  0x4f814c,
] as const;
const FLOWER_PALETTE = [0xe98d9e, 0xf1c75b, 0x9e83c7, 0xf4eee5, 0xd97058] as const;

export const FRONT_PROPERTY_LAYOUT: readonly FrontPropertySpec[] =
  generateResidentialLayout(DEFAULT_RESIDENTIAL_SEED).frontProperties;

export type NeighborhoodWeather = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";

export const weatherWindStrength = (weather: NeighborhoodWeather): number => {
  switch (weather) {
    case "sunny":
      return 0.012;
    case "cloudy":
      return 0.018;
    case "hot-and-dry":
      return 0.026;
    case "thunderstorm":
      return 0.064;
  }
};

export const updateNeighborhoodWind = (
  scene: Scene,
  seconds: number,
  weather: NeighborhoodWeather,
): void => {
  const strength = weatherWindStrength(weather);
  scene.traverse((object) => {
    if (object.userData["windResponsive"] !== true) return;
    const phase =
      typeof object.userData["windPhase"] === "number"
        ? object.userData["windPhase"]
        : 0;
    const baseX =
      typeof object.userData["windBaseRotationX"] === "number"
        ? object.userData["windBaseRotationX"]
        : 0;
    const baseZ =
      typeof object.userData["windBaseRotationZ"] === "number"
        ? object.userData["windBaseRotationZ"]
        : 0;
    const gust =
      Math.sin(seconds * 1.25 + phase) * 0.7 +
      Math.sin(seconds * 2.7 + phase * 1.7) * 0.3;
    object.rotation.x = baseX + gust * strength * 0.24;
    object.rotation.z = baseZ + gust * strength;
  });
};

export const populateNeighborhood = (
  scene: Scene,
  seed = DEFAULT_RESIDENTIAL_SEED,
): NeighborhoodStats => {
  const worldSpan = 150;
  const layout = generateResidentialLayout(seed);
  let roadSegments = 0;
  let pavedRoads = 0;

  const addRoad = (
    width: number,
    depth: number,
    x: number,
    z: number,
    color: number,
    y?: number,
    role?: string,
  ): void => {
    road(scene, width, depth, x, z, color, y, role);
    roadSegments += 1;
    if (role === "paved-road") pavedRoads += 1;
  };

  addRoad(
    worldSpan,
    STREET_LAYOUT.road.depth,
    0,
    STREET_LAYOUT.road.centerZ,
    0x596065,
    0.014,
    "paved-road",
  );
  addRoad(6.2, 112, -15.5, -20, 0x5b6266, 0.014, "paved-road");
  addRoad(6.2, 112, 18.5, -20, 0x5b6266, 0.014, "paved-road");
  addRoad(worldSpan, 4.8, 0, -15.5, 0x62686b, 0.014, "paved-road");
  addRoad(worldSpan, 4.4, 0, -37, 0x646a6d, 0.014, "paved-road");
  addRoad(
    worldSpan,
    STREET_LAYOUT.nearSidewalk.depth,
    0,
    STREET_LAYOUT.nearSidewalk.centerZ,
    0xd4d0c6,
    0.022,
    "sidewalk",
  );
  addRoad(
    worldSpan,
    STREET_LAYOUT.farSidewalk.depth,
    0,
    STREET_LAYOUT.farSidewalk.centerZ,
    0xd4d0c6,
    0.022,
    "sidewalk",
  );

  for (let x = -72; x <= 72; x += 7.5) {
    road(
      scene,
      3.2,
      0.075,
      x,
      STREET_LAYOUT.road.centerZ,
      0xd8c978,
      0.026,
      "road-marking",
    );
  }

  for (const property of layout.frontProperties) {
    if (property.drivewayX !== null) {
      addRoad(2.15, 6.8, property.drivewayX, -2.55, 0xc9b995, 0.019, "driveway");
    }
    const color = HOUSE_PALETTE[property.color] ?? HOUSE_PALETTE[0];
    const home = houseLod(
      property.houseX,
      property.houseZ,
      color,
      property.scale,
      property.rotationY,
    );
    home.userData["sceneRole"] = property.role;
    scene.add(home);
  }

  const housePositions = [...layout.middleProperties, ...layout.backProperties];
  for (const property of housePositions) {
    const color = HOUSE_PALETTE[property.color] ?? HOUSE_PALETTE[0];
    scene.add(
      houseLod(
        property.houseX,
        property.houseZ,
        color,
        property.scale,
        property.rotationY,
      ),
    );
  }

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
      if (
        !residentialFootprintIntersectsHardscape(
          { x, z },
          layout,
          halfWidth,
          halfDepth,
        )
      ) {
        return x;
      }
    }
    return null;
  };
  const addYardDetailIfClear = (
    detail: Group,
    halfWidth: number,
    halfDepth: number,
  ): void => {
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
    yardDetails.push(detail);
  };

  for (const property of layout.frontProperties) {
    if (property.mailboxX === null) continue;
    const safeX = clearYardX(property.mailboxX, -0.3, 0.3, 0.3);
    if (safeX === null) continue;
    yardDetails.push(mailbox(safeX, -0.3));
  }

  addYardDetailIfClear(fenceRun(-5.7, -0.8, 2.9), 2.9 / 2, 0.06);
  addYardDetailIfClear(fenceRunDepth(1.9, -3.0, 5.1), 0.06, 5.1 / 2);
  addYardDetailIfClear(fenceRun(7.8, -0.65, 2.6), 2.6 / 2, 0.06);
  addYardDetailIfClear(fenceRun(0, -4.7, 1.4), 1.4 / 2, 0.06);
  for (const detail of yardDetails) scene.add(detail);

  layout.trees.forEach((planting, index) => {
    const color = TREE_PALETTE[planting.paletteIndex] ?? TREE_PALETTE[0];
    scene.add(
      treeLod(
        planting.x,
        planting.z,
        planting.scale,
        color,
        index * 0.71,
        seed ^ Math.imul(index + 1, 0x45d9f3b),
      ),
    );
  });

  layout.shrubs.forEach((planting, index) => {
    const color = TREE_PALETTE[planting.paletteIndex] ?? TREE_PALETTE[0];
    scene.add(
      shrubLod(
        planting.x,
        planting.z,
        planting.scale,
        color,
        18 + index * 0.83,
        seed ^ Math.imul(index + 1, 0x27d4eb2d),
      ),
    );
  });

  layout.flowers.forEach((planting, index) => {
    const color = FLOWER_PALETTE[planting.paletteIndex] ?? FLOWER_PALETTE[0];
    scene.add(flower(planting.x, planting.z, color, 40 + index * 0.91));
  });

  distantHill(scene, -52, -76, 24, 10, 0x718967);
  distantHill(scene, -16, -82, 31, 13, 0x6b8264);
  distantHill(scene, 24, -80, 29, 11, 0x748b6c);
  distantHill(scene, 58, -76, 26, 12, 0x677e61);
  atmosphereBand(scene, -63, 10, 150, 34, 0xb9c8bd, 0.08);
  atmosphereBand(scene, -86, 12, 170, 38, 0xc8d2ca, 0.11);

  return Object.freeze({
    houseLods: layout.frontProperties.length + housePositions.length,
    featuredHomes: 1,
    frontProperties: layout.frontProperties.length,
    driveways: layout.frontProperties.filter((property) => property.drivewayX !== null).length,
    treeLods: layout.trees.length,
    shrubs: layout.shrubs.length,
    flowers: layout.flowers.length,
    yardDetails: yardDetails.length,
    pavedRoads,
    windResponsive:
      layout.trees.length + layout.shrubs.length + layout.flowers.length,
    roadSegments,
    worldSpan,
  });
};
