import * as THREE from "three";

import {
  createStreetStoryboard,
  remainingCupsAt,
  sceneCameraComposition,
} from "./storyboard.js";

export type SceneWeather = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";
export type CustomerActivity = "quiet" | "light" | "steady" | "lively" | "busy";
export type ScenePhase = "idle" | "simulation" | "forecast";

export type LemonsvilleSceneState = Readonly<{
  weather: SceneWeather;
  customerActivity: CustomerActivity;
  visibleSigns: number;
  prepared: number;
  sold: number;
  durationMs: number;
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
  "hot-and-dry": 0x9fc9d3,
  thunderstorm: 0x536471,
};

const customerCount: Record<CustomerActivity, number> = {
  quiet: 4,
  light: 7,
  steady: 10,
  lively: 14,
  busy: 18,
};

const PASSERBY_POOL_SIZE = 32;
const BUYER_POOL_SIZE = 24;
const MAX_PREPARED_CUPS = 250;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const smoothStep = (value: number): number => {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
};

const lerp = (start: number, end: number, progress: number): number =>
  start + (end - start) * progress;

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
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.24, 1.5, 6),
    makeMaterial(0x765232),
  );
  trunk.position.y = 0.75;
  tree.add(trunk);

  const crown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.05, 0),
    makeMaterial(0x5f8d56),
  );
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
  sign.position.set(
    side * (3.6 + (row % 4) * 1.15),
    0,
    1.9 + Math.floor(row / 4) * 1.2,
  );
  sign.rotation.y = side * 0.18;
  return sign;
};

const createPerson = (index: number): THREE.Group => {
  const person = new THREE.Group();
  const bodyColors = [0xd75c51, 0x507d83, 0xe0a43c, 0x7766a6, 0x3f7d68, 0x9c5b72] as const;
  const color = bodyColors[index % bodyColors.length];
  if (color === undefined) throw new Error("pedestrian palette invariant failed");

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.34, 1.0, 7),
    makeMaterial(color),
  );
  body.position.y = 0.55;
  person.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 8, 6),
    makeMaterial(0xe1ad83),
  );
  head.position.y = 1.27;
  person.add(head);
  return person;
};

type CupInventory = Readonly<{
  shells: THREE.InstancedMesh;
  liquid: THREE.InstancedMesh;
  setCount(count: number): void;
}>;

const createCupInventory = (): CupInventory => {
  const shells = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.075, 0.09, 0.19, 6),
    makeMaterial(0xf7f3df),
    MAX_PREPARED_CUPS,
  );
  const liquid = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.06, 0.07, 0.11, 6),
    makeMaterial(0xf5cf38),
    MAX_PREPARED_CUPS,
  );
  const matrix = new THREE.Matrix4();

  for (let index = 0; index < MAX_PREPARED_CUPS; index += 1) {
    const column = index % 20;
    const row = Math.floor(index / 20) % 7;
    const depth = Math.floor(index / 140);
    const x = -1.7 + column * 0.18;
    const y = 1.45 + row * 0.19;
    const z = 1.04 - depth * 0.14;

    matrix.makeTranslation(x, y, z);
    shells.setMatrixAt(index, matrix);
    matrix.makeTranslation(x, y - 0.015, z + 0.004);
    liquid.setMatrixAt(index, matrix);
  }

  shells.instanceMatrix.needsUpdate = true;
  liquid.instanceMatrix.needsUpdate = true;
  shells.count = 0;
  liquid.count = 0;

  return Object.freeze({
    shells,
    liquid,
    setCount(count: number): void {
      const visible = Math.min(
        MAX_PREPARED_CUPS,
        Math.max(0, Number.isFinite(count) ? Math.trunc(count) : 0),
      );
      shells.count = visible;
      liquid.count = visible;
    },
  });
};

const createLemon = (index: number): THREE.Group => {
  const lemon = new THREE.Group();
  const fruit = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.22, 1),
    makeMaterial(0xf6d33b),
  );
  fruit.scale.set(1.15, 0.9, 0.9);
  lemon.add(fruit);

  const leaf = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.22, 5),
    makeMaterial(0x4f8c4a),
  );
  leaf.rotation.z = Math.PI / 2;
  leaf.position.set(0.22, 0.12, 0);
  lemon.add(leaf);

  const column = index % 4;
  const row = Math.floor(index / 4);
  lemon.position.set(-0.9 + column * 0.6, 2.75 + row * 0.5, 0.55);
  return lemon;
};

