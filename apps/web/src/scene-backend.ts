export const SCENE_BACKEND_STORAGE_KEY =
  "LEMONADE_SCENE_BACKEND" as const;

export type LemonsvilleSceneBackend = "three" | "babylon";

export type SceneBackendStorage = Pick<Storage, "getItem">;

export const sceneBackendFromStorage = (
  storage: SceneBackendStorage,
): LemonsvilleSceneBackend =>
  storage.getItem(SCENE_BACKEND_STORAGE_KEY) === "babylon"
    ? "babylon"
    : "three";
