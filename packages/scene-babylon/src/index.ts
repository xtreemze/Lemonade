import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";

import { STAND_WORLD_Z } from "@lemonade/scene-contracts/stand-anchors";
import {
  sceneCameraComposition,
  sceneShotAt,
  type SceneShotKind,
} from "@lemonade/scene-contracts/storyboard";

import type {
  LemonsvilleSceneController,
  LemonsvilleSceneState,
  RendererDiagnostics,
  SceneWeather,
} from "@lemonade/scene-contracts/scene-state";

export type {
  LemonsvilleSceneController,
  LemonsvilleSceneState,
  RendererDiagnostics,
  SceneWeather,
} from "@lemonade/scene-contracts/scene-state";

const clampPixelRatio = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.min(value, 2) : 1;

const clearColorForWeather = (weather: SceneWeather): Color4 => {
  switch (weather) {
    case "sunny":
      return new Color4(0.56, 0.68, 0.78, 1);
    case "cloudy":
      return new Color4(0.48, 0.56, 0.62, 1);
    case "hot-and-dry":
      return new Color4(0.72, 0.66, 0.52, 1);
    case "thunderstorm":
      return new Color4(0.25, 0.31, 0.37, 1);
  }
};

export const createBabylonLemonsvilleScene = (
  canvas: HTMLCanvasElement,
  initialState: LemonsvilleSceneState,
): LemonsvilleSceneController | null => {
  let engine: Engine;
  try {
    engine = new Engine(
      canvas,
      true,
      {
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
        stencil: true,
      },
      true,
    );
  } catch {
    return null;
  }

  engine.setHardwareScalingLevel(
    1 / clampPixelRatio(globalThis.devicePixelRatio),
  );

  const scene = new Scene(engine);
  scene.clearColor = clearColorForWeather(initialState.weather);

  const camera = new FreeCamera(
    "lemonsville-camera",
    new Vector3(0, 6.8, 13.5),
    scene,
  );
  scene.activeCamera = camera;

  const hemisphere = new HemisphericLight(
    "ambient",
    new Vector3(0, 1, 0),
    scene,
  );
  hemisphere.intensity = 1.25;

  const sunlight = new DirectionalLight(
    "sun",
    new Vector3(-0.45, -1, -0.35),
    scene,
  );
  sunlight.intensity = 1.65;

  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: 160, height: 150, subdivisions: 1 },
    scene,
  );
  ground.position.z = -32;
  const groundMaterial = new StandardMaterial("ground-material", scene);
  groundMaterial.diffuseColor = new Color3(0.57, 0.68, 0.41);
  groundMaterial.specularColor = Color3.Black();
  ground.material = groundMaterial;

  const stand = MeshBuilder.CreateBox(
    "stand-migration-shell",
    { width: 3, height: 1.6, depth: 1.25 },
    scene,
  );
  stand.position.set(0, 0.8, STAND_WORLD_Z);
  const standMaterial = new StandardMaterial("stand-material", scene);
  standMaterial.diffuseColor = new Color3(0.93, 0.73, 0.2);
  standMaterial.specularColor = Color3.Black();
  stand.material = standMaterial;

  const seller = MeshBuilder.CreateSphere(
    "seller-migration-shell",
    { diameter: 0.65, segments: 10 },
    scene,
  );
  seller.position.set(0, 1.65, STAND_WORLD_Z + 0.55);
  const sellerMaterial = new StandardMaterial("seller-material", scene);
  sellerMaterial.diffuseColor = new Color3(0.58, 0.37, 0.24);
  sellerMaterial.specularColor = Color3.Black();
  seller.material = sellerMaterial;

  canvas.dataset["rendererBackend"] = "babylon";

  let state = initialState;
  let disposed = false;
  let frame = 0;
  let animationEpoch = performance.now();
  let viewportWidth = Math.max(1, canvas.clientWidth);
  let viewportHeight = Math.max(1, canvas.clientHeight);
  let currentShot: SceneShotKind =
    state.phase === "forecast" ? "forecast" : "stand";

  const applyCameraShot = (shot: SceneShotKind): void => {
    currentShot = shot;
    const composition = sceneCameraComposition(
      viewportWidth,
      viewportHeight,
      shot,
    );
    camera.position.set(...composition.position);
    camera.setTarget(new Vector3(...composition.lookAt));
    camera.fov = (composition.fov * Math.PI) / 180;
  };

  const applyState = (nextState: LemonsvilleSceneState): void => {
    state = nextState;
    scene.clearColor = clearColorForWeather(state.weather);
    stand.visibility = state.phase === "forecast" ? 0.58 : 1;
    seller.setEnabled(state.phase !== "forecast");
    applyCameraShot(state.phase === "forecast" ? "forecast" : "stand");
  };

  const renderFrame = (): void => {
    if (disposed || state.phase === "idle") return;
    if (state.phase === "simulation" && !state.reducedMotion) {
      const elapsedMs = Math.min(
        state.storyboard.durationMs,
        Math.max(0, performance.now() - animationEpoch),
      );
      const nextShot = sceneShotAt(state.storyboard, elapsedMs);
      if (nextShot !== currentShot) applyCameraShot(nextShot);
    }
    frame += 1;
    scene.render();
  };

  applyState(initialState);
  engine.runRenderLoop(renderFrame);

  return Object.freeze({
    update(nextState: LemonsvilleSceneState): void {
      if (disposed) return;
      const restartAnimation =
        state.phase !== nextState.phase ||
        state.durationMs !== nextState.durationMs ||
        state.storyboard !== nextState.storyboard;
      if (restartAnimation) animationEpoch = performance.now();
      applyState(nextState);
      renderFrame();
    },
    resize(width: number, height: number): void {
      if (disposed) return;
      viewportWidth = Math.max(1, Math.floor(width));
      viewportHeight = Math.max(1, Math.floor(height));
      engine.setSize(viewportWidth, viewportHeight);
      applyCameraShot(currentShot);
      renderFrame();
    },
    diagnostics(): RendererDiagnostics {
      const visibleMeshes = scene.meshes.filter(
        (mesh) => mesh.isEnabled() && mesh.isVisible,
      ).length;
      return Object.freeze({
        frame,
        drawCalls: visibleMeshes,
        triangles: Math.trunc(scene.getActiveIndices() / 3),
        lines: 0,
        points: 0,
        geometries: scene.meshes.length,
        textures: scene.textures.length,
      });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      engine.stopRenderLoop(renderFrame);
      scene.dispose();
      engine.dispose();
      delete canvas.dataset["rendererBackend"];
    },
  });
};
