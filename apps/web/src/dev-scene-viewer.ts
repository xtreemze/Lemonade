/**
 * Dev Tool: Persistent 3D Scene Viewer
 *
 * Launches a dedicated 3D scene view that persists without game UI interference.
 * Perfect for using the gizmo tool to manipulate objects interactively.
 *
 * Enable with: `localStorage.setItem('LEMONADE_DEV_SCENE_VIEWER', '1')`
 */

import type { LemonsvilleSceneState, ScenePhase, SceneWeather } from "@lemonade/scene";
import { createLemonsvilleScene } from "@lemonade/scene";
import { createStreetStoryboard } from "@lemonade/scene/storyboard-create";
// TODO: Integrate gizmo controller for 3D editor tool (game-engine-like scene manipulation)
// import { createGizmoController } from "@lemonade/scene";
import {
  disableRendererStressFixture,
  disableSceneViewer,
  enableRendererStressFixture,
  enableSceneViewer,
  isRendererStressFixtureEnabled,
  isSceneViewerEnabled,
} from "./dev-scene-viewer-flag.js";

export {
  disableRendererStressFixture,
  disableSceneViewer,
  enableRendererStressFixture,
  enableSceneViewer,
  isRendererStressFixtureEnabled,
  isSceneViewerEnabled,
};

export interface SceneViewerOptions {
  enableGizmo?: boolean;
  weather?: SceneWeather;
  phase?: ScenePhase;
  stress?: boolean;
}

