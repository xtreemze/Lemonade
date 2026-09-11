import {
  createLemonsvilleScene,
  type CustomerActivity,
  type LemonsvilleSceneController,
  type LemonsvilleSceneState,
} from "@lemonade/scene";
import type { DayEnvironment } from "@lemonade/simulation";

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
  phase: "deciding" | "report";
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

const describeScene = (input: LemonsvilleSceneInput): string =>
  `${input.environment.weather.kind.replaceAll("-", " ")} weather; ${input.environment.sentiment.kind.replaceAll("-", " ")} market sentiment; ${String(input.visibleSigns)} advertising signs visible.`;

const createState = (
  input: LemonsvilleSceneInput,
  reducedMotion: boolean,
): LemonsvilleSceneState =>
  Object.freeze({
    weather: input.environment.weather.kind,
    customerActivity: activityBySentiment[input.environment.sentiment.kind],
    visibleSigns: input.visibleSigns,
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
  let disposed = false;

  const showFallback = (description: string): void => {
    elements.canvas.classList.add("scene-canvas-hidden");
    elements.fallback.hidden = false;
    elements.fallback.setAttribute("aria-label", description);
    elements.fallbackDescription.textContent = description;
  };

  const ensureController = (state: LemonsvilleSceneState, description: string): void => {
    if (controller !== null || disposed) return;

    controller = createLemonsvilleScene(elements.canvas, state);
    if (controller === null) {
      showFallback(description);
      return;
    }

    const resize = (): void => {
      controller?.resize(elements.canvas.clientWidth, elements.canvas.clientHeight);
    };
    observer = new ResizeObserver(resize);
    observer.observe(elements.canvas);
    resize();
  };

  const update = (input: LemonsvilleSceneInput): void => {
    if (disposed) return;
    lastInput = input;

    const description = describeScene(input);
    const state = createState(input, reducedMotion);
    elements.canvas.setAttribute("aria-label", description);
    elements.equivalent.textContent = description;
    elements.fallbackDescription.textContent = description;

    ensureController(state, description);
    controller?.update(state);
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
