import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";

export const BABYLON_ENGINE_STORAGE_KEY = "LEMONADE_BABYLON_ENGINE" as const;

export type BabylonEnginePreference = "auto" | "webgpu" | "webgl";
export type BabylonEngineKind = "webgpu" | "webgl";
export type BabylonEngine = Engine | WebGPUEngine;
export type BabylonEngineStorage = Pick<Storage, "getItem">;

export interface BabylonEngineBackend {
  readonly kind: BabylonEngineKind;
  readonly engine: BabylonEngine;
}

export const babylonEnginePreferenceFromStorage = (
  storage: BabylonEngineStorage,
): BabylonEnginePreference => {
  try {
    const value = storage.getItem(BABYLON_ENGINE_STORAGE_KEY);
    return value === "webgpu" || value === "webgl" ? value : "auto";
  } catch {
    return "auto";
  }
};

export const babylonEnginePreferenceOrder = (
  preference: BabylonEnginePreference,
): readonly BabylonEngineKind[] => {
  switch (preference) {
    case "webgpu":
      return Object.freeze(["webgpu"]);
    case "webgl":
      return Object.freeze(["webgl"]);
    case "auto":
      return Object.freeze(["webgpu", "webgl"]);
  }
};

const browserBabylonEnginePreference = (): BabylonEnginePreference => {
  try {
    return babylonEnginePreferenceFromStorage(globalThis.localStorage);
  } catch {
    return "auto";
  }
};

const createWebGPUEngine = async (
  canvas: HTMLCanvasElement,
): Promise<WebGPUEngine | null> => {
  if (!(await WebGPUEngine.IsSupportedAsync)) {
    return null;
  }

  const engine = new WebGPUEngine(canvas, {
    antialias: true,
    adaptToDeviceRatio: false,
  });

  try {
    await engine.initAsync();
    return engine;
  } catch {
    engine.dispose();
    return null;
  }
};

const createWebGLEngine = (canvas: HTMLCanvasElement): Engine | null => {
  try {
    return new Engine(
      canvas,
      true,
      {
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
        stencil: true,
      },
      false,
    );
  } catch {
    return null;
  }
};

export const createBabylonEngineBackend = async (
  canvas: HTMLCanvasElement,
  preference: BabylonEnginePreference = browserBabylonEnginePreference(),
): Promise<BabylonEngineBackend | null> => {
  for (const kind of babylonEnginePreferenceOrder(preference)) {
    if (kind === "webgpu") {
      const engine = await createWebGPUEngine(canvas);
      if (engine !== null) {
        return Object.freeze({ kind, engine });
      }
      continue;
    }

    const engine = createWebGLEngine(canvas);
    if (engine !== null) {
      return Object.freeze({ kind, engine });
    }
  }

  return null;
};
