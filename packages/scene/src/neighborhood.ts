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

const material = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.92 });

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
): void => {
  const mesh = new Mesh(new PlaneGeometry(width, depth), material(color));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.014, z);
  scene.add(mesh);
};

const house = (
  x: number,
  z: number,
  color: number,
  scale: number,
  rotationY: number,
): Group => {
  const root = new Group();
  box(root, [3.4, 2.6, 2.4], [0, 1.3, 0], color);
  const roof = new Mesh(
    new CylinderGeometry(0, 2.75, 1.6, 4),
    material(0x7f4a43),
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 3.25;
  root.add(roof);
  box(root, [0.75, 1.55, 0.15], [0, 0.8, 1.28], 0x486c69);
  box(root, [0.58, 0.7, 0.12], [-0.92, 1.55, 1.3], 0xb8d9d2);
  box(root, [0.58, 0.7, 0.12], [0.92, 1.55, 1.3], 0xb8d9d2);
  root.position.set(x, 0, z);
  root.rotation.y = rotationY;
  root.scale.setScalar(scale);
  return root;
};

const tree = (x: number, z: number, scale: number, color: number): Group => {
  const root = new Group();
  const trunk = new Mesh(
    new CylinderGeometry(0.16, 0.24, 1.5, 7),
    material(0x765232),
  );
  trunk.position.y = 0.75;
  root.add(trunk);
  const crown = new Mesh(new SphereGeometry(1.05, 10, 7), material(color));
  crown.position.y = 2;
  root.add(crown);
  root.position.set(x, 0, z);
  root.scale.setScalar(scale);
  return root;
};

const shrub = (x: number, z: number, scale: number, color: number): Group => {
  const root = new Group();
  for (const [offsetX, offsetZ, size] of [
    [-0.32, 0.04, 0.56],
    [0.2, 0, 0.68],
    [0.5, 0.12, 0.48],
  ] as const) {
    const crown = new Mesh(new SphereGeometry(size, 9, 6), material(color));
    crown.position.set(offsetX, size * 0.72, offsetZ);
    root.add(crown);
  }
  root.position.set(x, 0, z);
  root.scale.setScalar(scale);
  return root;
};

export const populateNeighborhood = (scene: Scene): void => {
  road(scene, 5.2, 34, -11.5, -3.2, 0xb2916e);
  road(scene, 44, 3.3, 0, -10.2, 0xbda080);
  road(scene, 44, 0.7, 0, 1.68, 0xd9cfb4);

  for (const spec of [
    [-17, -7.8, 0xc97d65, 0.92, 0.12],
    [-7.1, -13, 0xd5a66d, 0.86, Math.PI],
    [1, -13.2, 0x8da9a1, 0.9, Math.PI],
    [9.2, -12.8, 0xc27a68, 0.88, Math.PI],
    [16.5, -6.9, 0xdfb76f, 0.82, -0.1],
  ] as const) {
    scene.add(house(...spec));
  }

  for (const spec of [
    [-15.2, -2, 1.12, 0x668e53],
    [-13.7, -12.2, 0.95, 0x507f4b],
    [-3.2, -10.7, 0.88, 0x6d985e],
    [5.1, -9.8, 1.08, 0x58854f],
    [13.7, -11.3, 1, 0x678f52],
    [17.5, 0.7, 1.06, 0x4f814c],
  ] as const) {
    scene.add(tree(...spec));
  }

  for (const spec of [
    [-5.8, -0.8, 0.72, 0x678f52],
    [5.9, -0.7, 0.68, 0x5f8b55],
    [-9, -6.2, 0.8, 0x759d61],
    [11.4, -5.8, 0.78, 0x698f58],
    [-1.8, -8.8, 0.66, 0x6f985f],
    [7.2, -9, 0.72, 0x618a54],
  ] as const) {
    scene.add(shrub(...spec));
  }
};
