import {
  CanvasTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
} from "three";

import { buyerMotionAt } from "./buyer-motion.js";
import { reclaimBuyerVisualPool } from "./buyer-visual-pool.js";
import {
  clampSceneCameraZoom,
  DEFAULT_SCENE_CAMERA_ZOOM,
  readSceneCameraZoomPreference,
  sceneCameraZoomFromPinch,
  sceneCameraZoomFromWheel,
  sceneCameraZoomPreferenceKey,
  writeSceneCameraZoomPreference,
} from "./camera-zoom.js";
import { type CharacterGeometrySet, createCharacterGeometrySet } from "./character-geometry.js";
import {
  buyerInteractionPose,
  type CharacterExpressionPose,
  characterExpressionAt,
  characterPoseAtDistance,
  neutralCharacterPose,
  sellerConfidencePose,
} from "./character-model.js";
import {
  applyThreeCharacterPose,
  createThreeCharacterRig,
  resetThreeCharacterPose,
  type ThreeCharacterRig,
} from "./character-rig.js";
import type { StreetMotion } from "./crowd-motion.js";
import {
  attachLemonadeCupToHand,
  type CupInventory,
  keepLemonadeCupUpright,
} from "./cup-inventory.js";
import { createGizmoController, type GizmoController } from "./gizmo-controller.js";
import {
  animationElapsedAt,
  resumedAnimationEpoch,
  stateUpdateElapsed,
} from "./presentation-clock.js";
import { type RendererDiagnostics, rendererDiagnostics } from "./renderer-diagnostics.js";
import {
  BUYER_PROFILE_INDEX_OFFSET,
  BUYER_VISUAL_POOL_SIZE,
  PASSERBY_ACTIVE_LIMIT,
  PASSERBY_BASE_ACTIVE_COUNT,
  PASSERBY_VISUAL_POOL_SIZE,
} from "./scene-capacity.js";
import { disposeSceneResources } from "./scene-disposal.js";
import { createAdvertisingSignField } from "./sign-field.js";
import { SELLER_Z, STAND_WORLD_Z } from "./stand-anchors.js";
import type { StandDetailController } from "./stand-detail.js";
import {
  type BuyerPhase,
  buyerPhaseAt,
  buyerSlotForSale,
  endingConfidenceAt,
  remainingCameraProgressAt,
  remainingCupsAt,
  type SceneShotKind,
  type StreetStoryboard,
  sceneCameraComposition,
  sceneShotAt,
  sceneViewportClass,
} from "./storyboard.js";
import { STREET_LAYOUT } from "./street-layout.js";
import { createThreeRendererBackend } from "./three-renderer-backend.js";
import { businessDayFrameAt, type WeatherDetailController } from "./weather-detail.js";
import { characterGroundClearance } from "./world-scale.js";

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

export type LemonsvilleSceneOptions = Readonly<{
  enableGizmo?: boolean;
}>;

export interface LemonsvilleSceneController {
  update: (state: LemonsvilleSceneState) => void;
  resize: (width: number, height: number) => void;
  diagnostics: () => RendererDiagnostics;
  dispose: () => void;
  scene?: Scene; // Three.js Scene for dev tools
  camera?: PerspectiveCamera; // Three.js Camera for dev tools
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const lerp = (start: number, end: number, progress: number): number =>
  start + (end - start) * progress;

const makeMaterial = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.92 });

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

type PersonRig = ThreeCharacterRig &
  Readonly<{
    cup: Group;
  }>;

type SellerRig = Readonly<{
  person: PersonRig;
  eyebrows: readonly [Group, Group];
  mouth: readonly [Group, Group];
}>;

type CharacterExpressionApplier = (
  root: Object3D,
  expression: CharacterExpressionPose,
) => void;

let applyCharacterFaceExpression: CharacterExpressionApplier | null = null;
const neutralExpression = neutralCharacterPose().expression;

