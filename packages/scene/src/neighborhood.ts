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

const treeLod = (x: number, z: number, scale: number, color: number): Group =>
  distanceLod(detailedTree(color), distantTree(color), 28, x, z, scale);

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
  treeLods: number;
  shrubs: number;
  yardDetails: number;
  roadSegments: number;
  worldSpan: number;
}>;

const HOUSE_PALETTE = [0xc97d65, 0xd56f52, 0xd4aa61, 0xd5a66d, 0x8da9a1, 0xc27a68, 0xdfb76f] as const;
const TREE_PALETTE = [0x668e53, 0x5f8d56, 0x507f4b, 0x6d985e, 0x58854f, 0x678f52, 0x4f814c] as const;

export const populateNeighborhood = (scene: Scene): NeighborhoodStats => {
  const worldSpan = 150;
  let roadSegments = 0;

  const addRoad = (width: number, depth: number, x: number, z: number, color: number, y?: number): void => {
    road(scene, width, depth, x, z, color, y);
    roadSegments += 1;
  };

  addRoad(worldSpan, 5.4, 0, 4.8, 0xa88c70);
  addRoad(6.2, 112, -15.5, -20, 0xaa8f73);
  addRoad(6.2, 112, 18.5, -20, 0xaa8f73);
  addRoad(worldSpan, 4.8, 0, -15.5, 0xb19578);
  addRoad(worldSpan, 4.4, 0, -37, 0xb59a80);
  addRoad(worldSpan, 0.9, 0, 1.55, 0xd9cfb4, 0.018);
  addRoad(worldSpan, 0.9, 0, 8.05, 0xd9cfb4, 0.018);
  addRoad(2.1, 6.4, 0, -2.5, 0xc9b995, 0.019);

  const standHome = houseLod(0, -7.1, 0xd8a766, 1.08, 0);
  standHome.userData["sceneRole"] = "stand-home";
  scene.add(standHome);

  const yardDetails = [
    fenceRun(-5.5, -3.55, 4.2),
    fenceRun(5.5, -3.55, 4.2),
    mailbox(3.25, -1.15),
  ] as const;
  for (const detail of yardDetails) scene.add(detail);

  const housePositions: (readonly [number, number, number, number])[] = [];
  for (const z of [-5.5, -25.5, -47.5]) {
    for (const x of [-42, -31, -7, 5.5, 31, 43]) {
      if (Math.abs(x) < 10 && z > -10) continue;
      const colorIndex = Math.abs(Math.round(x + z)) % HOUSE_PALETTE.length;
      const color = HOUSE_PALETTE[colorIndex] ?? HOUSE_PALETTE[0];
      const scale = 0.92 + (Math.abs(Math.round(x * 3 + z)) % 7) * 0.025;
      housePositions.push([x, z, color, scale]);
    }
  }
  for (const [x, z, color, scale] of housePositions) {
    const rotation = z < -10 ? Math.PI : 0;
    scene.add(houseLod(x, z, color, scale, rotation));
  }

  const treePositions: (readonly [number, number, number, number])[] = [];
  for (let index = 0; index < 44; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const ring = Math.floor(index / 2);
    const x = side * (9.5 + (ring % 7) * 5.3);
    const z = 0.4 - Math.floor(ring / 7) * 12.5 - (ring % 3) * 2.1;
    const color = TREE_PALETTE[index % TREE_PALETTE.length] ?? TREE_PALETTE[0];
    const scale = 0.84 + (index % 6) * 0.055;
    treePositions.push([x, z, scale, color]);
  }
  for (const [x, z, scale, color] of treePositions) {
    scene.add(treeLod(x, z, scale, color));
  }

  const shrubPositions = [
    [-6.8, -1.1], [6.9, -1], [-10.2, -7.2], [11.6, -6.8],
    [-2.8, -10.4], [7.7, -10.6], [-23, -3.2], [25, -3.6],
    [-28, -19], [27, -20], [-4, -31], [8, -32],
  ] as const;
  shrubPositions.forEach(([x, z], index) => {
    const color = TREE_PALETTE[(index + 2) % TREE_PALETTE.length] ?? TREE_PALETTE[0];
    scene.add(shrub(x, z, 0.72 + (index % 4) * 0.06, color));
  });

  distantHill(scene, -52, -76, 24, 10, 0x718967);
  distantHill(scene, -16, -82, 31, 13, 0x6b8264);
  distantHill(scene, 24, -80, 29, 11, 0x748b6c);
  distantHill(scene, 58, -76, 26, 12, 0x677e61);
  atmosphereBand(scene, -63, 10, 150, 34, 0xb9c8bd, 0.08);
  atmosphereBand(scene, -86, 12, 170, 38, 0xc8d2ca, 0.11);

  return Object.freeze({
    houseLods: housePositions.length + 1,
    featuredHomes: 1,
    treeLods: treePositions.length,
    shrubs: shrubPositions.length,
    yardDetails: yardDetails.length,
    roadSegments,
    worldSpan,
  });
};
