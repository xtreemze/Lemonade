import {
  BoxGeometry,
  type BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  SphereGeometry,
  LinearFilter,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from "three";

import { characterProfileFor, type CharacterProfile } from "./characters.js";
import type { StreetMotion } from "./crowd-motion.js";
import type { CupInventory } from "./cup-inventory.js";
import { walkingCycleAtDistance } from "./gait.js";
import {
  characterGroundClearance,
  WORLD_SCALE,
} from "./world-scale.js";
import { SELLER_Z } from "./stand-anchors.js";
import type { SellerGestureApplier } from "./character-detail.js";
import type { StandDetailController } from "./stand-detail.js";
import type { WeatherDetailController } from "./weather-detail.js";
import {
  buyerPhaseAt,
  buyerSlotForSale,
  remainingCameraProgressAt,
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
  visibleSigns: number;
  prepared: number;
  durationMs: number;
  confidence: number;
  nextConfidence: number;
  characterSeed: number;
  storyboard: StreetStoryboard;
  phase: ScenePhase;
  reducedMotion: boolean;
}>;

export interface LemonsvilleSceneController {
  update(state: LemonsvilleSceneState): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const PASSERBY_POOL_SIZE = 32;
const BUYER_POOL_SIZE = 192;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const smoothStep = (value: number): number => {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
};

const lerp = (start: number, end: number, progress: number): number =>
  start + (end - start) * progress;

const makeMaterial = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.92 });

const makeCharacterMaterial = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: false, roughness: 0.88 });

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

type StandModel = Readonly<{
  root: Group;
  shutter: Group;
}>;

const createStand = (): StandModel => {
  const root = new Group();
  const shutter = new Group();
  shutter.visible = false;
  root.add(shutter);
  return Object.freeze({ root, shutter });
};

type SignModel = Readonly<{
  root: Group;
  labelMaterial: MeshStandardMaterial;
}>;

const createSign = (): SignModel => {
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

  return Object.freeze({ root, labelMaterial });
};

type LimbRig = Readonly<{
  root: Group;
  lower: Group;
}>;

type PersonRig = Readonly<{
  root: Group;
  torso: Mesh;
  head: Mesh;
  arms: readonly [LimbRig, LimbRig];
  legs: readonly [LimbRig, LimbRig];
  cup: Group;
  strideOffset: number;
  walkPace: number;
  gaitAmplitude: number;
  profile: CharacterProfile;
}>;

type SellerRig = Readonly<{
  person: PersonRig;
  eyebrows: readonly [Group, Group];
  mouth: readonly [Group, Group];
}>;

const personGroundY = (person: PersonRig): number =>
  characterGroundClearance(person.profile.heightScale);

const createLimb = (
  upperLength: number,
  lowerLength: number,
  radius: number,
  upperColor: number,
  lowerColor: number,
  extremityColor: number,
  foot = false,
): LimbRig => {
  const root = new Group();
  const upper = new Mesh(
    new CylinderGeometry(radius, radius * 0.94, upperLength, 8),
    makeCharacterMaterial(upperColor),
  );
  upper.position.y = -upperLength / 2;
  root.add(upper);

  const joint = new Mesh(
    new SphereGeometry(radius * 1.14, 9, 6),
    makeCharacterMaterial(lowerColor),
  );
  joint.position.y = -upperLength;
  root.add(joint);

  const lower = new Group();
  lower.position.y = -upperLength;
  const lowerMesh = new Mesh(
    new CylinderGeometry(radius * 0.92, radius * 0.82, lowerLength, 8),
    makeCharacterMaterial(lowerColor),
  );
  lowerMesh.position.y = -lowerLength / 2;
  lower.add(lowerMesh);

  const extremity = foot
    ? new Mesh(
        new BoxGeometry(radius * 2.1, radius * 1.25, radius * 3.2),
        makeCharacterMaterial(extremityColor),
      )
    : new Mesh(
        new SphereGeometry(radius * 1.05, 9, 6),
        makeCharacterMaterial(extremityColor),
      );
  extremity.position.set(0, -lowerLength, foot ? radius * 0.62 : 0);
  lower.add(extremity);
  root.add(lower);

  return Object.freeze({ root, lower });
};