const createCloud = (color: number): THREE.Group => {
  const cloud = new THREE.Group();
  const material = makeMaterial(color);
  const offsets = [
    [-0.75, 0, 0],
    [0, 0.18, 0],
    [0.72, -0.04, 0],
    [-0.15, -0.2, 0.18],
  ] as const;

  for (const [x, y, z] of offsets) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.68, 8, 6), material.clone());
    puff.position.set(x, y, z);
    cloud.add(puff);
  }
  return cloud;
};

const createWeatherObjects = (): Record<SceneWeather, THREE.Group> => {
  const sunny = new THREE.Group();
  const sun = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.82, 1),
    makeMaterial(0xffd447),
  );
  sunny.add(sun);
  sunny.position.set(5.1, 6.7, -1.8);

  const partlyCloudy = new THREE.Group();
  const partlySun = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.72, 1),
    makeMaterial(0xffd447),
  );
  partlySun.position.set(0.85, 0.55, -0.25);
  partlyCloudy.add(partlySun);
  const partlyCloud = createCloud(0xd7e0df);
  partlyCloud.position.set(-0.35, 0, 0.15);
  partlyCloudy.add(partlyCloud);
  partlyCloudy.position.set(3.9, 6.25, -1.8);

  const cloudy = createCloud(0xd7e0df);
  cloudy.position.set(-4.1, 6.4, -1.8);

  const thunderstorm = createCloud(0x657786);
  thunderstorm.position.set(-3.6, 6.25, -1.4);
  const bolt = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 1.15, 4),
    makeMaterial(0xf8d346),
  );
  bolt.position.set(0.4, -1.05, 0.08);
  bolt.rotation.z = 0.35;
  thunderstorm.add(bolt);

  for (let index = 0; index < 7; index += 1) {
    const drop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.65, 5),
      makeMaterial(0x7dc7df),
    );
    drop.position.set(-1.05 + index * 0.35, -1.25 - (index % 2) * 0.45, 0.15);
    drop.rotation.z = -0.18;
    thunderstorm.add(drop);
  }

  return { sunny, cloudy, "hot-and-dry": partlyCloudy, thunderstorm };
};

type DisposableMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;

const isDisposableMesh = (object: THREE.Object3D): object is DisposableMesh =>
  object instanceof THREE.Mesh;

const disposeObject = (object: THREE.Object3D): void => {
  if (!isDisposableMesh(object)) return;
  object.geometry.dispose();
  if (Array.isArray(object.material)) {
    for (const material of object.material) material.dispose();
  } else {
    object.material.dispose();
  }
};

const visibleInventoryCount = (prepared: number, maximum: number, divisor: number): number =>
  prepared <= 0 ? 0 : Math.min(maximum, Math.max(1, Math.ceil(prepared / divisor)));