export const createPersistentSceneViewer = (
  appRoot: HTMLElement,
  options: SceneViewerOptions = {},
): { scene: ReturnType<typeof createLemonsvilleScene>; dispose: () => void } | null => {
  // Clear app UI
  appRoot.innerHTML = "";

  // Create main container with flexbox (scene on left, sidebar on right)
  const container = document.createElement("div");
  container.dataset.rendererStressFixture = options.stress === true ? "true" : "false";
  container.style.cssText = `
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: row;
    background: #000;
  `;

  // Create canvas container (takes up most space)
  const canvasContainer = document.createElement("div");
  canvasContainer.style.cssText = `
    flex: 1;
    display: flex;
    background: #000;
    position: relative;
  `;

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.style.cssText = `
    flex: 1;
    display: block;
    background: #000;
  `;
  canvasContainer.appendChild(canvas);

  // Create sidebar
  const sidebar = document.createElement("div");
  sidebar.style.cssText = `
    width: 320px;
    background: rgba(0, 0, 0, 0.95);
    border-left: 2px solid #ffff00;
    overflow-y: auto;
    padding: 16px;
    font-family: monospace;
    font-size: 12px;
    color: #fff;
    z-index: 2000;
  `;

  // Create control panel inside sidebar
  const panel = document.createElement("div");
  panel.style.cssText = `
    background: transparent;
    border: none;
    padding: 0;
    margin-bottom: 24px;
  `;

  const title = document.createElement("div");
  title.style.cssText = "font-weight: bold; margin-bottom: 12px; color: #ffff00; font-size: 14px;";
  const stress = options.stress === true;
  const phase: ScenePhase = stress ? "simulation" : (options.phase ?? "simulation");

  title.textContent = stress ? "🎥 Renderer Stress Fixture" : "🎥 Scene Viewer";
  panel.appendChild(title);

  const info = document.createElement("div");
  info.style.cssText = `
    background: #1a1a1a;
    border: 1px solid #666;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 16px;
    font-size: 11px;
    color: #0f0;
    line-height: 1.5;
  `;
  info.innerHTML = `
    <div><strong>Weather:</strong> ${options.weather ?? "sunny"}</div>
    <div><strong>Phase:</strong> ${phase}</div>
    <div><strong>Profile:</strong> ${stress ? "maximum-load deterministic" : "interactive"}</div>
    <div><strong>Gizmo:</strong> ${options.enableGizmo ? "✓ Enabled" : "✗ Disabled"}</div>
    <div style="margin-top: 8px; color: #aaa; font-size: 10px;">
      Click scene to select objects<br/>
      G/R/S for move/rotate/scale
    </div>
  `;
  panel.appendChild(info);

  const diagnostics = document.createElement("div");
  diagnostics.dataset.rendererDiagnostics = "true";
  diagnostics.style.cssText = `
    background: #111;
    border: 1px solid #444;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 16px;
    font-size: 11px;
    color: #9cff9c;
    line-height: 1.5;
    white-space: pre;
  `;
  diagnostics.textContent = "Renderer diagnostics: initializing…";
  panel.appendChild(diagnostics);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕ Exit";
  closeBtn.style.cssText = `
    width: 100%;
    padding: 8px;
    background: #ff3333;
    color: #fff;
    border: 1px solid #ff3333;
    border-radius: 4px;
    cursor: pointer;
    font-family: monospace;
    font-weight: bold;
    margin-bottom: 16px;
  `;
  closeBtn.onclick = () => {
    disableSceneViewer();
    location.reload();
  };
  panel.appendChild(closeBtn);

  sidebar.appendChild(panel);
  container.appendChild(canvasContainer);
  container.appendChild(sidebar);
  appRoot.appendChild(container);

  // Create scene state
  const prepared = stress ? 400 : 20;
  const sold = stress ? 400 : 10;
  const visibleSigns = stress ? 40 : 5;
  const ambientPedestrianCount = stress ? 60 : 12;
  const durationMs = 14_000;

  const sceneState: LemonsvilleSceneState = Object.freeze({
    weather: options.weather ?? "sunny",
    visibleSigns,
    prepared,
    durationMs,
    confidence: 3,
    nextConfidence: 3,
    characterSeed: 12_345,
    dayNumber: 1,
    storyboard: createStreetStoryboard({
      durationMs,
      prepared,
      sold,
      visibleSigns,
      priceCents: 150,
      ambientPedestrianCount,
    }),
    phase,
    reducedMotion: false,
  });

  // Create scene (gizmo disabled for now - reserved for future 3D editor tool)
  const scene = createLemonsvilleScene(canvas, sceneState, {
    enableGizmo: false,
  });

  if (!scene) {
    const error = document.createElement("div");
    error.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff3333;
      color: #fff;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      z-index: 3000;
    `;
    error.textContent = "❌ Failed to create 3D scene";
    canvasContainer.appendChild(error);
    return null;
  }

  // TODO: Initialize gizmo controller for 3D editor (reserved for future development)
  // Once gizmo is integrated, this will enable realtime scene object manipulation
  // let gizmoController: ReturnType<typeof createGizmoController> | null = null;
  // if (scene.scene && scene.camera) {
  //   gizmoController = createGizmoController({ scene: scene.scene, camera: scene.camera, ... })
  // }

  // Gizmo section info (reserved for future 3D editor tool development)
  const gizmoSection = document.createElement("div");
  gizmoSection.style.cssText = `
    background: #1a1a1a;
    border: 1px solid #666666;
    border-radius: 4px;
    padding: 12px;
    font-size: 11px;
    color: #aaa;
  `;
  gizmoSection.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px; color: #888;">📐 3D Editor (Future)</div>
    <div style="line-height: 1.5;">
      <div style="font-size: 10px;">Infrastructure for realtime 3D manipulation and diagnostics. Enable when ready for game-engine-like editing capabilities.</div>
    </div>
  `;
  sidebar.appendChild(gizmoSection);

  // Handle resize
  const handleResize = () => {
    scene.resize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", handleResize);
  handleResize();

  // Initial render
  scene.update(sceneState);

  const updateDiagnostics = (): void => {
    const snapshot = scene.diagnostics();
    diagnostics.textContent = [
      `Draw calls: ${String(snapshot.drawCalls)}`,
      `Triangles: ${String(snapshot.triangles)}`,
      `Lines: ${String(snapshot.lines)}`,
      `Points: ${String(snapshot.points)}`,
      `Geometries: ${String(snapshot.geometries)}`,
      `Textures: ${String(snapshot.textures)}`,
      `Renderer frame: ${String(snapshot.frame)}`,
      `Fixture: ${stress ? "stress" : "interactive"}`,
      `Storyboard sales: ${String(sceneState.storyboard.sales.length)}`,
      `Storyboard passers: ${String(sceneState.storyboard.passersBy.length)}`,
    ].join("\n");
  };
  updateDiagnostics();
  const diagnosticsInterval = window.setInterval(updateDiagnostics, 500);

  return {
    scene,
    dispose: () => {
      window.removeEventListener("resize", handleResize);
      window.clearInterval(diagnosticsInterval);
      scene.dispose();
    },
  };
};

interface SceneViewerDevWindow {
  enableSceneViewer: typeof enableSceneViewer;
  disableSceneViewer: typeof disableSceneViewer;
  enableRendererStressFixture: typeof enableRendererStressFixture;
  disableRendererStressFixture: typeof disableRendererStressFixture;
}

// Make globally available
if (typeof window !== "undefined") {
  const devWindow = window as unknown as SceneViewerDevWindow;
  devWindow.enableSceneViewer = enableSceneViewer;
  devWindow.disableSceneViewer = disableSceneViewer;
  devWindow.enableRendererStressFixture = enableRendererStressFixture;
  devWindow.disableRendererStressFixture = disableRendererStressFixture;
}
