import type {
  CustomerActivity,
  LemonsvilleSceneController,
  LemonsvilleSceneState,
  ScenePhase,
  LemonsvilleSceneOptions,
} from "@lemonade/scene";
import {
  createStreetStoryboard,
  MIN_STREET_PEDESTRIANS,
} from "@lemonade/scene/storyboard-create";
import type { DayEnvironment } from "@lemonade/simulation";

import type { createLemonsvilleScene } from "./scene-runtime.js";

const activityForConfidence = (confidence: number): CustomerActivity => {
  if (confidence <= 0) return "quiet";
  if (confidence === 1) return "light";
  if (confidence === 2) return "steady";
  if (confidence === 3) return "lively";
  return "busy";
};

const sellerMoodForConfidence = (confidence: number): string => {
  if (confidence <= 0) return "discouraged";
  if (confidence === 1) return "uncertain";
  if (confidence === 2) return "cautious";
  if (confidence === 3) return "steady";
  if (confidence === 4) return "optimistic";
  return "radiant";
};

const pedestrianCount: Readonly<Record<CustomerActivity, number>> = Object.freeze({
  quiet: MIN_STREET_PEDESTRIANS,
  light: 24,
  steady: 28,
  lively: 32,
  busy: 36,
});

export type LemonsvilleSceneInput = Readonly<{
  environment: DayEnvironment;
  confidence: number;
  nextConfidence: number;
  visibleSigns: number;
  phase: ScenePhase;
  sold: number;
  prepared: number;
  priceCents: number;
  characterSeed: number;
  dayNumber: number;
  durationMs: number;
}>;

export type LemonsvilleSceneViewOptions = Readonly<{
  sceneOptions?: LemonsvilleSceneOptions;
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
  const weather =
    input.environment.weather.kind === "hot-and-dry"
      ? "partly cloudy"
      : input.environment.weather.kind.replaceAll("-", " ");

  if (input.phase === "forecast") {
    return `${weather} early-morning forecast; the lemonade stand is closed and empty before opening while neighborhood routines such as mail delivery, yard care, and resident activity continue.`;
  }

  const activity =
    input.phase === "simulation"
      ? `${String(input.sold)} sales from ${String(input.prepared)} prepared glasses`
      : "scene paused";

  const price =
    input.priceCents < 100
      ? String(Math.max(0, input.priceCents)) + "¢"
      : "$" + (Math.max(0, input.priceCents) / 100).toFixed(2);

  return `${weather} weather; the seller looks ${sellerMoodForConfidence(input.confidence)}; ${String(input.visibleSigns)} advertising signs at ${price} per cup; ${String(input.prepared)} glasses prepared; ${activity}.`;
};

const createState = (
  input: LemonsvilleSceneInput,
  reducedMotion: boolean,
): LemonsvilleSceneState => {
  const customerActivity = activityForConfidence(input.confidence);
  const prepared = Math.max(0, input.prepared);
  const sold = Math.max(0, input.sold);
  const priceCents = Math.max(0, input.priceCents);
  const durationMs = Math.max(0, input.durationMs);
  return Object.freeze({
    weather: input.environment.weather.kind,
    visibleSigns: input.visibleSigns,
    prepared,
    durationMs,
    confidence: Math.max(0, Math.min(5, input.confidence)),
    nextConfidence: Math.max(0, Math.min(5, input.nextConfidence)),
    characterSeed: input.characterSeed >>> 0,
    dayNumber: Math.max(1, Math.trunc(input.dayNumber)),
    storyboard: createStreetStoryboard({
      durationMs: Math.max(1, durationMs),
      prepared,
      sold: input.phase === "simulation" ? sold : 0,
      visibleSigns: input.visibleSigns,
      priceCents,
      ambientPedestrianCount: pedestrianCount[customerActivity],
    }),
    phase: input.phase,
    reducedMotion,
  });
};

export const createLemonsvilleSceneView = (
  elements: SceneElements,
  options: LemonsvilleSceneViewOptions = {},
): LemonsvilleSceneView => {
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
      const nextController = createLemonsvilleScene(elements.canvas, state, options.sceneOptions);

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
    elements.canvas.dataset["presentationDurationMs"] = String(Math.max(0, input.durationMs));
    elements.canvas.dataset["preparedCups"] = String(Math.max(0, input.prepared));
    elements.canvas.dataset["plannedSales"] = String(Math.max(0, input.sold));
    elements.canvas.dataset["priceCents"] = String(Math.max(0, input.priceCents));
    elements.canvas.dataset["characterSeed"] = String(input.characterSeed >>> 0);
    elements.canvas.dataset["dayNumber"] = String(Math.max(1, Math.trunc(input.dayNumber)));
    elements.canvas.dataset["sellerMood"] = sellerMoodForConfidence(input.confidence);
    elements.canvas.dataset["nextSellerMood"] = sellerMoodForConfidence(input.nextConfidence);
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
