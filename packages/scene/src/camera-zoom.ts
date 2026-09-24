import type { SceneViewportClass } from "./storyboard.js";

export type SceneCameraZoomPhase = "forecast" | "idle" | "simulation";

export interface SceneCameraZoomStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export const DEFAULT_SCENE_CAMERA_ZOOM = 1;
export const MIN_SCENE_CAMERA_ZOOM = 0.7;
export const MAX_SCENE_CAMERA_ZOOM = 1.8;

const STORAGE_PREFIX = "lemonade:scene-camera-zoom:v1";
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const WHEEL_LINE_PIXELS = 16;

export const clampSceneCameraZoom = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_SCENE_CAMERA_ZOOM;
  }
  return Math.min(MAX_SCENE_CAMERA_ZOOM, Math.max(MIN_SCENE_CAMERA_ZOOM, value));
};

export const sceneCameraZoomPreferenceKey = (
  phase: SceneCameraZoomPhase,
  viewportClass: SceneViewportClass,
): string => `${STORAGE_PREFIX}:${phase}:${viewportClass}`;

export const readSceneCameraZoomPreference = (
  storage: SceneCameraZoomStorage | null,
  key: string,
): number => {
  if (storage === null) {
    return DEFAULT_SCENE_CAMERA_ZOOM;
  }
  try {
    const stored = storage.getItem(key);
    if (stored === null) {
      return DEFAULT_SCENE_CAMERA_ZOOM;
    }
    return clampSceneCameraZoom(Number.parseFloat(stored));
  } catch {
    return DEFAULT_SCENE_CAMERA_ZOOM;
  }
};

export const writeSceneCameraZoomPreference = (
  storage: SceneCameraZoomStorage | null,
  key: string,
  zoom: number,
): void => {
  if (storage === null) {
    return;
  }
  try {
    storage.setItem(key, String(clampSceneCameraZoom(zoom)));
  } catch {
    // Presentation preferences are best-effort and must never break the scene.
  }
};

const wheelDeltaPixels = (deltaY: number, deltaMode: number, viewportHeight: number): number => {
  if (!Number.isFinite(deltaY)) {
    return 0;
  }
  if (deltaMode === 1) {
    return deltaY * WHEEL_LINE_PIXELS;
  }
  if (deltaMode === 2) {
    return deltaY * Math.max(1, viewportHeight);
  }
  return deltaY;
};

export const sceneCameraZoomFromWheel = (
  currentZoom: number,
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
): number =>
  clampSceneCameraZoom(
    clampSceneCameraZoom(currentZoom) *
      Math.exp(-wheelDeltaPixels(deltaY, deltaMode, viewportHeight) * WHEEL_ZOOM_SENSITIVITY),
  );

export const sceneCameraZoomFromPinch = (
  startZoom: number,
  startDistance: number,
  currentDistance: number,
): number => {
  if (
    !(Number.isFinite(startDistance) && Number.isFinite(currentDistance)) ||
    startDistance <= 0 ||
    currentDistance <= 0
  ) {
    return clampSceneCameraZoom(startZoom);
  }

  return clampSceneCameraZoom(clampSceneCameraZoom(startZoom) * (currentDistance / startDistance));
};