const createPerson = (characterSeed: number, index: number): PersonRig => {
  const profile = characterProfileFor(characterSeed, index);
  const root = new Group();

  const torso = new Mesh(
    new CylinderGeometry(0.25, 0.34, 0.9, 10),
    makeCharacterMaterial(profile.clothingColor),
  );
  torso.position.y = 1.05;

  const head = new Mesh(
    new SphereGeometry(0.27, 12, 8),
    makeCharacterMaterial(profile.skinColor),
  );
  head.scale.set(0.94, 1.04, 0.9);
  head.position.y = 1.78;
  root.add(torso, head);

  const leftArm = createLimb(
    0.38,
    0.34,
    0.082,
    profile.clothingColor,
    profile.skinColor,
    profile.skinColor,
  );
  const rightArm = createLimb(
    0.38,
    0.34,
    0.082,
    profile.clothingColor,
    profile.skinColor,
    profile.skinColor,
  );
  leftArm.root.position.set(-0.35, 1.38, 0);
  rightArm.root.position.set(0.35, 1.38, 0);

  const leftLeg = createLimb(
    0.43,
    0.42,
    0.105,
    profile.trouserColor,
    profile.trouserColor,
    0x30383d,
    true,
  );
  const rightLeg = createLimb(
    0.43,
    0.42,
    0.105,
    profile.trouserColor,
    profile.trouserColor,
    0x30383d,
    true,
  );
  leftLeg.root.position.set(-0.14, 0.72, 0);
  rightLeg.root.position.set(0.14, 0.72, 0);
  root.add(leftArm.root, rightArm.root, leftLeg.root, rightLeg.root);

  const cup = new Group();
  cup.scale.setScalar(0.9);
  cup.position.set(0, -0.35, 0.08);
  cup.visible = false;
  rightArm.lower.add(cup);

  root.scale.set(
    profile.widthScale * WORLD_SCALE.character.renderScale,
    profile.heightScale * WORLD_SCALE.character.renderScale,
    profile.widthScale * WORLD_SCALE.character.renderScale,
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
    profile,
  });
};

const createSeller = (characterSeed: number): SellerRig => {
  const person = createPerson(characterSeed ^ 0x51_1e_12, 10_001);
  const leftBrow = new Group();
  const rightBrow = new Group();
  const mouthLeft = new Group();
  const mouthRight = new Group();
  leftBrow.position.set(-0.085, 0.125, 0.235);
  rightBrow.position.set(0.085, 0.125, 0.235);
  mouthLeft.position.set(-0.055, -0.09, 0.238);
  mouthRight.position.set(0.055, -0.09, 0.238);
  person.head.add(leftBrow, rightBrow, mouthLeft, mouthRight);
  return Object.freeze({
    person,
    eyebrows: [leftBrow, rightBrow] as const,
    mouth: [mouthLeft, mouthRight] as const,
  });
};

const applySellerExpression = (seller: SellerRig, confidence: number): void => {
  const progress = clamp01(confidence / 5);
  const expression = progress * 2 - 1;
  resetPersonPose(seller.person);
  seller.person.torso.position.y = 1.05;
  seller.person.head.position.y = 1.73;

  seller.person.head.rotation.x = lerp(0.2, -0.06, progress);
  seller.person.torso.rotation.x = lerp(0.17, -0.025, progress);
  seller.eyebrows[0].rotation.z = expression * 0.26;
  seller.eyebrows[1].rotation.z = -expression * 0.26;
  seller.eyebrows[0].position.y = 0.125 + progress * 0.018;
  seller.eyebrows[1].position.y = 0.125 + progress * 0.018;
  seller.mouth[0].rotation.z = -expression * 0.46;
  seller.mouth[1].rotation.z = expression * 0.46;
  seller.mouth[0].position.y = -0.09 + expression * 0.012;
  seller.mouth[1].position.y = -0.09 + expression * 0.012;
  seller.person.arms[0].root.rotation.x = lerp(0.28, -0.18, progress);
  seller.person.arms[1].root.rotation.x = lerp(0.22, -0.14, progress);
};

