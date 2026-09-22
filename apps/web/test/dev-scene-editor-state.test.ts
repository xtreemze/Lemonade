import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEV_SCENE_EDITOR_STATE,
  deserializeDevSceneEditorState,
  parseDevSceneEditorState,
  serializeDevSceneEditorState,
  withTransform,
  withoutTransform,
} from "../src/dev-scene-editor-state.js";

describe("3d scene editor state", () => {
  it("round-trips scene, camera, density, and semantic transform state", () => {
    const transform = Object.freeze({
      key: "name:building-stand-home",
      name: "building-stand-home",
      position: Object.freeze([1, 2, 3]),
      rotation: Object.freeze([0.1, 0.2, 0.3]),
      scale: Object.freeze([1.1, 1.2, 1.3]),
    });
    const edited = withTransform(
      parseDevSceneEditorState({
        ...DEFAULT_DEV_SCENE_EDITOR_STATE,
        weather: "thunderstorm",
        phase: "forecast",
        seed: 777,
        density: {
          ...DEFAULT_DEV_SCENE_EDITOR_STATE.density,
          vehicles: 0.35,
        },
        world: {
          ...DEFAULT_DEV_SCENE_EDITOR_STATE.world,
          trees: 0.6,
        },
        camera: {
          position: [4, 5, 6],
          target: [1, 2, 3],
          fov: 48,
        },
      }),
      transform,
    );

    const restored = deserializeDevSceneEditorState(
      serializeDevSceneEditorState(edited),
    );

    expect(restored).toEqual(edited);
    expect(restored.transforms).toEqual([transform]);
  });

  it("clamps invalid imported editor values to safe supported ranges", () => {
    const parsed = parseDevSceneEditorState({
      weather: "hail",
      phase: "broken",
      seed: -10,
      dayNumber: 0,
      confidence: 99,
      prepared: -3,
      visibleSigns: 99,
      durationMs: 1,
      orbitEnabled: "yes",
      density: {
        pedestrians: -1,
        vehicles: 2,
      },
      world: {
        buildings: 8,
        trees: -4,
      },
      atmosphere: {
        timeOfDay: 5,
        weatherIntensity: -2,
        sunlightIntensity: 100,
      },
      playback: {
        paused: "no",
        rate: 20,
      },
      camera: {
        position: [Number.NaN, 5, 6],
        target: [1, 2, 3],
        fov: 500,
      },
      transforms: [
        {
          key: "",
          name: "invalid",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
      ],
    });

    expect(parsed.weather).toBe(DEFAULT_DEV_SCENE_EDITOR_STATE.weather);
    expect(parsed.phase).toBe(DEFAULT_DEV_SCENE_EDITOR_STATE.phase);
    expect(parsed.seed).toBe(0);
    expect(parsed.dayNumber).toBe(1);
    expect(parsed.confidence).toBe(5);
    expect(parsed.prepared).toBe(0);
    expect(parsed.visibleSigns).toBe(40);
    expect(parsed.durationMs).toBe(500);
    expect(parsed.orbitEnabled).toBe(DEFAULT_DEV_SCENE_EDITOR_STATE.orbitEnabled);
    expect(parsed.density.pedestrians).toBe(0);
    expect(parsed.density.vehicles).toBe(1);
    expect(parsed.world.buildings).toBe(1);
    expect(parsed.world.trees).toBe(0);
    expect(parsed.atmosphere.timeOfDay).toBe(1);
    expect(parsed.atmosphere.weatherIntensity).toBe(0);
    expect(parsed.atmosphere.sunlightIntensity).toBe(3);
    expect(parsed.playback.paused).toBe(false);
    expect(parsed.playback.rate).toBe(4);
    expect(parsed.camera.position).toEqual([0, 5, 6]);
    expect(parsed.camera.fov).toBe(100);
    expect(parsed.transforms).toEqual([]);
  });

  it("replaces and removes persisted transforms by semantic key", () => {
    const first = Object.freeze({
      key: "name:seller",
      name: "seller",
      position: Object.freeze([0, 0, 0]),
      rotation: Object.freeze([0, 0, 0]),
      scale: Object.freeze([1, 1, 1]),
    });
    const second = Object.freeze({
      ...first,
      position: Object.freeze([2, 0, 0]),
    });

    const replaced = withTransform(
      withTransform(DEFAULT_DEV_SCENE_EDITOR_STATE, first),
      second,
    );
    expect(replaced.transforms).toEqual([second]);
    expect(withoutTransform(replaced, first.key).transforms).toEqual([]);
  });
});
