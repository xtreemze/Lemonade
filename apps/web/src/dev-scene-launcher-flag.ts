/**
 * Lightweight flag helper for the interactive 3D scene launcher dev tool.
 *
 * Kept separate from dev-scene-launcher.ts (which carries the full preset
 * list and DOM-building code) so `app.ts` can check whether the tool is
 * enabled without bundling that code into the critical entry chunk. Only
 * dynamically import dev-scene-launcher.js when this returns true.
 */

export const isSceneLauncherEnabled = (): boolean => {
  if (typeof localStorage === "undefined") {
    return false;
  }
  return localStorage.getItem("LEMONADE_DEV_SCENE_LAUNCHER") === "1";
};