const resetPersonPose = (person: PersonRig): void => {
  person.torso.rotation.set(0, 0, 0);
  person.head.rotation.set(0, 0, 0);
  person.torso.position.y = 1.05;
  person.head.position.y = 1.78;
  for (const limb of [...person.arms, ...person.legs]) {
    limb.root.rotation.set(0, 0, 0);
    limb.lower.rotation.set(0, 0, 0);
  }
  person.cup.visible = false;
};

const applyWalkingPose = (
  person: PersonRig,
  travelDistance: number,
  carryingCup: boolean,
): void => {
  const cycle = walkingCycleAtDistance(
    travelDistance,
    person.profile.heightScale,
    person.walkPace,
    person.strideOffset,
  );
  const stride = Math.sin(cycle) * person.gaitAmplitude;
  const oppositeStride = Math.sin(cycle + Math.PI) * person.gaitAmplitude;
  const stance = Math.abs(Math.sin(cycle));

  person.torso.position.y = 1.05 + stance * 0.026;
  person.head.position.y = 1.78 + stance * 0.018;
  person.torso.rotation.y = Math.sin(cycle) * 0.028;

  person.legs[0].root.rotation.x = stride;
  person.legs[1].root.rotation.x = oppositeStride;
  person.legs[0].lower.rotation.x = Math.max(0, -Math.sin(cycle)) * 0.62;
  person.legs[1].lower.rotation.x = Math.max(0, Math.sin(cycle)) * 0.62;

  person.arms[0].root.rotation.x = -stride * 0.78;
  person.arms[0].lower.rotation.x = -0.12 - Math.max(0, stride) * 0.22;
  person.arms[1].root.rotation.x = carryingCup ? -0.54 : stride * 0.78;
  person.arms[1].lower.rotation.x = carryingCup ? -1.05 : -0.12 - Math.max(0, -stride) * 0.22;

  person.torso.rotation.z = Math.sin(cycle * 0.5) * 0.035;
  person.head.rotation.z = -person.torso.rotation.z * 0.42;
  person.cup.visible = carryingCup;
};

