export const SCENE_VIEWER_STORAGE_KEY = "LEMONADE_DEV_SCENE_VIEWER" as const;
export const RENDERER_STRESS_STORAGE_KEY = "LEMONADE_DEV_RENDERER_STRESS" as const;

export const isSceneViewerEnabled = (): boolean =>
  typeof localStorage !== "undefined" &&
  localStorage.getItem(SCENE_VIEWER_STORAGE_KEY) === "1";

export const isRendererStressFixtureEnabled = (): boolean =>
  typeof localStorage !== "undefined" &&
  localStorage.getItem(RENDERER_STRESS_STORAGE_KEY) === "1";