export const createLemonsvilleScene = (
  canvas: HTMLCanvasElement,
  initialState: LemonsvilleSceneState,
): LemonsvilleSceneController | null => {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
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
  const sunlight = new THREE.DirectionalLight(0xfff0c9, 2.3);
  sunlight.position.set(-5, 10, 7);
  scene.add(sunlight);

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
  const signOrigins = signs.map((sign) => sign.rotation.z);

  const customers = Array.from({ length: PASSERBY_POOL_SIZE }, (_, index) =>
    createPerson(index),
  );
  for (const customer of customers) scene.add(customer);

  const buyers = Array.from({ length: BUYER_POOL_SIZE }, (_, index) =>
    createPerson(index + PASSERBY_POOL_SIZE),
  );
  for (const buyer of buyers) {
    buyer.visible = false;
    scene.add(buyer);
  }

  const cupInventory = createCupInventory();
  scene.add(cupInventory.shells);
  scene.add(cupInventory.liquid);

  const lemons = Array.from({ length: 8 }, (_, index) => createLemon(index));
  for (const lemon of lemons) scene.add(lemon);
  const lemonOrigins = lemons.map((lemon) => lemon.position.y);

  const weatherObjects = createWeatherObjects();
  for (const weatherObject of Object.values(weatherObjects)) scene.add(weatherObject);
  const weatherOrigins = Object.freeze({
    sunny: weatherObjects.sunny.position.x,
    cloudy: weatherObjects.cloudy.position.x,
    "hot-and-dry": weatherObjects["hot-and-dry"].position.x,
    thunderstorm: weatherObjects.thunderstorm.position.x,
  });

  let state = initialState;
  let animationFrame: number | null = null;
  let animationEpoch = performance.now();
  let storyboard = createStreetStoryboard({
    durationMs: Math.max(1, state.durationMs),
    prepared: state.prepared,
    sold: state.phase === "simulation" ? state.sold : 0,
    visibleSigns: state.visibleSigns,
    ambientPedestrianCount: customerCount[state.customerActivity],
  });

  const render = (): void => {
    renderer.render(scene, camera);
  };

  const positionStaticPedestrians = (): void => {
    const visibleCount = Math.min(
      customers.length,
      Math.max(6, customerCount[state.customerActivity] + 2),
    );
    customers.forEach((customer, index) => {
      customer.visible = index < visibleCount;
      if (!customer.visible) return;
      const row = index % 2;
      const progress = visibleCount <= 1 ? 0.5 : index / (visibleCount - 1);
      customer.position.set(-7.2 + progress * 14.4, 0, 3.65 + row * 0.7);
      customer.rotation.y = index % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
    });
    for (const buyer of buyers) buyer.visible = false;
  };

  const resetAnimatedObjects = (): void => {
    positionStaticPedestrians();
    signs.forEach((sign, index) => {
      sign.rotation.z = signOrigins[index] ?? 0;
    });
    cupInventory.setCount(storyboard.prepared);
    lemons.forEach((lemon, index) => {
      lemon.position.y = lemonOrigins[index] ?? lemon.position.y;
      lemon.rotation.y = 0;
    });
    for (const weather of Object.keys(weatherObjects) as SceneWeather[]) {
      weatherObjects[weather].position.x = weatherOrigins[weather];
    }
  };

  const animateBuyers = (elapsedMs: number, seconds: number): number => {
    for (const buyer of buyers) buyer.visible = false;
    if (state.phase !== "simulation") return 0;

    let activeBuyerCount = 0;
    for (const sale of storyboard.sales) {
      if (elapsedMs < sale.approachAtMs || elapsedMs > sale.departAtMs) continue;
      const buyer = buyers[activeBuyerCount];
      if (buyer === undefined) break;

      const streetX = sale.direction === -1 ? -8.4 : 8.4;
      const exitX = -streetX;
      const streetZ = 4.0 + sale.lane * 0.34;
      const counterX = sale.direction === -1 ? -0.7 : 0.7;
      const counterZ = 1.65;
      let x: number;
      let z: number;

      if (elapsedMs <= sale.purchaseAtMs) {
        const duration = Math.max(1, sale.purchaseAtMs - sale.approachAtMs);
        const progress = smoothStep((elapsedMs - sale.approachAtMs) / duration);
        x = lerp(streetX, counterX, progress);
        z = lerp(streetZ, counterZ, progress);
      } else {
        const duration = Math.max(1, sale.departAtMs - sale.purchaseAtMs);
        const progress = smoothStep((elapsedMs - sale.purchaseAtMs) / duration);
        x = lerp(counterX, exitX, progress);
        z = lerp(counterZ, streetZ, progress);
      }

      buyer.visible = true;
      buyer.position.set(x, Math.abs(Math.sin(seconds * 7 + sale.saleNumber)) * 0.05, z);
      buyer.rotation.y = sale.direction === -1 ? Math.PI / 2 : -Math.PI / 2;
      activeBuyerCount += 1;
    }
    return activeBuyerCount;
  };

  const animatePassersBy = (
    elapsedMs: number,
    seconds: number,
    activeBuyerCount: number,
  ): void => {
    const targetCount = Math.min(
      customers.length,
      Math.max(
        activeBuyerCount + 1,
        customerCount[state.customerActivity] + 4,
        Math.min(storyboard.passersBy.length, customers.length),
      ),
    );
    const durationMs = Math.max(1, storyboard.durationMs);
    const globalProgress = clamp01(elapsedMs / durationMs);

    customers.forEach((customer, index) => {
      customer.visible = index < targetCount;
      if (!customer.visible) return;

      const beat = storyboard.passersBy[index % storyboard.passersBy.length];
      if (beat === undefined) {
        customer.visible = false;
        return;
      }

      const progress = (globalProgress + index / targetCount) % 1;
      const startX = beat.direction === -1 ? -9 : 9;
      const endX = -startX;
      const attention =
        beat.seesAdvertisement
          ? Math.exp(-Math.pow((progress - 0.5) / 0.12, 2))
          : 0;
      const signSide = beat.signIndex >= 0 && beat.signIndex % 2 === 0 ? -1 : 1;
      const baseX = lerp(startX, endX, progress);
      const x = lerp(baseX, signSide * 4.1, attention * 0.22);
      const z = 4.0 + beat.lane * 0.28 - attention * 0.7;
      const bob = Math.abs(Math.sin(seconds * 5.2 + index * 0.7)) * 0.055;

      customer.position.set(x, bob, z);
      customer.rotation.y =
        attention > 0.55
          ? signSide * 0.72
          : beat.direction === -1
            ? Math.PI / 2
            : -Math.PI / 2;
    });
  };

  const animate = (timestamp: number): void => {
    animationFrame = null;
    if (state.phase === "idle" || state.reducedMotion) {
      resetAnimatedObjects();
      render();
      return;
    }

    const elapsedMs = Math.min(
      storyboard.durationMs,
      Math.max(0, timestamp - animationEpoch),
    );
    const seconds = elapsedMs / 1000;
    const activeBuyerCount = animateBuyers(elapsedMs, seconds);
    animatePassersBy(elapsedMs, seconds, activeBuyerCount);

    cupInventory.setCount(
      state.phase === "simulation"
        ? remainingCupsAt(storyboard, elapsedMs)
        : storyboard.prepared,
    );

    signs.forEach((sign, index) => {
      if (sign.visible) sign.rotation.z = Math.sin(seconds * 1.7 + index * 0.55) * 0.035;
    });
    lemons.forEach((lemon, index) => {
      if (!lemon.visible) return;
      lemon.position.y =
        (lemonOrigins[index] ?? lemon.position.y) + Math.sin(seconds * 2.2 + index) * 0.035;
      lemon.rotation.y = seconds * 0.55 + index;
    });

    const activeWeather = weatherObjects[state.weather];
    activeWeather.position.x =
      weatherOrigins[state.weather] +
      Math.sin(seconds * 0.45) * (state.weather === "sunny" ? 0.08 : 0.3);

    render();
    animationFrame = window.requestAnimationFrame(animate);
  };

  const syncAnimation = (): void => {
    const shouldAnimate = state.phase !== "idle" && !state.reducedMotion;
    if (shouldAnimate && animationFrame === null) {
      animationFrame = window.requestAnimationFrame(animate);
    } else if (!shouldAnimate && animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
      resetAnimatedObjects();
      render();
    }
  };

  const update = (nextState: LemonsvilleSceneState): void => {
    const presentationChanged =
      state.phase !== nextState.phase ||
      state.durationMs !== nextState.durationMs ||
      state.prepared !== nextState.prepared ||
      state.sold !== nextState.sold ||
      state.visibleSigns !== nextState.visibleSigns;

    state = nextState;
    storyboard = createStreetStoryboard({
      durationMs: Math.max(1, state.durationMs),
      prepared: state.prepared,
      sold: state.phase === "simulation" ? state.sold : 0,
      visibleSigns: state.visibleSigns,
      ambientPedestrianCount: customerCount[state.customerActivity],
    });
    if (presentationChanged) animationEpoch = performance.now();

    renderer.setClearColor(skyColor[state.weather], 1);

    for (const [weather, weatherObject] of Object.entries(weatherObjects) as [
      SceneWeather,
      THREE.Group,
    ][]) {
      weatherObject.visible = weather === state.weather;
    }

    const signLimit = Math.max(0, Math.min(signs.length, Math.trunc(state.visibleSigns)));
    signs.forEach((sign, index) => {
      sign.visible = index < signLimit;
    });

    const lemonLimit = visibleInventoryCount(state.prepared, lemons.length, 12);
    lemons.forEach((lemon, index) => {
      lemon.visible = index < lemonLimit;
    });

    cupInventory.setCount(storyboard.prepared);
    if (state.reducedMotion || state.phase === "idle") resetAnimatedObjects();

    render();
    syncAnimation();
  };

  const resize = (width: number, height: number): void => {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    const composition = sceneCameraComposition(safeWidth, safeHeight);

    camera.aspect = safeWidth / safeHeight;
    camera.fov = composition.fov;
    camera.position.set(...composition.position);
    camera.lookAt(...composition.lookAt);
    camera.updateProjectionMatrix();
    renderer.setSize(safeWidth, safeHeight, false);
    render();
  };

  const dispose = (): void => {
    if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
    scene.traverse(disposeObject);
    renderer.dispose();
  };

  update(initialState);
  return Object.freeze({ update, resize, dispose });
};
