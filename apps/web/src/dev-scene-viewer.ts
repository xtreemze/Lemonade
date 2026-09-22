/**
 * Dev Tool: Persistent 3D Scene Viewer
 *
 * Launches a dedicated 3D scene view that persists without game UI interference.
 * Perfect for using the gizmo tool to manipulate objects interactively.
 *
 * Enable with: `localStorage.setItem('LEMONADE_DEV_SCENE_VIEWER', '1')`
 */

import type { SceneWeather, ScenePhase, LemonsvilleSceneState } from "@lemonade/scene";
import { createLemonsvilleScene } from "@lemonade/scene";
import { createStreetStoryboard } from "@lemonade/scene/storyboard-create";

export const isSceneViewerEnabled = (): boolean => {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem("LEMONADE_DEV_SCENE_VIEWER") === "1";
};

export const enableSceneViewer = (): void => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("LEMONADE_DEV_SCENE_VIEWER", "1");
    console.log("🎥 Scene viewer enabled! Refresh the page to activate.");
  }
};

export const disableSceneViewer = (): void => {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("LEMONADE_DEV_SCENE_VIEWER");
    console.log("🎥 Scene viewer disabled. Refresh the page.");
  }
};

export const createPersistentSceneViewer = (
  appRoot: HTMLElement,
  options: { enableGizmo?: boolean; weather?: SceneWeather; phase?: ScenePhase } = {},
) => {
  // Clear app UI
  appRoot.innerHTML = "";

  // Create scene container
  const container = document.createElement("div");
  container.style.cssText = `
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #000;
  `;

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.style.cssText = `
    flex: 1;
    display: block;
    background: #000;
  `;

  // Create control panel
  const panel = document.createElement("div");
  panel.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #ffff00;
    border-radius: 8px;
    padding: 16px;
    font-family: monospace;
    font-size: 12px;
    color: #fff;
    z-index: 2000;
    max-width: 300px;
  `;

  const title = document.createElement("div");
  title.style.cssText = "font-weight: bold; margin-bottom: 12px; color: #ffff00; font-size: 14px;";
  title.textContent = "🎥 3D Scene Viewer (Dev Mode)";
  panel.appendChild(title);

  const info = document.createElement("div");
  info.style.cssText = `
    background: #1a1a1a;
    border: 1px solid #666;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 12px;
    font-size: 11px;
    color: #0f0;
    line-height: 1.5;
  `;
  info.innerHTML = `
    <div><strong>Weather:</strong> ${options.weather || "sunny"}</div>
    <div><strong>Phase:</strong> ${options.phase || "simulation"}</div>
    <div><strong>Gizmo:</strong> ${options.enableGizmo ? "✓ Enabled" : "✗ Disabled"}</div>
    <div style="margin-top: 8px; color: #aaa; font-size: 10px;">
      Canvas ready for manipulation.<br/>
      Use gizmo to select and move objects.
    </div>
  `;
  panel.appendChild(info);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕ Exit Scene Viewer";
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
  `;
  closeBtn.onclick = () => {
    disableSceneViewer();
    location.reload();
  };
  panel.appendChild(closeBtn);

  container.appendChild(canvas);
  container.appendChild(panel);
  appRoot.appendChild(container);

  // Create scene state
  const sceneState: LemonsvilleSceneState = Object.freeze({
    weather: options.weather || "sunny",
    visibleSigns: 5,
    prepared: 20,
    durationMs: 14000,
    confidence: 3,
    nextConfidence: 3,
    characterSeed: 12345,
    dayNumber: 1,
    storyboard: createStreetStoryboard({
      durationMs: 14000,
      prepared: 20,
      sold: 10,
      visibleSigns: 5,
      priceCents: 150,
      ambientPedestrianCount: 12,
    }),
    phase: options.phase || "simulation",
    reducedMotion: false,
  });

  // Create scene
  const scene = createLemonsvilleScene(canvas, sceneState, {
    enableGizmo: options.enableGizmo !== false, // Enable by default
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
    container.appendChild(error);
    return null;
  }

  // Handle resize
  const handleResize = () => {
    scene.resize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", handleResize);
  handleResize();

  // Initial render
  scene.update(sceneState);

  return {
    scene,
    dispose: () => {
      window.removeEventListener("resize", handleResize);
      scene.dispose();
    },
  };
};

// Make globally available
if (typeof window !== "undefined") {
  (window as any).enableSceneViewer = enableSceneViewer;
  (window as any).disableSceneViewer = disableSceneViewer;
}
