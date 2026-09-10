import * as THREE from "three";

export type SceneWeather = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";
export type CustomerActivity = "quiet" | "light" | "steady" | "lively" | "busy";
export type ScenePhase = "deciding" | "report";

export type LemonsvilleSceneState = Readonly<{
  weather: SceneWeather;
  customerActivity: CustomerActivity;
  visibleSigns: number;
  sellThroughBasisPoints: number;
  phase: ScenePhase;
  reducedMotion: boolean;
}>;

export interface LemonsvilleSceneController {
  update(state: LemonsvilleSceneState): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const skyColor: Record<SceneWeather, number> = {
  sunny: 0x79cbe0,
  cloudy: 0xaabcc3,
  "hot-and-dry": 0xe6b05f,
  thunderstorm: 0x536471,
};

const customerCount: Record<CustomerActivity, number> = {
  quiet: 1,
  light: 3,
  steady: 5,
  lively: 8,
  busy: 12,
};

const makeMaterial = (color: number): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.92 });

const addBox = (
  parent: THREE.Object3D,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  color: number,
): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), makeMaterial(color));
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
};

const createStand = (): THREE.Group => {
  const stand = new THREE.Group();
  addBox(stand, [4.5, 1.8, 1.7], [0, 0.9, 0], 0xe7c672);
  addBox(stand, [4.9, 0.28, 2.05], [0, 2.18, 0], 0xf3d85d);
  addBox(stand, [4.2, 0.8, 0.18], [0, 1.0, 0.94], 0xffefaf);
  addBox(stand, [0.22, 2.4, 0.22], [-2.0, 2.9, 0], 0x5e4934);
  addBox(stand, [0.22, 2.4, 0.22], [2.0, 2.9, 0], 0x5e4934);
  addBox(stand, [4.8, 0.22, 2.0], [0, 4.0, 0], 0xe6a93b);
  return stand;
};

const createHouse = (x: number, color: number, scale: number): THREE.Group => {
  const house = new THREE.Group();
  addBox(house, [3.4, 2.6, 2.4], [0, 1.3, 0], color);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.75, 1.6, 4),
    makeMaterial(0x7f4a43),
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 3.25;
  house.add(roof);

  addBox(house, [0.75, 1.55, 0.15], [0, 0.8, 1.28], 0x486c69);
  house.position.x = x;
  house.position.z = -3.8;
  house.scale.setScalar(scale);
  return house;
};

const createTree = (x: number, z: number): THREE.Group => {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.5, 6), makeMaterial(0x765232));
  trunk.position.y = 0.75;
  tree.add(trunk);

  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 0), makeMaterial(0x5f8d56));
  crown.position.y = 2.0;
  tree.add(crown);
  tree.position.set(x, 0, z);
  return tree;
};

const createSign = (index: number): THREE.Group => {
  const sign = new THREE.Group();
  addBox(sign, [0.1, 0.85, 0.1], [0, 0.43, 0], 0x644c34);
  addBox(sign, [0.95, 0.62, 0.12], [0, 1.05, 0], 0xf5d34c);
  const side = index % 2 === 0 ? -1 : 1;
  const row = Math.floor(index / 2);
  sign.position.set(side * (3.6 + (row % 4) * 1.15), 0, 1.9 + Math.floor(row / 4) * 1.2);
  sign.rotation.y = side * 0.18;
  return sign;
};

const createCustomer = (index: number): THREE.Group => {
  const customer = new THREE.Group();
  const bodyColors = [0xd75c51, 0x507d83, 0xe0a43c, 0x7766a6] as const;
  const color = bodyColors[index % bodyColors.length];
  if (color === undefined) {
    throw new Error("customer palette invariant failed");
  }

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.0, 7), makeMaterial(color));
  body.position.y = 0.55;
  customer.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), makeMaterial(0xe1ad83));
  head.position.y = 1.27;
  customer.add(head);

  const angle = (index / 12) * Math.PI * 1.15 + 0.35;
  const radius = 4.1 + (index % 3) * 0.7;
  customer.position.set(Math.cos(angle) * radius, 0, 2.5 + Math.sin(angle) * radius * 0.48);
  customer.rotation.y = -angle;
  return customer;
};

const disposeObject = (object: THREE.Object3D): void => {
  if (!(object instanceof THREE.Mesh)) return;
  object.geometry.dispose();
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) material.dispose();
};

export const createLemonsvilleScene = (
  canvas: HTMLCanvasElement,
  initialState: LemonsvilleSceneState,
): LemonsvilleSceneController | null => {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 6.8, 13.5);
  camera.lookAt(0, 1.7, 0);

  scene.add(new THREE.HemisphereLight(0xfff2c6, 0x526b51, 2.0));
  const sun = new THREE.DirectionalLight(0xfff0c9, 2.3);
  sun.position.set(-5, 10, 7);
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 24), makeMaterial(0x92ad68));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -1.5;
  scene.add(ground);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(30, 4.0), makeMaterial(0xb2916e));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.012, 4.1);
  scene.add(road);

  scene.add(createHouse(-7.2, 0xd56f52, 1.0));
  scene.add(createHouse(7.0, 0xd4aa61, 0.9));
  scene.add(createTree(-4.7, -2.9));
  scene.add(createTree(4.9, -2.6));
  scene.add(createTree(-8.2, 1.4));
  scene.add(createTree(8.1, 1.0));
  scene.add(createStand());

  const signs = Array.from({ length: 25 }, (_, index) => createSign(index));
  for (const sign of signs) scene.add(sign);

  const customers = Array.from({ length: 12 }, (_, index) => createCustomer(index));
  for (const customer of customers) scene.add(customer);

  const render = (): void => renderer.render(scene, camera);

  const update = (state: LemonsvilleSceneState): void => {
    renderer.setClearColor(skyColor[state.weather], 1);

    const signLimit = Math.max(0, Math.min(signs.length, Math.trunc(state.visibleSigns)));
    signs.forEach((sign, index) => {
      sign.visible = index < signLimit;
    });

    let visibleCustomers = customerCount[state.customerActivity];
    if (state.phase === "report") {
      const sellThroughBoost = Math.round((state.sellThroughBasisPoints / 10_000) * 3);
      visibleCustomers = Math.min(customers.length, visibleCustomers + sellThroughBoost);
    }
    customers.forEach((customer, index) => {
      customer.visible = index < visibleCustomers;
    });

    render();
  };

  const resize = (width: number, height: number): void => {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    camera.aspect = safeWidth / safeHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(safeWidth, safeHeight, false);
    render();
  };

  const dispose = (): void => {
    scene.traverse(disposeObject);
    renderer.dispose();
  };

  update(initialState);
  return Object.freeze({ update, resize, dispose });
};
