import { describe, expect, it } from "vitest";

import {
  BABYLON_ENGINE_STORAGE_KEY,
  babylonEnginePreferenceFromStorage,
  babylonEnginePreferenceOrder,
} from "../src/babylon-engine-backend.js";

const storageWith = (value: string | null): Pick<Storage, "getItem"> => ({
  getItem(key: string): string | null {
    return key === BABYLON_ENGINE_STORAGE_KEY ? value : null;
  },
});

describe("Babylon engine backend selection", () => {
  it("prefers WebGPU and retains WebGL fallback in automatic mode", () => {
    expect(babylonEnginePreferenceFromStorage(storageWith(null))).toBe("auto");
    expect(babylonEnginePreferenceOrder("auto")).toEqual(["webgpu", "webgl"]);
  });

  it("can require WebGPU for certification without silently falling back", () => {
    expect(babylonEnginePreferenceFromStorage(storageWith("webgpu"))).toBe("webgpu");
    expect(babylonEnginePreferenceOrder("webgpu")).toEqual(["webgpu"]);
  });

  it("can force WebGL for parity certification", () => {
    expect(babylonEnginePreferenceFromStorage(storageWith("webgl"))).toBe("webgl");
    expect(babylonEnginePreferenceOrder("webgl")).toEqual(["webgl"]);
  });

  it("ignores unknown migration values", () => {
    expect(babylonEnginePreferenceFromStorage(storageWith("unknown"))).toBe("auto");
  });
});
