import type {
  CustomerActivity,
  LemonsvilleSceneController,
  LemonsvilleSceneState,
  ScenePhase,
} from "@lemonade/scene";
import type { DayEnvironment } from "@lemonade/simulation";

import type { createLemonsvilleScene } from "./scene-runtime.js";

const activityBySentiment: Record<DayEnvironment["sentiment"]["kind"], CustomerActivity> = {
  "very-cold": "quiet",
  cold: "light",
  neutral: "steady",
  warm: "lively",
  hot: "busy",
};

export type LemonsvilleSceneInput = Readonly<{
  environment: DayEnvironment;
  visibleSigns: number;
  phase: ScenePhase;
  sold: number;
  prepared: number;
}>;

export type LemonsvilleSceneView = Readonly<{
  update(input: LemonsvilleSceneInput): void;
  dispose(): void;
}>;

type SceneElements = Readonly<{
  canvas: HTMLCanvasElement;
  fallback: HTMLElement;
  fallbackDescription: HTMLElement;
  equivalent: HTMLElement;
}>;

type SceneRuntime = Readonly<{
  createLemonsvilleScene: typeof createLemonsvilleScene;
}>;

let sceneRuntimePromise: Promise<SceneRuntime> | null = null;

const loadSceneRuntime = (): Promise<SceneRuntime> => {
  sceneRuntimePromise ??= import("./scene-runtime.js");
  return sceneRuntimePromise;
};

const describeScene = (input: LemonsvilleSceneInput): string => {
  const weather = input.environment.weather.kind.replaceAll("-", " ");
  const sentiment = input.environment.sentiment.kind.replaceAll("-", " ");
  const activity =
    input.phase === "forecast"
      ? "forecast preview"
      : input.phase === "simulation"
        ? `${String(input.sold)} sales from ${String(input.prepared)} prepared glasses`
        : "scene paused";

  return `${weather} weather; ${sentiment} market sentiment; ${String(input.visibleSigns)} advertising signs; ${String(input.prepared)} glasses prepared; ${activity}.`;
};

const createState = (
  input: LemonsvilleSceneInput,
  reducedMotion: boolean,
): LemonsvilleSceneState =>
  Object.freeze({
    weather: input.environment.weather.kind,
    customerActivity: activityBySentiment[input.environment.sentiment.kind],
    visibleSigns: input.visibleSigns,
    prepared: Math.max(0, input.prepared),
    sold: Math.max(0, input.sold),
    sellThroughBasisPoints:
      input.prepared > 0
        ? Math.round((Math.max(0, input.sold) / input.prepared) * 10_000)
        : 0,
    phase: input.phase,
    reducedMotion,
  });

export const createLemonsvilleSceneView = (elements: SceneElements): LemonsvilleSceneView => {
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reducedMotionQuery.matches;
  let controller: LemonsvilleSceneController | null = null;
  let observer: ResizeObserver | null = null;
  let lastInput: LemonsvilleSceneInput | null = null;
  let initialization: Promise<void> | null = null;
  let disposed = false;

  const showFallback = (description: string): void => {
    elements.canvas.classList.add("scene-canvas-hidden");
    elements.fallback.hidden = false;
    elements.fallback.setAttribute("aria-label", description);
    elements.fallbackDescription.textContent = description;
  };

  const initializeController = async (): Promise<void> => {
    try {
      const { createLemonsvilleScene } = await loadSceneRuntime();
      if (
        disposed ||
        controller !== null ||
        lastInput === null ||
        lastInput.phase === "idle"
      ) {
        return;
      }

      const description = describeScene(lastInput);
      const state = createState(lastInput, reducedMotion);
      const nextController = createLemonsvilleScene(elements.canvas, state);

      if (nextController === null) {
        showFallback(description);
        return;
      }

      controller = nextController;
      elements.canvas.classList.remove("scene-canvas-hidden");
      elements.fallback.hidden = true;

      const resize = (): void => {
        controller?.resize(elements.canvas.clientWidth, elements.canvas.clientHeight);
      };
      observer = new ResizeObserver(resize);
      observer.observe(elements.canvas);
      resize();
      controller.update(state);
    } catch {
      if (!disposed && lastInput !== null && lastInput.phase !== "idle") {
        showFallback(describeScene(lastInput));
      }
    } finally {
      initialization = null;
    }
  };

  const ensureController = (): void => {
    if (
      controller !== null ||
      initialization !== null ||
      disposed ||
      lastInput?.phase === "idle"
    ) {
      return;
    }
    initialization = initializeController();
  };

  const update = (input: LemonsvilleSceneInput): void => {
    if (disposed) return;
    lastInput = input;

    const description = describeScene(input);
    const state = createState(input, reducedMotion);
    elements.canvas.setAttribute("aria-label", description);
    elements.equivalent.textContent = description;
    elements.fallbackDescription.textContent = description;

    if (controller === null) {
      ensureController();
    } else {
      controller.update(state);
    }
  };

  const onReducedMotionChange = (): void => {
    reducedMotion = reducedMotionQuery.matches;
    if (lastInput !== null) update(lastInput);
  };
  reducedMotionQuery.addEventListener("change", onReducedMotionChange);

  return Object.freeze({
    update,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
      observer?.disconnect();
      observer = null;
      controller?.dispose();
      controller = null;
    },
  });
};