const applyBuyerPose = (
  person: PersonRig,
  phase: BuyerPhase,
  travelDistance: number,
  index: number,
): void => {
  resetPersonPose(person);
  if (phase === "approaching") {
    applyWalkingPose(person, travelDistance, false);
  } else if (phase === "purchasing") {
    person.arms[1].root.rotation.x = -0.88;
    person.arms[1].lower.rotation.x = -1.0;
    person.arms[0].root.rotation.x = -0.12;
    person.torso.rotation.x = 0.07;
    person.head.rotation.x = -0.04;
  } else if (phase === "drinking") {
    person.cup.visible = true;
    person.arms[1].root.rotation.x = -1.05;
    person.arms[1].lower.rotation.x = -1.42;
    person.head.rotation.x = 0.14;
    person.head.rotation.z = index % 2 === 0 ? -0.055 : 0.055;
    person.torso.rotation.x = -0.025;
  } else if (phase === "departing") {
    applyWalkingPose(person, travelDistance, true);
  }
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

export const createLemonsvilleScene = (
  canvas: HTMLCanvasElement,
  initialState: LemonsvilleSceneState,
): LemonsvilleSceneController | null => {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 180);

  const hemisphere = new HemisphereLight(0xfff2c6, 0x526b51, 1.9);
  scene.add(hemisphere);
  const sunlight = new DirectionalLight(0xfff0c9, 1.8);
  sunlight.position.set(-5, 10, 7);
  scene.add(sunlight);

  const ground = new Mesh(new PlaneGeometry(160, 150), makeMaterial(0x92ad68));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -32;
  scene.add(ground);

  const stand = createStand();
  scene.add(stand.root);

  const signs = Array.from({ length: 40 }, () => createSign());
  let signTexture: CanvasTexture | null = null;
  let signPriceLabel = "";
  let disposed = false;
  let signTextureGeneration = 0;
  let signLabelModule:
    | Promise<Readonly<{ createPriceSignSurface(priceLabel: string): HTMLCanvasElement }>>
    | null = null;

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
  seller.person.root.position.set(
    0,
    personGroundY(seller.person),
    SELLER_Z,
  );
  seller.person.root.scale.multiplyScalar(0.98);
  scene.add(seller.person.root);

  let cupInventory: CupInventory | null = null;
  let standDetail: StandDetailController | null = null;
  canvas.dataset["cupVisualStyle"] = "original-svg-3d";

  const weatherObjects: Record<SceneWeather, Group> = {
    sunny: new Group(),
    cloudy: new Group(),
    "hot-and-dry": new Group(),
    thunderstorm: new Group(),
  };
  for (const weatherObject of Object.values(weatherObjects)) scene.add(weatherObject);

  let state = initialState;
  let crowdMotion: StreetMotion | null = null;
  let applySellerGesture: SellerGestureApplier | null = null;
  let weatherDetail: WeatherDetailController | null = null;
  let ambientLife:
    | Readonly<{
        update(
          weather: SceneWeather,
          phase: ScenePhase,
          elapsedMs: number,
          durationMs: number,
        ): void;
      }>
    | null = null;
  let animationFrame: number | null = null;
  let animationEpoch = performance.now();
  let storyboard = state.storyboard;

  let viewportWidth = 1;
  let viewportHeight = 1;
  let currentShot: SceneShotKind = state.phase === "forecast" ? "forecast" : "stand";
  let currentCameraProgress = 0;

  const applyCameraShot = (shot: SceneShotKind): void => {
    currentShot = shot;
    currentCameraProgress = shot === "remaining" ? 1 : 0;
    const composition = sceneCameraComposition(viewportWidth, viewportHeight, shot);
    camera.aspect = viewportWidth / viewportHeight;
    camera.fov = composition.fov;
    camera.position.set(...composition.position);
    camera.lookAt(...composition.lookAt);
    camera.updateProjectionMatrix();
    canvas.dataset["sceneShot"] = shot;
  };

  const applyRemainingCameraTransition = (progress: number): void => {
    const from = sceneCameraComposition(viewportWidth, viewportHeight, "stand");
    const to = sceneCameraComposition(viewportWidth, viewportHeight, "remaining");
    const eased = clamp01(progress);
    currentShot = "remaining";
    currentCameraProgress = eased;
    camera.aspect = viewportWidth / viewportHeight;
    camera.fov = lerp(from.fov, to.fov, eased);
    camera.position.set(
      lerp(from.position[0], to.position[0], eased),
      lerp(from.position[1], to.position[1], eased),
      lerp(from.position[2], to.position[2], eased),
    );
    camera.lookAt(
      lerp(from.lookAt[0], to.lookAt[0], eased),
      lerp(from.lookAt[1], to.lookAt[1], eased),
      lerp(from.lookAt[2], to.lookAt[2], eased),
    );
    camera.updateProjectionMatrix();
    canvas.dataset["sceneShot"] = "remaining";
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

  void import("./neighborhood.js")
    .then(({ populateNeighborhood }) => {
      if (disposed) return;
      populateNeighborhood(scene, initialState.characterSeed ^ 0x4c_45_4d_4f);
      render();
    })
    .catch(() => undefined);

  void import("./stand-detail.js")
    .then(({ populateStand }) => {
      if (disposed) return;
      standDetail = populateStand(stand.root, stand.shutter);
      const remaining =
        state.phase === "forecast" ? 0 : storyboard.prepared;
      standDetail.setStock(remaining, storyboard.prepared);
      render();
    })
    .catch(() => undefined);

  void import("./crowd-motion.js")
    .then(({ initializeStreetMotion }) => {
      if (disposed) return;
      crowdMotion = initializeStreetMotion(scene, signs);
      resetAnimatedObjects();
      render();
    })
    .catch(() => undefined);

  void import("./ambient-life.js")
    .then(({ createAmbientLife }) => {
      if (disposed) return;
      ambientLife = createAmbientLife(
        scene,
        initialState.characterSeed,
        customers.map((customer) => customer.root),
      );
      ambientLife.update(state.weather, state.phase, 0, Math.max(1, state.durationMs));
      render();
    })
    .catch(() => undefined);

  void import("./weather-detail.js")
    .then(({ populateWeatherObjects }) => {
      if (disposed) return;
      weatherDetail = populateWeatherObjects(
        weatherObjects,
        renderer,
        hemisphere,
        sunlight,
      );
      weatherDetail.update(
        state.weather,
        state.phase,
        0,
        Math.max(1, state.durationMs),
        state.reducedMotion,
      );
      render();
    })
    .catch(() => undefined);

  void import("./cup-inventory.js")
    .then(({ createCupInventory, decorateLemonadeCup }) => {
      if (disposed) return;
      for (const person of [...customers, ...buyers, seller.person]) {
        decorateLemonadeCup(person.cup);
      }
      const nextInventory = createCupInventory();
      cupInventory = nextInventory;
      for (const mesh of nextInventory.meshes) scene.add(mesh);
      nextInventory.setStock(
        state.phase === "forecast" ? 0 : storyboard.prepared,
        storyboard.prepared,
      );
      render();
    })
    .catch(() => undefined);

  void import("./character-detail.js")
    .then(({ applySellerConfidenceGesture, decorateSceneCharacters }) => {
      if (disposed) return;
      applySellerGesture = applySellerConfidenceGesture;
      decorateSceneCharacters(
        customers,
        buyers,
        seller.person,
        seller.eyebrows,
        seller.mouth,
      );
      render();
    })
    .catch(() => undefined);

  const positionStaticPedestrians = (): void => {
    if (state.phase === "forecast") {
      for (const customer of customers) {
        resetPersonPose(customer);
        customer.root.visible = false;
      }
      for (const buyer of buyers) {
        resetPersonPose(buyer);
        buyer.root.visible = false;
      }
      return;
    }

    const visibleCount = Math.min(
      customers.length,
      Math.max(6, Math.min(18, storyboard.passersBy.length)),
    );
    const poses =
      crowdMotion?.crowdPosesAt(
        storyboard.passersBy,
        visibleCount,
        0,
        Math.max(1, storyboard.activeDurationMs),
      ) ?? [];
    customers.forEach((customer, index) => {
      const pose = poses[index];
      customer.root.visible = pose !== undefined;
      resetPersonPose(customer);
      if (pose === undefined) return;
      customer.root.position.set(
        pose.x,
        personGroundY(customer),
        pose.z,
      );
      customer.root.rotation.y = pose.heading;
    });
    for (const buyer of buyers) {
      resetPersonPose(buyer);
      buyer.root.visible = false;
    }
  };

  const applyPhaseStaging = (): void => {
    const forecast = state.phase === "forecast";
    stand.shutter.visible = forecast;
    seller.person.root.visible = !forecast;
    canvas.dataset["standState"] = forecast ? "closed" : "open";

    const signLimit = forecast
      ? 0
      : Math.max(0, Math.min(signs.length, Math.trunc(state.visibleSigns)));
    signs.forEach((sign, index) => {
      sign.root.visible = index < signLimit;
    });

    const remaining = forecast ? 0 : storyboard.prepared;
    cupInventory?.setStock(remaining, storyboard.prepared);
    standDetail?.setStock(remaining, storyboard.prepared);
  };

  const resetAnimatedObjects = (): void => {
    positionStaticPedestrians();
    applySellerExpression(seller, state.confidence);
    applyPhaseStaging();
    signs.forEach((sign) => {
      sign.root.rotation.z = 0;
    });
    weatherDetail?.update(
      state.weather,
      state.phase,
      0,
      Math.max(1, storyboard.durationMs),
      state.reducedMotion,
    );
    ambientLife?.update(
      state.weather,
      state.phase,
      0,
      Math.max(1, storyboard.durationMs)
    );
    applyCameraShot(state.phase === "forecast" ? "forecast" : "stand");
  };

  const animateBuyers = (elapsedMs: number): number => {
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
      const streetZ = crowdMotion?.sidewalkLaneZ(sale.lane) ?? 1.4;
      const counterX = sale.direction === -1 ? -0.72 : 0.72;
      const counterZ = 1.22;
      const drinkX = sale.direction === -1 ? -1.35 : 1.35;
      const drinkZ = 1.78;
      const approachDistance = Math.hypot(counterX - streetX, counterZ - streetZ);
      const departDistance = Math.hypot(exitX - drinkX, streetZ - drinkZ);
      let x = counterX;
      let z = counterZ;
      let travelDistance = 0;

      if (phase === "approaching") {
        const duration = Math.max(1, sale.purchaseAtMs - sale.approachAtMs);
        const progress = smoothStep((elapsedMs - sale.approachAtMs) / duration);
        x = lerp(streetX, counterX, progress);
        z = lerp(streetZ, counterZ, progress);
        travelDistance = approachDistance * progress;
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
        travelDistance = approachDistance + departDistance * progress;
      }

      buyer.root.visible = true;
      buyer.root.position.set(x, personGroundY(buyer), z);
      buyer.root.rotation.y =
        phase === "purchasing" || phase === "drinking"
          ? sale.direction === -1
            ? -0.22
            : 0.22
          : sale.direction === -1
            ? Math.PI / 2
            : -Math.PI / 2;
      applyBuyerPose(buyer, phase, travelDistance, sale.saleNumber);
      activeBuyerCount += 1;
    }
    return activeBuyerCount;
  };

  const animatePassersBy = (
    elapsedMs: number,
    activeBuyerCount: number,
  ): void => {
    if (
      state.phase !== "simulation" ||
      elapsedMs >= storyboard.activeDurationMs
    ) {
      for (const customer of customers) customer.root.visible = false;
      return;
    }

    const targetCount = Math.min(
      customers.length,
      Math.max(activeBuyerCount + 1, Math.min(18, storyboard.passersBy.length)),
    );
    const poses =
      crowdMotion?.crowdPosesAt(
        storyboard.passersBy,
        targetCount,
        elapsedMs,
        Math.max(1, storyboard.activeDurationMs),
      ) ?? [];

    customers.forEach((customer, index) => {
      const pose = poses[index];
      customer.root.visible = pose !== undefined;
      resetPersonPose(customer);
      if (pose === undefined) return;

      customer.root.position.set(
        pose.x,
        personGroundY(customer),
        pose.z,
      );
      customer.root.rotation.y = pose.heading;
      applyWalkingPose(customer, pose.travelDistance, false);
    });
  };

  const animateSeller = (seconds: number, elapsedMs: number): void => {
    seller.person.root.visible = state.phase !== "forecast";
    if (state.phase === "forecast") return;

    const closeupDuration = Math.max(
      1,
      storyboard.durationMs - storyboard.activeDurationMs,
    );
    const closeupProgress =
      state.phase === "simulation" && elapsedMs > storyboard.activeDurationMs
        ? clamp01((elapsedMs - storyboard.activeDurationMs) / closeupDuration)
        : 0;
    const easedCloseup =
      closeupProgress * closeupProgress * (3 - 2 * closeupProgress);
    const confidence =
      state.confidence +
      (state.nextConfidence - state.confidence) * easedCloseup;
    applySellerExpression(seller, confidence);

    applySellerGesture?.(
      seller.person.torso,
      seller.person.head,
      seller.person.arms[0].root,
      seller.person.arms[1].root,
      closeupProgress,
      confidence,
    );

    if (state.reducedMotion || state.phase === "idle") return;
    const breathing = Math.sin(seconds * 2.1) * 0.025;
    seller.person.torso.position.y += breathing;
    seller.person.head.position.y += breathing * 0.7;
    seller.person.arms[0].root.rotation.x += Math.sin(seconds * 1.7) * 0.035;
    seller.person.arms[1].root.rotation.x += Math.sin(seconds * 1.7 + 0.8) * 0.035;

    const serving =
      elapsedMs < storyboard.activeDurationMs &&
      storyboard.sales.some(
        (sale) => buyerPhaseAt(sale, elapsedMs) === "purchasing",
      );
    if (serving) {
      seller.person.arms[1].root.rotation.x = -1.2;
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
      state.phase === "simulation" ? sceneShotAt(storyboard, elapsedMs) : "forecast";
    if (nextShot === "remaining") {
      applyRemainingCameraTransition(remainingCameraProgressAt(storyboard, elapsedMs));
    } else if (nextShot !== currentShot) {
      applyCameraShot(nextShot);
    }

    const activeBuyerCount = animateBuyers(elapsedMs);
    animatePassersBy(elapsedMs, activeBuyerCount);
    animateSeller(seconds, elapsedMs);
    ambientLife?.update(
      state.weather,
      state.phase,
      elapsedMs,
      storyboard.durationMs
    );

    const remainingStock =
      state.phase === "forecast" ? 0 : remainingCupsAt(storyboard, elapsedMs);
    cupInventory?.setStock(remainingStock, storyboard.prepared);
    standDetail?.setStock(remainingStock, storyboard.prepared);

    signs.forEach((sign, index) => {
      if (sign.root.visible) {
        sign.root.rotation.z = Math.sin(seconds * 1.7 + index * 0.55) * 0.035;
      }
    });
    weatherDetail?.update(
      state.weather,
      state.phase,
      elapsedMs,
      storyboard.durationMs,
      state.reducedMotion,
    );

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
      state.visibleSigns !== nextState.visibleSigns ||
      state.confidence !== nextState.confidence ||
      state.nextConfidence !== nextState.nextConfidence;

    state = nextState;
    storyboard = state.storyboard;
    updateSignPrice(storyboard.priceLabel);
    applySellerExpression(seller, state.confidence);
    if (presentationChanged) {
      animationEpoch = performance.now();
      applyCameraShot(state.phase === "forecast" ? "forecast" : "stand");
    }

    weatherDetail?.update(
      state.weather,
      state.phase,
      0,
      Math.max(1, state.durationMs),
      state.reducedMotion,
    );

    applyPhaseStaging();
    ambientLife?.update(
      state.weather,
      state.phase,
      0,
      Math.max(1, state.durationMs)
    );
    if (state.reducedMotion || state.phase === "idle") resetAnimatedObjects();

    render();
    syncAnimation();
  };

  const resize = (width: number, height: number): void => {
    viewportWidth = Math.max(1, Math.floor(width));
    viewportHeight = Math.max(1, Math.floor(height));
    renderer.setSize(viewportWidth, viewportHeight, false);
    if (currentShot === "remaining" && currentCameraProgress < 1) {
      applyRemainingCameraTransition(currentCameraProgress);
    } else {
      applyCameraShot(currentShot);
    }
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