const personExpressionSeed = (person: PersonRig): number => {
  const profileIndex: unknown = person.root.userData["characterProfileIndex"];
  return typeof profileIndex === "number" && Number.isFinite(profileIndex)
    ? Math.trunc(profileIndex)
    : 0;
};

const applyPersonExpression = (
  person: PersonRig,
  expression: CharacterExpressionPose,
  elapsedMs: number,
  identitySeed = personExpressionSeed(person),
): void => {
  applyCharacterFaceExpression?.(
    person.head,
    characterExpressionAt(expression, identitySeed, elapsedMs),
  );
};

const personGroundY = (person: PersonRig): number =>
  characterGroundClearance(person.profile.heightScale);

const createPerson = (
  geometries: ReturnType<typeof createCharacterGeometrySet>,
  characterSeed: number,
  index: number,
): PersonRig => {
  const rig = createThreeCharacterRig(geometries, characterSeed, index);
  const cup = new Group();
  attachLemonadeCupToHand(rig.arms[1].extremity, cup);
  cup.visible = false;
  return Object.freeze({ ...rig, cup });
};

const createSeller = (geometries: CharacterGeometrySet, characterSeed: number): SellerRig => {
  const person = createPerson(geometries, characterSeed ^ 0x51_1e_12, 10_001);
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

const applySellerExpression = (
  seller: SellerRig,
  confidence: number,
  elapsedMs = 0,
): void => {
  const pose = sellerConfidencePose(confidence);
  applyThreeCharacterPose(seller.person, pose);
  seller.person.cup.visible = false;
  seller.person.headPivot.position.y -= 0.05;
  applyPersonExpression(seller.person, pose.expression, elapsedMs);
};

const resetPersonPose = (person: PersonRig): void => {
  resetThreeCharacterPose(person);
  person.cup.visible = false;
  applyPersonExpression(person, neutralExpression, 0);
};

const applyWalkingPose = (
  person: PersonRig,
  travelDistance: number,
  carryingCup: boolean,
  elapsedMs = 0,
  identitySeed = personExpressionSeed(person),
): void => {
  const pose = characterPoseAtDistance(person.profile, travelDistance, {
    carryingCup,
  });
  applyThreeCharacterPose(person, pose);
  person.cup.visible = pose.rightHandOccupancy === "cup";
  applyPersonExpression(person, pose.expression, elapsedMs, identitySeed);
};

const applyBuyerPose = (
  person: PersonRig,
  phase: BuyerPhase,
  travelDistance: number,
  index: number,
  elapsedMs: number,
): void => {
  resetPersonPose(person);
  if (phase === "approaching") {
    applyWalkingPose(person, travelDistance, false, elapsedMs, index);
  } else if (phase === "purchasing" || phase === "drinking") {
    const pose = buyerInteractionPose(phase, index);
    applyThreeCharacterPose(person, pose);
    person.cup.visible = pose.rightHandOccupancy === "cup";
    applyPersonExpression(person, pose.expression, elapsedMs, index);
  } else if (phase === "departing") {
    applyWalkingPose(person, travelDistance, true, elapsedMs, index);
  }

  if (person.cup.visible) {
    keepLemonadeCupUpright(person.cup);
  }
};

export const createLemonsvilleScene = (
  canvas: HTMLCanvasElement,
  initialState: LemonsvilleSceneState,
  options: LemonsvilleSceneOptions = {},
): LemonsvilleSceneController | null => {
  const rendererBackend = createThreeRendererBackend(canvas, window.devicePixelRatio);
  if (rendererBackend === null) {
    return null;
  }
  const { renderer } = rendererBackend;

  const scene = new Scene();
  const characterGeometries = createCharacterGeometrySet();
  const camera = new PerspectiveCamera(34, 1, 0.1, 180);
  camera.position.set(0, 6.8, 13.5);
  camera.lookAt(0, 1.7, 0);

  const gizmoController: GizmoController | null =
    options.enableGizmo === true
      ? createGizmoController({
          camera,
          scene,
          container: canvas.parentElement ?? canvas,
        })
      : null;

  const hemisphere = new HemisphereLight(0xff_f2_c6, 0x52_6b_51, 1.9);
  scene.add(hemisphere);
  const sunlight = new DirectionalLight(0xff_f0_c9, 1.8);
  sunlight.position.set(-5, 10, 7);
  scene.add(sunlight);

  const ground = new Mesh(new PlaneGeometry(160, 150), makeMaterial(0x92_ad_68));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -32;
  scene.add(ground);

  const stand = createStand();
  stand.root.position.z = STAND_WORLD_Z;
  scene.add(stand.root);

  const signField = createAdvertisingSignField(40);
  const signs = signField.signs;
  for (const mesh of signField.meshes) {
    scene.add(mesh);
  }
  let signTexture: CanvasTexture | null = null;
  let signPriceLabel = "";
  let disposed = false;
  let signTextureGeneration = 0;
  let signLabelModule: Promise<
    Readonly<{ createPriceSignSurface: (priceLabel: string) => HTMLCanvasElement }>
  > | null = null;

  const customers = Array.from({ length: PASSERBY_VISUAL_POOL_SIZE }, (_, index) =>
    createPerson(characterGeometries, initialState.characterSeed, index),
  );
  for (const customer of customers) {
    scene.add(customer.root);
  }

  const buyers = Array.from({ length: BUYER_VISUAL_POOL_SIZE }, (_, index) =>
    createPerson(
      characterGeometries,
      initialState.characterSeed,
      index + BUYER_PROFILE_INDEX_OFFSET,
    ),
  );
  const buyerFadeState = new Map<PersonRig, { opacity: number; targetOpacity: number }>();
  for (const buyer of buyers) {
    buyer.root.visible = false;
    buyerFadeState.set(buyer, { opacity: 0, targetOpacity: 0 });
    scene.add(buyer.root);
  }

  const updateBuyerOpacity = (buyer: PersonRig): void => {
    const fade = buyerFadeState.get(buyer);
    if (!fade) {
      return;
    }

    buyer.root.traverse((node) => {
      if (node instanceof Mesh && node.material instanceof MeshStandardMaterial) {
        node.material.opacity = fade.targetOpacity;
        node.material.transparent = false;
      }
    });
  };

  const seller = createSeller(characterGeometries, initialState.characterSeed);
  seller.person.root.position.set(0, personGroundY(seller.person), STAND_WORLD_Z + SELLER_Z);
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
  for (const weatherObject of Object.values(weatherObjects)) {
    scene.add(weatherObject);
  }

  let state = initialState;
  let crowdMotion: StreetMotion | null = null;
  let weatherDetail: WeatherDetailController | null = null;
  let ambientLife: Readonly<{
    update: (
      weather: SceneWeather,
      phase: ScenePhase,
      elapsedMs: number,
      durationMs: number,
    ) => void;
  }> | null = null;
  let animationFrame: number | null = null;
  let animationEpoch = performance.now();
  let lastElapsedMs = 0;
  let storyboard = state.storyboard;

  let viewportWidth = 1;
  let viewportHeight = 1;
  let currentShot: SceneShotKind = state.phase === "forecast" ? "forecast" : "stand";
  let currentCameraProgress = 0;
  let zoomStorage: Storage | null = null;
  try {
    zoomStorage = window.localStorage;
  } catch {
    zoomStorage = null;
  }
  let activeCameraZoomPreferenceKey = "";
  let userCameraZoom = DEFAULT_SCENE_CAMERA_ZOOM;

  const syncSceneCameraZoom = (): void => {
    const viewportClass = sceneViewportClass(viewportWidth, viewportHeight);
    const nextPreferenceKey = sceneCameraZoomPreferenceKey(state.phase, viewportClass);
    if (nextPreferenceKey !== activeCameraZoomPreferenceKey) {
      activeCameraZoomPreferenceKey = nextPreferenceKey;
      userCameraZoom = readSceneCameraZoomPreference(zoomStorage, activeCameraZoomPreferenceKey);
    }
    camera.zoom = userCameraZoom;
    canvas.setAttribute("data-scene-zoom", userCameraZoom.toFixed(3));
    canvas.setAttribute("data-scene-zoom-viewport", viewportClass);
  };

  const persistSceneCameraZoom = (): void => {
    if (activeCameraZoomPreferenceKey === "") {
      return;
    }
    writeSceneCameraZoomPreference(zoomStorage, activeCameraZoomPreferenceKey, userCameraZoom);
  };

  const applyCameraShot = (shot: SceneShotKind): void => {
    currentShot = shot;
    currentCameraProgress = shot === "remaining" ? 1 : 0;
    const composition = sceneCameraComposition(viewportWidth, viewportHeight, shot);
    camera.aspect = viewportWidth / viewportHeight;
    camera.fov = composition.fov;
    camera.position.set(...composition.position);
    camera.lookAt(...composition.lookAt);
    syncSceneCameraZoom();
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
    syncSceneCameraZoom();
    camera.updateProjectionMatrix();
    canvas.dataset["sceneShot"] = "remaining";
  };

  const updateSignPrice = (priceLabel: string): void => {
    if (priceLabel === signPriceLabel) {
      return;
    }
    signPriceLabel = priceLabel;
    canvas.dataset["signPriceLabel"] = priceLabel;
    signLabelModule ??= import("./sign-label.js");
    const generation = ++signTextureGeneration;
    void signLabelModule.then(({ createPriceSignSurface }) => {
      if (disposed || generation !== signTextureGeneration || priceLabel !== signPriceLabel) {
        return;
      }
      const nextTexture = new CanvasTexture(createPriceSignSurface(priceLabel));
      const previousTexture = signTexture;
      nextTexture.colorSpace = SRGBColorSpace;
      nextTexture.minFilter = LinearFilter;
      nextTexture.magFilter = LinearFilter;
      signTexture = nextTexture;
      signField.labelMaterial.map = nextTexture;
      signField.labelMaterial.needsUpdate = true;
      previousTexture?.dispose();
      render();
    });
  };

  const render = (): void => {
    renderer.render(scene, camera);
  };

  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = "none";

  const setSceneCameraZoom = (nextZoom: number): void => {
    syncSceneCameraZoom();
    const clampedZoom = clampSceneCameraZoom(nextZoom);
    if (Math.abs(clampedZoom - userCameraZoom) < 0.0001) {
      return;
    }
    userCameraZoom = clampedZoom;
    camera.zoom = userCameraZoom;
    canvas.setAttribute("data-scene-zoom", userCameraZoom.toFixed(3));
    camera.updateProjectionMatrix();
    render();
  };

  const onSceneWheel = (event: WheelEvent): void => {
    event.preventDefault();
    setSceneCameraZoom(
      sceneCameraZoomFromWheel(userCameraZoom, event.deltaY, event.deltaMode, viewportHeight),
    );
    persistSceneCameraZoom();
  };

  type TouchPointer = Readonly<{ x: number; y: number }>;
  const touchPointers = new Map<number, TouchPointer>();
  let pinchStartDistance = 0;
  let pinchStartZoom = DEFAULT_SCENE_CAMERA_ZOOM;

  const currentPinchDistance = (): number => {
    const [first, second] = [...touchPointers.values()];
    if (first === undefined || second === undefined) {
      return 0;
    }
    return Math.hypot(second.x - first.x, second.y - first.y);
  };

  const beginPinch = (): void => {
    if (touchPointers.size < 2) {
      return;
    }
    syncSceneCameraZoom();
    pinchStartDistance = currentPinchDistance();
    pinchStartZoom = userCameraZoom;
  };

  const onScenePointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") {
      return;
    }
    touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touchPointers.size === 2) {
      event.preventDefault();
      beginPinch();
    }
  };

  const onScenePointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== "touch" || !touchPointers.has(event.pointerId)) {
      return;
    }
    touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touchPointers.size < 2 || pinchStartDistance <= 0) {
      return;
    }
    event.preventDefault();
    setSceneCameraZoom(
      sceneCameraZoomFromPinch(pinchStartZoom, pinchStartDistance, currentPinchDistance()),
    );
  };

  const onScenePointerEnd = (event: PointerEvent): void => {
    if (event.pointerType !== "touch") {
      return;
    }
    const wasPinching = touchPointers.size >= 2;
    touchPointers.delete(event.pointerId);
    if (wasPinching) {
      persistSceneCameraZoom();
    }
    if (touchPointers.size >= 2) {
      beginPinch();
    } else {
      pinchStartDistance = 0;
    }
  };

  canvas.addEventListener("wheel", onSceneWheel, { passive: false });
  canvas.addEventListener("pointerdown", onScenePointerDown);
  canvas.addEventListener("pointermove", onScenePointerMove);
  canvas.addEventListener("pointerup", onScenePointerEnd);
  canvas.addEventListener("pointercancel", onScenePointerEnd);

  void import("./neighborhood.js")
    .then(({ populateNeighborhood }) => {
      if (disposed) {
        return;
      }
      populateNeighborhood(scene, initialState.characterSeed ^ 0x4c_45_4d_4f);
      render();
    })
    .catch(() => undefined);

  void import("./stand-detail.js")
    .then(({ populateStand }) => {
      if (disposed) {
        return;
      }
      standDetail = populateStand(stand.root, stand.shutter);
      const remaining =
        state.phase === "forecast"
          ? 0
          : state.phase === "idle"
            ? remainingCupsAt(storyboard, storyboard.durationMs)
            : remainingCupsAt(storyboard, lastElapsedMs);
      standDetail.setStock(remaining, storyboard.prepared);
      render();
    })
    .catch(() => undefined);

  void import("./crowd-motion.js")
    .then(({ initializeStreetMotion }) => {
      if (disposed) {
        return;
      }
      crowdMotion = initializeStreetMotion(scene, signs);
      resetAnimatedObjects();
      render();
    })
    .catch(() => undefined);

  void import("./ambient-life.js")
    .then(({ createAmbientLife }) => {
      if (disposed) {
        return;
      }
      ambientLife = createAmbientLife(
        scene,
        initialState.characterSeed,
        customers.map((customer) => customer.root),
      );
      ambientLife.update(state.weather, state.phase, lastElapsedMs, Math.max(1, state.durationMs));
      render();
    })
    .catch(() => undefined);

  void import("./weather-detail.js")
    .then(({ populateWeatherObjects }) => {
      if (disposed) {
        return;
      }
      weatherDetail = populateWeatherObjects(weatherObjects, renderer, hemisphere, sunlight);
      weatherDetail.update(
        state.weather,
        state.phase,
        lastElapsedMs,
        Math.max(1, state.durationMs),
        state.reducedMotion,
      );
      render();
    })
    .catch(() => undefined);

  void import("./cup-inventory.js")
    .then(({ createCupInventory, decorateLemonadeCup }) => {
      if (disposed) {
        return;
      }
      for (const person of [...customers, ...buyers, seller.person]) {
        decorateLemonadeCup(person.cup);
      }
      const nextInventory = createCupInventory();
      cupInventory = nextInventory;
      for (const mesh of nextInventory.meshes) {
        mesh.position.z = STAND_WORLD_Z;
        scene.add(mesh);
      }
      nextInventory.setStock(
        state.phase === "forecast"
          ? 0
          : state.phase === "idle"
            ? remainingCupsAt(storyboard, storyboard.durationMs)
            : remainingCupsAt(storyboard, lastElapsedMs),
        storyboard.prepared,
      );
      render();
    })
    .catch(() => undefined);

  void import("./character-detail.js")
    .then(({ applyCharacterExpressionPose, decorateSceneCharacters }) => {
      if (disposed) {
        return;
      }
      applyCharacterFaceExpression = applyCharacterExpressionPose;
      decorateSceneCharacters(customers, buyers, seller.person, seller.eyebrows, seller.mouth);
      applySellerExpression(seller, state.confidence, lastElapsedMs);
      render();
    })
    .catch(() => undefined);

  const positionStaticPedestrians = (): void => {
    reclaimBuyerVisualPool(buyers);
    if (state.phase === "forecast") {
      for (const customer of customers) {
        resetPersonPose(customer);
        customer.root.visible = false;
      }
      for (const buyer of buyers) {
        resetPersonPose(buyer);
        const fade = buyerFadeState.get(buyer);
        if (fade) {
          fade.targetOpacity = 0;
        }
      }
      return;
    }

    const visibleCount = Math.min(
      customers.length,
      PASSERBY_ACTIVE_LIMIT,
      Math.max(PASSERBY_BASE_ACTIVE_COUNT, storyboard.passersBy.length),
    );
    const poses =
      crowdMotion?.crowdPosesAt(
        storyboard.passersBy,
        visibleCount,
        0,
        Math.max(1, storyboard.durationMs),
      ) ?? [];
    customers.forEach((customer, index) => {
      const pose = poses[index];
      customer.root.visible = pose !== undefined;
      resetPersonPose(customer);
      if (pose === undefined) {
        return;
      }
      customer.root.position.set(pose.x, personGroundY(customer), pose.z);
      customer.root.rotation.y = pose.heading;
    });
    for (const buyer of buyers) {
      resetPersonPose(buyer);
      const fade = buyerFadeState.get(buyer);
      if (fade) {
        fade.targetOpacity = 0;
      }
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
    signField.sync();

    const remaining = forecast
      ? 0
      : state.phase === "idle"
        ? remainingCupsAt(storyboard, storyboard.durationMs)
        : remainingCupsAt(storyboard, lastElapsedMs);
    cupInventory?.setStock(remaining, storyboard.prepared);
    standDetail?.setStock(remaining, storyboard.prepared);
  };

  const resetAnimatedObjects = (): void => {
    positionStaticPedestrians();
    applySellerExpression(seller, state.confidence, 0);
    applyPhaseStaging();
    signs.forEach((sign) => {
      sign.root.rotation.z = 0;
    });
    signField.sync();
    weatherDetail?.update(
      state.weather,
      state.phase,
      0,
      Math.max(1, storyboard.durationMs),
      state.reducedMotion,
    );
    ambientLife?.update(state.weather, state.phase, 0, Math.max(1, storyboard.durationMs));
    applyCameraShot(state.phase === "forecast" ? "forecast" : "stand");
  };

  const animateBuyers = (elapsedMs: number): number => {
    const activeBuyerPositions: { x: number; z: number }[] = [];

    reclaimBuyerVisualPool(buyers);
    for (const buyer of buyers) {
      const fade = buyerFadeState.get(buyer);
      if (fade) {
        fade.targetOpacity = 0;
      }
      resetPersonPose(buyer);
      updateBuyerOpacity(buyer);
    }
    if (state.phase !== "simulation") {
      return 0;
    }

    let activeBuyerCount = 0;
    for (const sale of storyboard.sales) {
      const streetZ = crowdMotion?.sidewalkLaneZ(sale.lane) ?? STREET_LAYOUT.nearSidewalk.centerZ;
      const motion = buyerMotionAt(sale, elapsedMs, streetZ);
      if (motion === undefined) {
        continue;
      }

      const buyer = buyers[buyerSlotForSale(sale, buyers.length)];
      if (buyer === undefined) {
        continue;
      }

      const fade = buyerFadeState.get(buyer);
      if (fade) {
        fade.targetOpacity = 1;
        updateBuyerOpacity(buyer);
      }
      buyer.root.visible = true;
      let finalPos = { x: motion.x, z: motion.z };

      const pedestrianRadius = 0.4;
      for (const otherPos of activeBuyerPositions) {
        const dist = Math.hypot(finalPos.x - otherPos.x, finalPos.z - otherPos.z);
        if (dist >= pedestrianRadius * 2) {
          continue;
        }

        const angle = Math.atan2(finalPos.z - otherPos.z, finalPos.x - otherPos.x);
        const minDist = pedestrianRadius * 2.1;
        const targetX = otherPos.x + Math.cos(angle) * minDist;
        const targetZ = otherPos.z + Math.sin(angle) * minDist;
        const maxAdjust = 0.05;
        finalPos = {
          x:
            Math.sign(targetX - finalPos.x) * Math.min(maxAdjust, Math.abs(targetX - finalPos.x)) +
            finalPos.x,
          z:
            Math.sign(targetZ - finalPos.z) * Math.min(maxAdjust, Math.abs(targetZ - finalPos.z)) +
            finalPos.z,
        };
      }

      activeBuyerPositions.push(finalPos);
      buyer.root.position.set(finalPos.x, personGroundY(buyer), finalPos.z);
      buyer.root.rotation.y = motion.heading;
      applyBuyerPose(
        buyer,
        motion.phase,
        motion.travelDistance,
        sale.saleNumber,
        elapsedMs,
      );
      activeBuyerCount += 1;
    }
    return activeBuyerCount;
  };

  const animatePassersBy = (elapsedMs: number): void => {
    if (state.phase !== "simulation") {
      for (const customer of customers) {
        customer.root.visible = false;
      }
      return;
    }

    const targetCount = Math.min(
      customers.length,
      PASSERBY_ACTIVE_LIMIT,
      Math.max(PASSERBY_BASE_ACTIVE_COUNT, storyboard.passersBy.length),
    );
    const poses =
      crowdMotion?.crowdPosesAt(
        storyboard.passersBy,
        targetCount,
        elapsedMs,
        Math.max(1, storyboard.durationMs),
      ) ?? [];

    customers.forEach((customer, index) => {
      const pose = poses[index];
      customer.root.visible = pose !== undefined;
      resetPersonPose(customer);
      if (pose === undefined) {
        return;
      }

      customer.root.position.set(pose.x, personGroundY(customer), pose.z);
      customer.root.rotation.y = pose.heading;
      applyWalkingPose(customer, pose.travelDistance, false, elapsedMs, index);
    });
  };

  const sellerConfidenceAt = (elapsedMs: number): number => {
    if (state.phase !== "simulation" || elapsedMs <= storyboard.activeDurationMs) {
      return state.confidence;
    }
    return endingConfidenceAt(storyboard, elapsedMs, state.confidence, state.nextConfidence);
  };

  const animateSeller = (seconds: number, elapsedMs: number): void => {
    seller.person.root.visible = state.phase !== "forecast";
    if (state.phase === "forecast") {
      return;
    }
    applySellerExpression(seller, sellerConfidenceAt(elapsedMs), elapsedMs);
    if (state.reducedMotion || state.phase === "idle") {
      return;
    }
    const breathing = Math.sin(seconds * 2.1) * 0.025;
    seller.person.chest.position.y += breathing;
    seller.person.headPivot.position.y -= breathing * 0.3;
    seller.person.arms[0].root.rotation.x += Math.sin(seconds * 1.7) * 0.035;
    seller.person.arms[1].root.rotation.x += Math.sin(seconds * 1.7 + 0.8) * 0.035;

    const serving = storyboard.sales.some((sale) => buyerPhaseAt(sale, elapsedMs) === "purchasing");
    if (serving) {
      seller.person.arms[1].root.rotation.x = -1.2;
      seller.person.chest.rotation.x -= 0.06;
    }
  };

  const animate = (timestamp: number): void => {
    animationFrame = null;
    if (state.phase === "idle" || state.reducedMotion) {
      resetAnimatedObjects();
      render();
      return;
    }

    const elapsedMs = animationElapsedAt(timestamp, animationEpoch, storyboard.durationMs);
    lastElapsedMs = elapsedMs;
    const seconds = elapsedMs / 1000;
    const nextShot = state.phase === "simulation" ? sceneShotAt(storyboard, elapsedMs) : "forecast";
    if (nextShot === "remaining") {
      applyRemainingCameraTransition(remainingCameraProgressAt(storyboard, elapsedMs));
    } else if (nextShot !== currentShot) {
      applyCameraShot(nextShot);
    }

    animateBuyers(elapsedMs);
    animatePassersBy(elapsedMs);
    animateSeller(seconds, elapsedMs);
    ambientLife?.update(state.weather, state.phase, elapsedMs, storyboard.durationMs);

    const remainingStock = state.phase === "forecast" ? 0 : remainingCupsAt(storyboard, elapsedMs);
    cupInventory?.setStock(remainingStock, storyboard.prepared);
    standDetail?.setStock(remainingStock, storyboard.prepared);

    signs.forEach((sign, index) => {
      if (sign.root.visible) {
        sign.root.rotation.z = Math.sin(seconds * 1.7 + index * 0.55) * 0.035;
      }
    });
    signField.sync();
    weatherDetail?.update(
      state.weather,
      state.phase,
      elapsedMs,
      storyboard.durationMs,
      state.reducedMotion,
    );

    const dayFrame = businessDayFrameAt(
      state.weather,
      state.phase,
      elapsedMs,
      storyboard.durationMs,
    );
    sunlight.position.set(...dayFrame.sunPosition);

    render();
    animationFrame = window.requestAnimationFrame(animate);
  };

  const syncAnimation = (): void => {
    const shouldAnimate = state.phase !== "idle" && !state.reducedMotion;
    if (shouldAnimate && animationFrame === null) {
      animationEpoch = resumedAnimationEpoch(performance.now(), lastElapsedMs);
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
    applySellerExpression(
      seller,
      state.confidence,
      presentationChanged ? 0 : lastElapsedMs,
    );
    if (presentationChanged) {
      animationEpoch = performance.now();
      lastElapsedMs = 0;
      applyCameraShot(state.phase === "forecast" ? "forecast" : "stand");
    }

    const updateElapsedMs = stateUpdateElapsed(
      presentationChanged,
      lastElapsedMs,
      Math.max(1, state.durationMs),
    );
    const dayFrame = businessDayFrameAt(
      state.weather,
      state.phase,
      updateElapsedMs,
      Math.max(1, state.durationMs),
    );
    sunlight.position.set(...dayFrame.sunPosition);

    weatherDetail?.update(
      state.weather,
      state.phase,
      updateElapsedMs,
      Math.max(1, state.durationMs),
      state.reducedMotion,
    );

    applyPhaseStaging();
    ambientLife?.update(state.weather, state.phase, updateElapsedMs, Math.max(1, state.durationMs));
    if (state.reducedMotion || state.phase === "idle") {
      resetAnimatedObjects();
    }

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
    if (disposed) {
      return;
    }
    disposed = true;
    signTextureGeneration += 1;
    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
    }
    animationFrame = null;
    persistSceneCameraZoom();
    canvas.removeEventListener("wheel", onSceneWheel);
    canvas.removeEventListener("pointerdown", onScenePointerDown);
    canvas.removeEventListener("pointermove", onScenePointerMove);
    canvas.removeEventListener("pointerup", onScenePointerEnd);
    canvas.removeEventListener("pointercancel", onScenePointerEnd);
    canvas.style.touchAction = previousTouchAction;
    touchPointers.clear();
    signTexture?.dispose();
    gizmoController?.dispose();
    disposeSceneResources(scene);
    rendererBackend.dispose();
  };

  const diagnostics = (): RendererDiagnostics => rendererDiagnostics(renderer.info);

  update(initialState);
  return Object.freeze({ update, resize, diagnostics, dispose, scene, camera });
};

export { createGizmoController, type GizmoController } from "./gizmo-controller.js";
export { type RendererDiagnostics, rendererDiagnostics } from "./renderer-diagnostics.js";
export {
  createThreeRendererBackend,
  rendererPixelRatio,
  type ThreeRendererBackend,
  type ThreeRendererBackendKind,
} from "./three-renderer-backend.js";
