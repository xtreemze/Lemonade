import {
  BoxGeometry,
  type BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Euler,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  LinearFilter,
  type Material,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

import { characterProfileFor } from "./characters.js";
import {
  buyerPhaseAt,
  buyerSlotForSale,
  remainingCupsAt,
  sceneCameraComposition,
  sceneShotAt,
  type BuyerPhase,
  type SceneShotKind,
  type StreetStoryboard,
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
  priceCents: number;
  durationMs: number;
  confidence: number;
  characterSeed: number;
  storyboard: StreetStoryboard;
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
const BUYER_POOL_SIZE = 192;
const MAX_PREPARED_CUPS = 400;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const smoothStep = (value: number): number => {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
};

const lerp = (start: number, end: number, progress: number): number =>
  start + (end - start) * progress;

const makeMaterial = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.92 });

const makeWeatherMaterial = (
  color: number,
  emissive = 0x000000,
  emissiveIntensity = 0,
): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color,
    flatShading: false,
    roughness: 0.88,
    metalness: 0,
    emissive,
    emissiveIntensity,
  });

const addBox = (
  parent: Object3D,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  color: number,
): Mesh => {
  const mesh = new Mesh(new BoxGeometry(...size), makeMaterial(color));
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
};

const createStand = (): Group => {
  const stand = new Group();
  addBox(stand, [4.5, 1.8, 1.7], [0, 0.9, 0], 0xe7c672);
  addBox(stand, [4.9, 0.28, 2.05], [0, 2.18, 0], 0xf3d85d);
  addBox(stand, [4.2, 0.8, 0.18], [0, 1.0, 0.94], 0xffefaf);
  addBox(stand, [0.22, 2.4, 0.22], [-2.0, 2.9, 0], 0x5e4934);
  addBox(stand, [0.22, 2.4, 0.22], [2.0, 2.9, 0], 0x5e4934);
  addBox(stand, [4.8, 0.22, 2.0], [0, 4.0, 0], 0xe6a93b);
  return stand;
};

const createHouse = (x: number, color: number, scale: number): Group => {
  const house = new Group();
  addBox(house, [3.4, 2.6, 2.4], [0, 1.3, 0], color);

  const roof = new Mesh(
    new ConeGeometry(2.75, 1.6, 4),
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

const createTree = (x: number, z: number): Group => {
  const tree = new Group();
  const trunk = new Mesh(
    new CylinderGeometry(0.16, 0.24, 1.5, 6),
    makeMaterial(0x765232),
  );
  trunk.position.y = 0.75;
  tree.add(trunk);

  const crown = new Mesh(
    new IcosahedronGeometry(1.05, 0),
    makeMaterial(0x5f8d56),
  );
  crown.position.y = 2.0;
  tree.add(crown);
  tree.position.set(x, 0, z);
  return tree;
};

type SignModel = Readonly<{
  root: Group;
  labelMaterial: MeshStandardMaterial;
}>;

const createSign = (index: number): SignModel => {
  const root = new Group();
  addBox(root, [0.1, 0.85, 0.1], [0, 0.43, 0], 0x644c34);
  addBox(root, [0.95, 0.62, 0.12], [0, 1.05, 0], 0xf5d34c);

  const labelMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.35,
    roughness: 0.9,
    side: DoubleSide,
  });
  const label = new Mesh(new PlaneGeometry(0.86, 0.52), labelMaterial);
  label.position.set(0, 1.05, 0.066);
  root.add(label);

  const side = index % 2 === 0 ? -1 : 1;
  const row = Math.floor(index / 2);
  root.position.set(
    side * (3.6 + (row % 4) * 1.15),
    0,
    1.9 + Math.floor(row / 4) * 1.2,
  );
  root.rotation.y = side * 0.18;
  return Object.freeze({ root, labelMaterial });
};

type PersonRig = Readonly<{
  root: Group;
  torso: Mesh;
  head: Mesh;
  arms: readonly [Group, Group];
  legs: readonly [Group, Group];
  cup: Group;
  strideOffset: number;
  walkPace: number;
  gaitAmplitude: number;
}>;

