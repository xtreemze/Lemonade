import { describe, expect, it } from "vitest";

import {
  clampSceneCameraZoom,
  DEFAULT_SCENE_CAMERA_ZOOM,
  MAX_SCENE_CAMERA_ZOOM,
  MIN_SCENE_CAMERA_ZOOM,
  readSceneCameraZoomPreference,
  type SceneCameraZoomStorage,
  sceneCameraZoomFromPinch,
  sceneCameraZoomFromWheel,
  sceneCameraZoomPreferenceKey,
  writeSceneCameraZoomPreference,
} from "../src/camera-zoom.js";

class MemoryStorage implements SceneCameraZoomStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("scene camera zoom preference", () => {
  it("separates remembered zoom by scene phase and responsive viewport class", () => {
    expect(sceneCameraZoomPreferenceKey("forecast", "mobile-portrait")).not.toBe(
      sceneCameraZoomPreferenceKey("simulation", "mobile-portrait"),
    );
    expect(sceneCameraZoomPreferenceKey("simulation", "mobile-portrait")).not.toBe(
      sceneCameraZoomPreferenceKey("simulation", "desktop"),
    );
  });

  it("reads, writes, and clamps remembered zoom safely", () => {
    const storage = new MemoryStorage();
    const key = sceneCameraZoomPreferenceKey("simulation", "desktop");

    expect(readSceneCameraZoomPreference(storage, key)).toBe(DEFAULT_SCENE_CAMERA_ZOOM);

    writeSceneCameraZoomPreference(storage, key, 1.35);
    expect(readSceneCameraZoomPreference(storage, key)).toBeCloseTo(1.35);

    storage.values.set(key, "999");
    expect(readSceneCameraZoomPreference(storage, key)).toBe(MAX_SCENE_CAMERA_ZOOM);

    storage.values.set(key, "not-a-number");
    expect(readSceneCameraZoomPreference(storage, key)).toBe(DEFAULT_SCENE_CAMERA_ZOOM);
  });

  it("uses wheel direction to zoom in and out with hard bounds", () => {
    expect(sceneCameraZoomFromWheel(1, -120, 0, 800)).toBeGreaterThan(1);
    expect(sceneCameraZoomFromWheel(1, 120, 0, 800)).toBeLessThan(1);
    expect(sceneCameraZoomFromWheel(MAX_SCENE_CAMERA_ZOOM, -10_000, 0, 800)).toBe(
      MAX_SCENE_CAMERA_ZOOM,
    );
    expect(sceneCameraZoomFromWheel(MIN_SCENE_CAMERA_ZOOM, 10_000, 0, 800)).toBe(
      MIN_SCENE_CAMERA_ZOOM,
    );
  });

  it("maps pinch expansion and contraction to optical zoom", () => {
    expect(sceneCameraZoomFromPinch(1, 100, 130)).toBeCloseTo(1.3);
    expect(sceneCameraZoomFromPinch(1, 100, 80)).toBeCloseTo(0.8);
    expect(sceneCameraZoomFromPinch(1.4, 0, 120)).toBe(clampSceneCameraZoom(1.4));
  });
});
