import { describe, expect, it } from "vitest";

import {
  SCENE_BACKEND_STORAGE_KEY,
  sceneBackendFromStorage,
} from "../src/scene-backend.js";

const storageWith = (value: string | null): Pick<Storage, "getItem"> => ({
  getItem(key: string): string | null {
    return key === SCENE_BACKEND_STORAGE_KEY ? value : null;
  },
});

describe("scene backend selection", () => {
  it("keeps Three.js as the compatibility backend until Babylon parity is certified", () => {
    expect(sceneBackendFromStorage(storageWith(null))).toBe("three");
  });

  it("selects Babylon explicitly for migration and certification", () => {
    expect(sceneBackendFromStorage(storageWith("babylon"))).toBe("babylon");
  });

  it("ignores unknown backend values", () => {
    expect(sceneBackendFromStorage(storageWith("webgpu"))).toBe("three");
  });
});