type SellerRig = Readonly<{
  person: PersonRig;
  eyebrows: readonly [Mesh, Mesh];
  mouth: readonly [Mesh, Mesh];
}>;

const createLimb = (length: number, radius: number, color: number): Group => {
  const pivot = new Group();
  const mesh = new Mesh(
    new CylinderGeometry(radius, radius, length, 5),
    makeMaterial(color),
  );
  mesh.position.y = -length / 2;
  pivot.add(mesh);
  return pivot;
};

const createLemonadeCup = (scale = 1): Group => {
  const cup = new Group();

  const glass = new Mesh(
    new CylinderGeometry(0.075, 0.09, 0.19, 8, 1, true),
    new MeshStandardMaterial({
      color: 0xaeffff,
      transparent: true,
      opacity: 0.46,
      roughness: 0.22,
      metalness: 0,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  cup.add(glass);

  const liquid = new Mesh(
    new CylinderGeometry(0.061, 0.073, 0.115, 8),
    new MeshStandardMaterial({
      color: 0xefff00,
      transparent: true,
      opacity: 0.68,
      roughness: 0.75,
    }),
  );
  liquid.position.y = -0.022;
  cup.add(liquid);

  const iceMaterial = new MeshStandardMaterial({
    color: 0xf3fff3,
    transparent: true,
    opacity: 0.88,
    roughness: 0.42,
  });
  for (const [x, y, z, rotation] of [
    [-0.024, 0.025, 0.012, -0.28],
    [0.027, 0.045, -0.006, 0.34],
  ] as const) {
    const ice = new Mesh(new BoxGeometry(0.052, 0.038, 0.05), iceMaterial.clone());
    ice.position.set(x, y, z);
    ice.rotation.y = rotation;
    cup.add(ice);
  }

  const straw = new Mesh(
    new CylinderGeometry(0.008, 0.008, 0.25, 6),
    makeMaterial(0xff551d),
  );
  straw.position.set(0.028, 0.085, 0.008);
  straw.rotation.z = -0.2;
  cup.add(straw);
  cup.scale.setScalar(scale);
  return cup;
};

const addCharacterHair = (
  head: Mesh,
  style: 0 | 1 | 2 | 3,
  color: number,
  accessory: 0 | 1 | 2,
): void => {
  if (style === 1) {
    const hair = new Mesh(new SphereGeometry(0.255, 7, 4), makeMaterial(color));
    hair.scale.set(1, 0.42, 1);
    hair.position.y = 0.16;
    head.add(hair);
  } else if (style === 2) {
    const hair = new Mesh(new BoxGeometry(0.42, 0.11, 0.34), makeMaterial(color));
    hair.position.set(0, 0.18, -0.01);
    head.add(hair);
  } else if (style === 3) {
    const hair = new Mesh(new CylinderGeometry(0.22, 0.25, 0.12, 7), makeMaterial(color));
    hair.position.y = 0.18;
    head.add(hair);
  }

  if (accessory === 1) {
    const brim = new Mesh(new BoxGeometry(0.46, 0.035, 0.34), makeMaterial(color));
    brim.position.set(0, 0.23, 0.05);
    head.add(brim);
  } else if (accessory === 2) {
    const bridge = new Mesh(new BoxGeometry(0.18, 0.018, 0.018), makeMaterial(0x273036));
    bridge.position.set(0, 0.035, 0.235);
    head.add(bridge);
  }
};

const createPerson = (characterSeed: number, index: number): PersonRig => {
  const profile = characterProfileFor(characterSeed, index);
  const root = new Group();

  const torso = new Mesh(
    new CylinderGeometry(0.25, 0.34, 0.9, 6),
    makeMaterial(profile.clothingColor),
  );
  torso.position.y = 1.05;
  const head = new Mesh(
    new SphereGeometry(0.25, 7, 5),
    makeMaterial(profile.skinColor),
  );
  head.position.y = 1.73;
  root.add(torso, head);

  const eyeMaterial = makeMaterial(0x263238);
  for (const x of [-0.085, 0.085]) {
    const eye = new Mesh(new SphereGeometry(0.024, 5, 4), eyeMaterial.clone());
    eye.position.set(x, 0.035, 0.232);
    head.add(eye);
  }
  addCharacterHair(head, profile.hairStyle, profile.hairColor, profile.accessory);

  const leftArm = createLimb(0.7, 0.085, profile.clothingColor);
  const rightArm = createLimb(0.7, 0.085, profile.clothingColor);
  leftArm.position.set(-0.34, 1.38, 0);
  rightArm.position.set(0.34, 1.38, 0);
  const leftLeg = createLimb(0.8, 0.105, profile.trouserColor);
  const rightLeg = createLimb(0.8, 0.105, profile.trouserColor);
  leftLeg.position.set(-0.14, 0.72, 0);
  rightLeg.position.set(0.14, 0.72, 0);
  root.add(leftArm, rightArm, leftLeg, rightLeg);

  const cup = createLemonadeCup(0.9);
  cup.position.set(0, -0.65, 0.07);
  cup.visible = false;
  rightArm.add(cup);

  root.scale.set(
    profile.widthScale,
    profile.heightScale,
    profile.widthScale,
  );

  return Object.freeze({
    root,
    torso,
    head,
    arms: [leftArm, rightArm] as const,
    legs: [leftLeg, rightLeg] as const,
    cup,
    strideOffset: profile.strideOffset,
    walkPace: profile.walkPace,
    gaitAmplitude: profile.gaitAmplitude,
  });
};

const createSeller = (characterSeed: number): SellerRig => {
  const person = createPerson(characterSeed ^ 0x51_1e_12, 10_001);
  const expressionMaterial = makeMaterial(0x3a2a25);

  const leftBrow = new Mesh(
    new BoxGeometry(0.11, 0.018, 0.018),
    expressionMaterial.clone(),
  );
  const rightBrow = leftBrow.clone();
  leftBrow.position.set(-0.085, 0.125, 0.235);
  rightBrow.position.set(0.085, 0.125, 0.235);

  const mouthLeft = new Mesh(
    new BoxGeometry(0.12, 0.018, 0.018),
    expressionMaterial.clone(),
  );
  const mouthRight = mouthLeft.clone();
  mouthLeft.position.set(-0.055, -0.09, 0.238);
  mouthRight.position.set(0.055, -0.09, 0.238);

  person.head.add(leftBrow, rightBrow, mouthLeft, mouthRight);
  return Object.freeze({
    person,
    eyebrows: [leftBrow, rightBrow] as const,
    mouth: [mouthLeft, mouthRight] as const,
  });
};

const sellerMood = (confidence: number): string => {
  const bounded = Math.max(0, Math.min(5, Math.round(confidence)));
  if (bounded <= 0) return "discouraged";
  if (bounded === 1) return "uncertain";
  if (bounded === 2) return "cautious";
  if (bounded === 3) return "steady";
  if (bounded === 4) return "optimistic";
  return "radiant";
};

const applySellerExpression = (seller: SellerRig, confidence: number): void => {
  const progress = clamp01(confidence / 5);
  const expression = progress * 2 - 1;
  resetPersonPose(seller.person);
  seller.person.torso.position.y = 1.05;
  seller.person.head.position.y = 1.73;

  seller.person.head.rotation.x = lerp(0.14, -0.045, progress);
  seller.person.torso.rotation.x = lerp(0.13, -0.015, progress);
  seller.eyebrows[0].rotation.z = expression * 0.18;
  seller.eyebrows[1].rotation.z = -expression * 0.18;
  seller.eyebrows[0].position.y = 0.125 + progress * 0.018;
  seller.eyebrows[1].position.y = 0.125 + progress * 0.018;
  seller.mouth[0].rotation.z = -expression * 0.34;
  seller.mouth[1].rotation.z = expression * 0.34;
  seller.person.arms[0].rotation.x = lerp(0.18, -0.12, progress);
  seller.person.arms[1].rotation.x = lerp(0.12, -0.08, progress);
};

const resetPersonPose = (person: PersonRig): void => {
  person.torso.rotation.set(0, 0, 0);
  person.head.rotation.set(0, 0, 0);
  for (const limb of [...person.arms, ...person.legs]) limb.rotation.set(0, 0, 0);
  person.cup.visible = false;
};

const applyWalkingPose = (
  person: PersonRig,
  seconds: number,
  pace: number,
  carryingCup: boolean,
): void => {
  const stride =
    Math.sin(seconds * 7.2 * pace * person.walkPace + person.strideOffset) *
    person.gaitAmplitude;
  person.legs[0].rotation.x = stride;
  person.legs[1].rotation.x = -stride;
  person.arms[0].rotation.x = -stride * 0.86;
  person.arms[1].rotation.x = carryingCup ? -0.3 : stride * 0.86;
  person.torso.rotation.z =
    Math.sin(seconds * 3.6 * pace * person.walkPace + person.strideOffset) * 0.04;
  person.cup.visible = carryingCup;
};

const applyBuyerPose = (
  person: PersonRig,
  phase: BuyerPhase,
  seconds: number,
  index: number,
): void => {
  resetPersonPose(person);
  if (phase === "approaching") {
    applyWalkingPose(person, seconds, 1.05, false);
  } else if (phase === "purchasing") {
    person.arms[1].rotation.x = -1.25;
    person.torso.rotation.x = 0.08;
  } else if (phase === "drinking") {
    person.cup.visible = true;
    person.arms[1].rotation.x = -2.35;
    person.head.rotation.x = 0.13;
    person.head.rotation.z = index % 2 === 0 ? -0.06 : 0.06;
  } else if (phase === "departing") {
    applyWalkingPose(person, seconds, 1.1, true);
  }
};

type CupInventory = Readonly<{
  meshes: readonly InstancedMesh[];
  setCount(count: number): void;
}>;

const createCupInventory = (): CupInventory => {
  const shells = new InstancedMesh(
    new CylinderGeometry(0.075, 0.09, 0.19, 8, 1, true),
    new MeshStandardMaterial({
      color: 0xaeffff,
      transparent: true,
      opacity: 0.42,
      roughness: 0.22,
      metalness: 0,
      side: DoubleSide,
      depthWrite: false,
    }),
    MAX_PREPARED_CUPS,
  );
  const liquid = new InstancedMesh(
    new CylinderGeometry(0.061, 0.073, 0.115, 8),
    new MeshStandardMaterial({
      color: 0xefff00,
      transparent: true,
      opacity: 0.66,
      roughness: 0.72,
    }),
    MAX_PREPARED_CUPS,
  );
  const iceA = new InstancedMesh(
    new BoxGeometry(0.052, 0.038, 0.05),
    new MeshStandardMaterial({
      color: 0xf3fff3,
      transparent: true,
      opacity: 0.88,
      roughness: 0.42,
    }),
    MAX_PREPARED_CUPS,
  );
  const iceB = new InstancedMesh(
    new BoxGeometry(0.048, 0.036, 0.048),
    new MeshStandardMaterial({
      color: 0xe9f4e9,
      transparent: true,
      opacity: 0.86,
      roughness: 0.44,
    }),
    MAX_PREPARED_CUPS,
  );
  const straws = new InstancedMesh(
    new CylinderGeometry(0.008, 0.008, 0.25, 6),
    makeMaterial(0xff551d),
    MAX_PREPARED_CUPS,
  );

  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const scale = new Vector3(1, 1, 1);
  const position = new Vector3();

  for (let index = 0; index < MAX_PREPARED_CUPS; index += 1) {
    const column = index % 20;
    const row = Math.floor(index / 20) % 7;
    const depth = Math.floor(index / 140);
    const x = -1.7 + column * 0.18;
    const y = 1.45 + row * 0.19;
    const z = 1.04 - depth * 0.14;

    matrix.makeTranslation(x, y, z);
    shells.setMatrixAt(index, matrix);
    matrix.makeTranslation(x, y - 0.022, z + 0.003);
    liquid.setMatrixAt(index, matrix);

    quaternion.setFromEuler(new Euler(0, -0.28, 0));
    position.set(x - 0.024, y + 0.025, z + 0.012);
    matrix.compose(position, quaternion, scale);
    iceA.setMatrixAt(index, matrix);

    quaternion.setFromEuler(new Euler(0, 0.34, 0));
    position.set(x + 0.027, y + 0.045, z - 0.006);
    matrix.compose(position, quaternion, scale);
    iceB.setMatrixAt(index, matrix);

    quaternion.setFromEuler(new Euler(0, 0, -0.2));
    position.set(x + 0.028, y + 0.085, z + 0.008);
    matrix.compose(position, quaternion, scale);
    straws.setMatrixAt(index, matrix);
  }

  const meshes = Object.freeze([shells, liquid, iceA, iceB, straws] as const);
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = 0;
  }

  return Object.freeze({
    meshes,
    setCount(count: number): void {
      const visible = Math.min(
        MAX_PREPARED_CUPS,
        Math.max(0, Number.isFinite(count) ? Math.trunc(count) : 0),
      );
      for (const mesh of meshes) mesh.count = visible;
    },
  });
};

const createLemon = (index: number): Group => {
  const lemon = new Group();
  const fruit = new Mesh(
    new IcosahedronGeometry(0.22, 1),
    makeMaterial(0xf6d33b),
  );
  fruit.scale.set(1.15, 0.9, 0.9);
  lemon.add(fruit);

  const leaf = new Mesh(
    new ConeGeometry(0.08, 0.22, 5),
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

const createCloud = (color: number): Group => {
  const cloud = new Group();
  const material = makeWeatherMaterial(color);
  const puffs = [
    { radius: 0.72, x: -0.78, y: 0, z: 0 },
    { radius: 0.84, x: -0.08, y: 0.22, z: 0 },
    { radius: 0.74, x: 0.72, y: 0.02, z: 0 },
    { radius: 0.62, x: -0.22, y: -0.18, z: 0.18 },
    { radius: 0.58, x: 0.3, y: -0.16, z: 0.12 },
  ] as const;

  for (const puff of puffs) {
    const mesh = new Mesh(
      new SphereGeometry(puff.radius, 20, 16),
      material.clone(),
    );
    mesh.position.set(puff.x, puff.y, puff.z);
    cloud.add(mesh);
  }
  return cloud;
};

const createSun = (radius: number): Group => {
  const group = new Group();
  const core = new Mesh(
    new SphereGeometry(radius, 24, 18),
    makeWeatherMaterial(0xffd447, 0xffc93a, 0.55),
  );
  group.add(core);

  const halo = new Mesh(
    new SphereGeometry(radius * 1.18, 24, 18),
    new MeshStandardMaterial({
      color: 0xffe27a,
      emissive: 0xffd447,
      emissiveIntensity: 0.45,
      roughness: 1,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    }),
  );
  group.add(halo);
  return group;
};

const createWeatherObjects = (): Record<SceneWeather, Group> => {
  const sunny = createSun(0.82);
  sunny.position.set(5.1, 6.7, -1.8);

  const partlyCloudy = new Group();
  const partlySun = createSun(0.62);
  partlySun.position.set(0.88, 0.5, -0.25);
  partlyCloudy.add(partlySun);
  const partlyCloud = createCloud(0xd7e0df);
  partlyCloud.position.set(-0.35, 0, 0.15);
  partlyCloudy.add(partlyCloud);
  partlyCloudy.position.set(3.9, 6.25, -1.8);

  const cloudy = createCloud(0xd7e0df);
  cloudy.position.set(-4.1, 6.4, -1.8);

  const thunderstorm = createCloud(0x657786);
  thunderstorm.position.set(-3.6, 6.25, -1.4);
  const bolt = new Mesh(
    new ConeGeometry(0.16, 1.05, 8),
    makeWeatherMaterial(0xf8d346, 0xf8d346, 0.3),
  );
  bolt.position.set(0.4, -1.05, 0.08);
  bolt.rotation.z = 0.35;
  thunderstorm.add(bolt);

  for (let index = 0; index < 7; index += 1) {
    const drop = new Mesh(
      new CylinderGeometry(0.02, 0.02, 0.62, 8),
      makeWeatherMaterial(0x7dc7df),
    );
    drop.position.set(-1.05 + index * 0.35, -1.25 - (index % 2) * 0.45, 0.15);
    drop.rotation.z = -0.18;
    thunderstorm.add(drop);
  }

  return { sunny, cloudy, "hot-and-dry": partlyCloudy, thunderstorm };
};

type DisposableMesh = Mesh<BufferGeometry, Material | Material[]>;

const isDisposableMesh = (object: Object3D): object is DisposableMesh =>
  object instanceof Mesh;

const disposeObject = (object: Object3D): void => {
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
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 6.8, 13.5);
  camera.lookAt(0, 1.7, 0);

  scene.add(new HemisphereLight(0xfff2c6, 0x526b51, 1.9));
  const sunlight = new DirectionalLight(0xfff0c9, 1.8);
  sunlight.position.set(-5, 10, 7);
  scene.add(sunlight);

  const ground = new Mesh(new PlaneGeometry(30, 24), makeMaterial(0x92ad68));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -1.5;
  scene.add(ground);

  const road = new Mesh(new PlaneGeometry(30, 4.0), makeMaterial(0xb2916e));
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

  const signs = Array.from({ length: 40 }, (_, index) => createSign(index));
  let signTexture: CanvasTexture | null = null;
  let signPriceLabel = "";
  let disposed = false;
  let signTextureGeneration = 0;
  let signLabelModule:
    | Promise<Readonly<{ createPriceSignSurface(priceLabel: string): HTMLCanvasElement }>>
    | null = null;
  for (const sign of signs) scene.add(sign.root);
  const signOrigins = signs.map((sign) => sign.root.rotation.z);

  const customers = Array.from({ length: PASSERBY_POOL_SIZE }, (_, index) =>
    createPerson(initialState.characterSeed, index),
  );
  for (const customer of customers) scene.add(customer.root);

  const buyers = Array.from({ length: BUYER_POOL_SIZE }, (_, index) =>
    createPerson(initialState.characterSeed, index + PASSERBY_POOL_SIZE),
  );
  for (const buyer of buyers) {
    buyer.root.visible = false;
    scene.add(buyer.root);
  }

  const seller = createSeller(initialState.characterSeed);
  seller.person.root.position.set(0, 1.28, -0.32);
  seller.person.root.scale.multiplyScalar(1.06);
  scene.add(seller.person.root);

  const cupInventory = createCupInventory();
  for (const mesh of cupInventory.meshes) scene.add(mesh);
  canvas.dataset["cupVisualStyle"] = "original-svg-3d";
  canvas.dataset["characterSeed"] = String(initialState.characterSeed >>> 0);

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
  let storyboard = state.storyboard;

  let viewportWidth = 1;
  let viewportHeight = 1;
  let currentShot: SceneShotKind = "establishing";

  const applyCameraShot = (shot: SceneShotKind): void => {
    currentShot = shot;
    const composition = sceneCameraComposition(viewportWidth, viewportHeight, shot);
    camera.aspect = viewportWidth / viewportHeight;
    camera.fov = composition.fov;
    camera.position.set(...composition.position);
    camera.lookAt(...composition.lookAt);
    camera.updateProjectionMatrix();
    canvas.dataset["sceneShot"] = shot;
  };

  const updateSignPrice = (priceLabel: string): void => {
    if (priceLabel === signPriceLabel) return;
    signPriceLabel = priceLabel;
    canvas.dataset["signPriceLabel"] = priceLabel;
    signLabelModule ??= import("./sign-label.js");
    const generation = ++signTextureGeneration;
    void signLabelModule.then(({ createPriceSignSurface }) => {
      if (disposed || generation !== signTextureGeneration || priceLabel !== signPriceLabel) return;
      const nextTexture = new CanvasTexture(createPriceSignSurface(priceLabel));
      const previousTexture = signTexture;
      nextTexture.colorSpace = SRGBColorSpace;
      nextTexture.minFilter = LinearFilter;
      nextTexture.magFilter = LinearFilter;
      signTexture = nextTexture;
      for (const sign of signs) {
        sign.labelMaterial.map = nextTexture;
        sign.labelMaterial.needsUpdate = true;
      }
      previousTexture?.dispose();
      render();
    });
  };

  const render = (): void => {
    renderer.render(scene, camera);
  };

  const positionStaticPedestrians = (): void => {
    const visibleCount = Math.min(
      customers.length,
      Math.max(6, customerCount[state.customerActivity] + 2),
    );
    customers.forEach((customer, index) => {
      customer.root.visible = index < visibleCount;
      resetPersonPose(customer);
      if (!customer.root.visible) return;
      const row = index % 2;
      const progress = visibleCount <= 1 ? 0.5 : index / (visibleCount - 1);
      customer.root.position.set(-7.2 + progress * 14.4, 0, 3.65 + row * 0.7);
      customer.root.rotation.y = index % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
    });
    for (const buyer of buyers) {
      resetPersonPose(buyer);
      buyer.root.visible = false;
    }
  };

  const resetAnimatedObjects = (): void => {
    positionStaticPedestrians();
    applySellerExpression(seller, state.confidence);
    signs.forEach((sign, index) => {
      sign.root.rotation.z = signOrigins[index] ?? 0;
    });
    cupInventory.setCount(storyboard.prepared);
    lemons.forEach((lemon, index) => {
      lemon.position.y = lemonOrigins[index] ?? lemon.position.y;
      lemon.rotation.y = 0;
    });
    for (const weather of Object.keys(weatherObjects) as SceneWeather[]) {
      weatherObjects[weather].position.x = weatherOrigins[weather];
    }
    applyCameraShot("establishing");
  };

  const animateBuyers = (elapsedMs: number, seconds: number): number => {
    for (const buyer of buyers) {
      buyer.root.visible = false;
      resetPersonPose(buyer);
    }
    if (state.phase !== "simulation") return 0;

    let activeBuyerCount = 0;
    for (const sale of storyboard.sales) {
      const phase = buyerPhaseAt(sale, elapsedMs);
      if (phase === "inactive") continue;
      const buyer = buyers[buyerSlotForSale(sale, buyers.length)];
      if (buyer === undefined) continue;

      const streetX = sale.direction === -1 ? -8.4 : 8.4;
      const exitX = -streetX;
      const streetZ = 4.0 + sale.lane * 0.34;
      const counterX = sale.direction === -1 ? -0.72 : 0.72;
      const counterZ = 1.62;
      const drinkX = sale.direction === -1 ? -1.35 : 1.35;
      const drinkZ = 2.12;
      let x = counterX;
      let z = counterZ;

      if (phase === "approaching") {
        const duration = Math.max(1, sale.purchaseAtMs - sale.approachAtMs);
        const progress = smoothStep((elapsedMs - sale.approachAtMs) / duration);
        x = lerp(streetX, counterX, progress);
        z = lerp(streetZ, counterZ, progress);
      } else if (phase === "drinking") {
        const duration = Math.max(1, sale.drinkEndAtMs - sale.purchaseEndAtMs);
        const progress = smoothStep((elapsedMs - sale.purchaseEndAtMs) / duration);
        x = lerp(counterX, drinkX, Math.min(1, progress * 1.8));
        z = lerp(counterZ, drinkZ, Math.min(1, progress * 1.8));
      } else if (phase === "departing") {
        const duration = Math.max(1, sale.departAtMs - sale.drinkEndAtMs);
        const progress = smoothStep((elapsedMs - sale.drinkEndAtMs) / duration);
        x = lerp(drinkX, exitX, progress);
        z = lerp(drinkZ, streetZ, progress);
      }

      buyer.root.visible = true;
      buyer.root.position.set(x, 0, z);
      buyer.root.rotation.y =
        phase === "purchasing" || phase === "drinking"
          ? sale.direction === -1
            ? -0.22
            : 0.22
          : sale.direction === -1
            ? Math.PI / 2
            : -Math.PI / 2;
      applyBuyerPose(buyer, phase, seconds, sale.saleNumber);
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
      customer.root.visible = index < targetCount;
      resetPersonPose(customer);
      if (!customer.root.visible) return;

      const beat = storyboard.passersBy[index % storyboard.passersBy.length];
      if (beat === undefined) {
        customer.root.visible = false;
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
      const pace = 0.92 + (index % 5) * 0.055;

      customer.root.position.set(x, 0, z);
      customer.root.rotation.y =
        attention > 0.55
          ? signSide * 0.72
          : beat.direction === -1
            ? Math.PI / 2
            : -Math.PI / 2;
      applyWalkingPose(customer, seconds, pace, false);
    });
  };

  const animateSeller = (seconds: number, elapsedMs: number): void => {
    applySellerExpression(seller, state.confidence);
    if (state.reducedMotion || state.phase === "idle") return;
    const breathing = Math.sin(seconds * 2.1) * 0.025;
    seller.person.torso.position.y = 1.05 + breathing;
    seller.person.head.position.y = 1.73 + breathing * 0.7;
    seller.person.arms[0].rotation.x += Math.sin(seconds * 1.7) * 0.035;
    seller.person.arms[1].rotation.x += Math.sin(seconds * 1.7 + 0.8) * 0.035;

    const serving =
      state.phase === "simulation" &&
      storyboard.sales.some((sale) => buyerPhaseAt(sale, elapsedMs) === "purchasing");
    if (serving) {
      seller.person.arms[1].rotation.x = -1.2;
      seller.person.torso.rotation.x -= 0.06;
    }
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
    const nextShot =
      state.phase === "simulation" ? sceneShotAt(storyboard, elapsedMs) : "establishing";
    if (nextShot !== currentShot) applyCameraShot(nextShot);

    const activeBuyerCount = animateBuyers(elapsedMs, seconds);
    animatePassersBy(elapsedMs, seconds, activeBuyerCount);
    animateSeller(seconds, elapsedMs);

    cupInventory.setCount(
      state.phase === "simulation"
        ? remainingCupsAt(storyboard, elapsedMs)
        : storyboard.prepared,
    );

    signs.forEach((sign, index) => {
      if (sign.root.visible) {
        sign.root.rotation.z = Math.sin(seconds * 1.7 + index * 0.55) * 0.035;
      }
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
      state.visibleSigns !== nextState.visibleSigns ||
      state.priceCents !== nextState.priceCents ||
      state.confidence !== nextState.confidence;

    state = nextState;
    storyboard = state.storyboard;
    updateSignPrice(storyboard.priceLabel);
    canvas.dataset["signPriceLabel"] = storyboard.priceLabel;
    canvas.dataset["sellerMood"] = sellerMood(state.confidence);
    applySellerExpression(seller, state.confidence);
    if (presentationChanged) {
      animationEpoch = performance.now();
      applyCameraShot("establishing");
    }

    renderer.setClearColor(skyColor[state.weather], 1);

    for (const [weather, weatherObject] of Object.entries(weatherObjects) as [
      SceneWeather,
      Group,
    ][]) {
      weatherObject.visible = weather === state.weather;
    }

    const signLimit = Math.max(0, Math.min(signs.length, Math.trunc(state.visibleSigns)));
    signs.forEach((sign, index) => {
      sign.root.visible = index < signLimit;
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
    viewportWidth = Math.max(1, Math.floor(width));
    viewportHeight = Math.max(1, Math.floor(height));
    renderer.setSize(viewportWidth, viewportHeight, false);
    applyCameraShot(currentShot);
    render();
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    signTextureGeneration += 1;
    if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
    signTexture?.dispose();
    scene.traverse(disposeObject);
    renderer.dispose();
  };

  update(initialState);
  return Object.freeze({ update, resize, dispose });
};
