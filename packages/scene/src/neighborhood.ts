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
): void => {
  const mesh = new Mesh(new PlaneGeometry(width, depth), material(color));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.userData["sceneRole"] = color === 0xd5d0c4 ? "sidewalk" : "paved-road";
  scene.add(mesh);
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

const detailedTree = (color: number): Group => {
  const root = new Group();
  const trunk = new Mesh(
    new CylinderGeometry(0.22, 0.34, 2.6, 7),
    material(0x765232),
  );
  trunk.position.y = 1.3;
  root.add(trunk);
  for (const [x, y, z, scale] of [
    [0, 3.5, 0, 1.55],
    [-0.65, 3.25, 0.2, 1.05],
    [0.62, 3.18, -0.15, 1.0],
  ] as const) {
    const crown = new Mesh(new SphereGeometry(1.35 * scale, 10, 7), material(color));
    crown.position.set(x, y, z);
    root.add(crown);
  }
  return root;
};

const distantTree = (color: number): Group => {
  const root = new Group();
  const trunk = new Mesh(new CylinderGeometry(0.22, 0.3, 2.4, 5), material(0x765232));
  trunk.position.y = 1.2;
  const crown = new Mesh(new SphereGeometry(2.15, 7, 5), material(color));
  crown.position.y = 3.55;
  root.add(trunk, crown);
  return root;
};

const treeLod = (x: number, z: number, scale: number, color: number): Group => {
  const root = distanceLod(detailedTree(color), distantTree(color), 28, x, z, scale);
  root.userData["sceneRole"] = "wind-vegetation";
  root.userData["windPhase"] = x * 0.17 + z * 0.11;
  return root;
};

const shrub = (x: number, z: number, scale: number, color: number): Group => {
  const root = new Group();
  for (const [offsetX, offsetZ, size] of [
    [-0.48, 0.05, 0.75],
    [0.15, 0, 0.92],
    [0.68, 0.18, 0.64],
  ] as const) {
    const crown = new Mesh(new SphereGeometry(size, 8, 6), material(color));
    crown.position.set(offsetX, size * 0.72, offsetZ);
    root.add(crown);
  }
  root.position.set(x, 0, z);
  root.scale.setScalar(scale);
  root.userData["sceneRole"] = "wind-vegetation";
  root.userData["windPhase"] = x * 0.13 + z * 0.19;
  return root;
};

const flowerPatch = (x: number, z: number, seed: number): Group => {
  const root = new Group();
  root.userData["sceneRole"] = "garden-flowers";
  const petalColors = [0xe78aa7, 0xf0c95b, 0x9b82d1, 0xf08a62] as const;
  for (let index = 0; index < 7; index += 1) {
    const stem = new Mesh(
      new CylinderGeometry(0.018, 0.022, 0.3 + (index % 3) * 0.04, 5),
      material(0x547f43),
    );
    stem.position.set((index % 4) * 0.16 - 0.24, 0.15, Math.floor(index / 4) * 0.18);
    const blossom = new Mesh(
      new SphereGeometry(0.075, 7, 5),
      material(petalColors[(index + seed) % petalColors.length] ?? petalColors[0]),
    );
    blossom.scale.set(1.35, 0.55, 1.05);
    blossom.position.set(stem.position.x, 0.34 + (index % 3) * 0.04, stem.position.z);
    root.add(stem, blossom);
  }
  root.position.set(x, 0, z);
  return root;
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
  return root;
};

const mailbox = (x: number, z: number): Group => {
  const root = new Group();
  box(root, [0.12, 1.05, 0.12], [0, 0.53, 0], 0x6e5a43);
  box(root, [0.48, 0.32, 0.34], [0, 1.08, 0], 0x547c85);
  box(root, [0.08, 0.42, 0.08], [0.27, 1.18, 0], 0xc95b4c);
  root.position.set(x, 0, z);
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
  roadSegments: number;
  worldSpan: number;
}>;

export type NeighborhoodWeather = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";

export const windStrengthForWeather = (weather: NeighborhoodWeather): number => {
  switch (weather) {
    case "thunderstorm":
      return 0.085;
    case "hot-and-dry":
      return 0.026;
    case "cloudy":
      return 0.02;
    case "sunny":
      return 0.012;
  }
};

export const updateNeighborhoodWind = (
  scene: Scene,
  seconds: number,
  strength: number,
): void => {
  const vegetation = scene.userData["windVegetation"];
  if (!Array.isArray(vegetation)) return;
  const amplitude = Math.max(0, Math.min(0.11, strength));
  for (const object of vegetation) {
    if (!(object instanceof Group)) continue;
    const phase = Number(object.userData["windPhase"] ?? 0);
    object.rotation.z = Math.sin(seconds * 1.55 + phase) * amplitude;
    object.rotation.x = Math.sin(seconds * 1.08 + phase * 0.7) * amplitude * 0.34;
  }
};

type FrontPropertySpec = Readonly<{
  role: string;
  houseX: number;
  houseZ: number;
  color: number;
  scale: number;
  rotationY: number;
  drivewayX: number;
  mailboxX: number;
}>;

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

export const FRONT_PROPERTY_LAYOUT: readonly FrontPropertySpec[] = Object.freeze([
  Object.freeze({
    role: "west-end",
    houseX: -44.6,
    houseZ: -7.1,
    color: HOUSE_PALETTE[0],
    scale: 0.96,
    rotationY: 0.035,
    drivewayX: -40.8,
    mailboxX: -40.0,
  }),
  Object.freeze({
    role: "west-mid",
    houseX: -33.7,
    houseZ: -8.4,
    color: HOUSE_PALETTE[4],
    scale: 1.02,
    rotationY: -0.045,
    drivewayX: -29.8,
    mailboxX: -30.7,
  }),
  Object.freeze({
    role: "west-near",
    houseX: -24.0,
    houseZ: -6.6,
    color: HOUSE_PALETTE[2],
    scale: 0.92,
    rotationY: 0.06,
    drivewayX: -20.7,
    mailboxX: -21.5,
  }),
  Object.freeze({
    role: "stand-home",
    houseX: -4.7,
    houseZ: -7.9,
    color: 0xd8a766,
    scale: 1.06,
    rotationY: 0.045,
    drivewayX: -8.45,
    mailboxX: -7.65,
  }),
  Object.freeze({
    role: "stand-neighbor",
    houseX: 8.8,
    houseZ: -8.6,
    color: HOUSE_PALETTE[4],
    scale: 0.97,
    rotationY: -0.055,
    drivewayX: 12.1,
    mailboxX: 11.25,
  }),
  Object.freeze({
    role: "east-mid",
    houseX: 29.1,
    houseZ: -6.8,
    color: HOUSE_PALETTE[1],
    scale: 1.01,
    rotationY: 0.025,
    drivewayX: 25.7,
    mailboxX: 26.45,
  }),
  Object.freeze({
    role: "east-end",
    houseX: 41.5,
    houseZ: -8.3,
    color: HOUSE_PALETTE[5],
    scale: 0.94,
    rotationY: -0.05,
    drivewayX: 45.0,
    mailboxX: 44.1,
  }),
]);

const MID_BLOCK_HOUSES = [
  [-45.8, -26.2, 0xc97d65, 0.92, Math.PI + 0.035],
  [-35.1, -24.0, 0xd5a66d, 1.05, Math.PI - 0.025],
  [-24.5, -28.0, 0xc27a68, 0.98, Math.PI + 0.055],
  [-9.1, -25.1, 0x8da9a1, 1.03, Math.PI - 0.045],
  [4.0, -27.5, 0xd56f52, 0.92, Math.PI + 0.025],
  [11.4, -24.0, 0xd4aa61, 1.0, Math.PI - 0.05],
  [29.7, -26.7, 0xdfb76f, 0.97, Math.PI + 0.03],
  [41.7, -24.7, 0xc97d65, 1.04, Math.PI - 0.04],
] as const;

const BACK_BLOCK_HOUSES = [
  [-47.0, -50.2, 0x8da9a1, 1.0, Math.PI - 0.03],
  [-36.5, -47.8, 0xd4aa61, 0.94, Math.PI + 0.05],
  [-25.4, -51.5, 0xd56f52, 1.03, Math.PI - 0.04],
  [-9.7, -48.5, 0xc27a68, 0.9, Math.PI + 0.025],
  [3.5, -52.0, 0xdfb76f, 1.05, Math.PI - 0.055],
  [12.0, -48.1, 0x8da9a1, 0.96, Math.PI + 0.045],
  [28.5, -50.8, 0xd5a66d, 1.02, Math.PI - 0.03],
  [39.6, -47.5, 0xc97d65, 0.93, Math.PI + 0.055],
  [49.0, -52.4, 0xd4aa61, 0.99, Math.PI - 0.04],
] as const;

export const populateNeighborhood = (scene: Scene): NeighborhoodStats => {
  const worldSpan = 150;
  let roadSegments = 0;

  const addRoad = (
    width: number,
    depth: number,
    x: number,
    z: number,
    color: number,
    y?: number,
  ): void => {
    road(scene, width, depth, x, z, color, y);
    roadSegments += 1;
  };

  addRoad(worldSpan, 5.4, 0, 4.8, 0x555b60);
  addRoad(6.2, 112, -15.5, -20, 0x5c6165);
  addRoad(6.2, 112, 18.5, -20, 0x5c6165);
  addRoad(worldSpan, 4.8, 0, -15.5, 0x60656a);
  addRoad(worldSpan, 4.4, 0, -37, 0x64696d);
  addRoad(worldSpan, 1.65, 0, 1.27, 0xd5d0c4, 0.018);
  addRoad(worldSpan, 1.65, 0, 8.33, 0xd5d0c4, 0.018);

  for (const property of FRONT_PROPERTY_LAYOUT) {
    addRoad(2.35, 6.8, property.drivewayX, -2.55, 0xb8b3a8, 0.019);
    const home = houseLod(
      property.houseX,
      property.houseZ,
      property.color,
      property.scale,
      property.rotationY,
    );
    home.userData["sceneRole"] = property.role;
    scene.add(home);
  }

  const housePositions = [...MID_BLOCK_HOUSES, ...BACK_BLOCK_HOUSES] as const;
  for (const [x, z, color, scale, rotation] of housePositions) {
    scene.add(houseLod(x, z, color, scale, rotation));
  }

  const yardDetails: Group[] = [];
  for (const property of FRONT_PROPERTY_LAYOUT) {
    const detail = mailbox(property.mailboxX, 0.25);
    detail.rotation.y = property.rotationY * 0.35;
    yardDetails.push(detail);
  }

  yardDetails.push(
    fenceRun(-5.7, -0.8, 2.9),
    fenceRunDepth(1.9, -3.0, 5.1),
    fenceRun(7.8, -0.65, 2.6),
  );
  for (const detail of yardDetails) scene.add(detail);

  const treePositions: (readonly [number, number, number, number])[] = [];
  for (let index = 0; index < 48; index += 1) {
    const row = Math.floor(index / 12);
    const slot = index % 12;
    const jitterX = (((index * 17) % 7) - 3) * 0.55;
    const jitterZ = ((index * 13) % 5) * 1.15;
    let x = -49 + slot * 8.9 + jitterX + row * 0.85;
    const z = -1.2 - row * 15.7 - jitterZ;

    if (Math.abs(x + 15.5) < 3.8) x -= 4.4;
    if (Math.abs(x - 18.5) < 3.8) x += 4.6;
    if (row === 0 && Math.abs(x) < 3.3) x += 4.2;

    const color = TREE_PALETTE[index % TREE_PALETTE.length] ?? TREE_PALETTE[0];
    const scale = 0.82 + ((index * 5) % 7) * 0.045;
    treePositions.push([x, z, scale, color]);
  }
  const windVegetation: Group[] = [];
  for (const [x, z, scale, color] of treePositions) {
    const tree = treeLod(x, z, scale, color);
    windVegetation.push(tree);
    scene.add(tree);
  }

  const shrubPositions = [
    [-11.4, -2.0],
    [-5.5, -1.6],
    [-2.1, -2.9],
    [4.6, -3.2],
    [14.2, -5.5],
    [-27.5, -4.1],
    [24.4, -2.8],
    [35.8, -5.1],
    [-31.2, -20.4],
    [-18.8, -22.7],
    [-3.1, -30.6],
    [9.4, -28.3],
    [26.9, -31.7],
    [43.5, -20.2],
  ] as const;
  shrubPositions.forEach(([x, z], index) => {
    const color = TREE_PALETTE[(index + 2) % TREE_PALETTE.length] ?? TREE_PALETTE[0];
    const plant = shrub(x, z, 0.7 + (index % 5) * 0.055, color);
    windVegetation.push(plant);
    scene.add(plant);
  });
  scene.userData["windVegetation"] = windVegetation;

  const flowers = [
    flowerPatch(-2.9, -2.15, 0),
    flowerPatch(3.2, -2.6, 1),
    flowerPatch(-10.4, -3.7, 2),
    flowerPatch(6.1, -4.1, 3),
  ];
  for (const patch of flowers) scene.add(patch);

  distantHill(scene, -52, -76, 24, 10, 0x718967);
  distantHill(scene, -16, -82, 31, 13, 0x6b8264);
  distantHill(scene, 24, -80, 29, 11, 0x748b6c);
  distantHill(scene, 58, -76, 26, 12, 0x677e61);
  atmosphereBand(scene, -63, 10, 150, 34, 0xb9c8bd, 0.08);
  atmosphereBand(scene, -86, 12, 170, 38, 0xc8d2ca, 0.11);

  return Object.freeze({
    houseLods: FRONT_PROPERTY_LAYOUT.length + housePositions.length,
    featuredHomes: 1,
    frontProperties: FRONT_PROPERTY_LAYOUT.length,
    driveways: FRONT_PROPERTY_LAYOUT.length,
    treeLods: treePositions.length,
    shrubs: shrubPositions.length,
    flowers: flowers.length,
    yardDetails: yardDetails.length + flowers.length,
    roadSegments,
    worldSpan,
  });
};
