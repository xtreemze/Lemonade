/**
 * Lightweight flag helpers for the persistent 3D scene viewer dev tool.
 *
 * Kept separate from dev-scene-viewer.ts (which statically imports
 * @lemonade/scene and Three.js) so `main.ts` can check whether the tool is
 * enabled without pulling the heavy scene runtime into the critical entry
 * chunk. Only dynamically import dev-scene-viewer.js when this returns true.
 */

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

const RENDERER_STRESS_KEY = "LEMONADE_DEV_RENDERER_STRESS";

export const isRendererStressFixtureEnabled = (): boolean =>
  typeof localStorage !== "undefined" &&
  localStorage.getItem(RENDERER_STRESS_KEY) === "1";

export const enableRendererStressFixture = (): void => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(RENDERER_STRESS_KEY, "1");
  localStorage.setItem("LEMONADE_DEV_SCENE_VIEWER", "1");
  window.location.reload();
};

export const disableRendererStressFixture = (): void => {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(RENDERER_STRESS_KEY);
  window.location.reload();
};
