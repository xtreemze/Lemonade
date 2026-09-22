export type StreetDirection = -1 | 1;

export type BuyerPhase =
  | "inactive"
  | "approaching"
  | "purchasing"
  | "drinking"
  | "departing";

export type SceneShotKind = "forecast" | "stand" | "remaining";

export type SceneShot = Readonly<{
  kind: SceneShotKind;
  startAtMs: number;
  endAtMs: number;
}>;

export type SaleBeat = Readonly<{
  saleNumber: number;
  buyerIndex: number;
  approachAtMs: number;
  purchaseAtMs: number;
  purchaseEndAtMs: number;
  drinkEndAtMs: number;
  departAtMs: number;
  direction: StreetDirection;
  lane: number;
  remainingCups: number;
}>;

export type PasserbyBeat = Readonly<{
  pedestrianIndex: number;
  startAtMs: number;
  endAtMs: number;
  direction: StreetDirection;
  lane: number;
  seesAdvertisement: boolean;
  signIndex: number;
}>;

export type StreetStoryboard = Readonly<{
  durationMs: number;
  activeDurationMs: number;
  prepared: number;
  sold: number;
  visibleSigns: number;
  priceCents: number;
  priceLabel: string;
  shots: readonly SceneShot[];
  sales: readonly SaleBeat[];
  passersBy: readonly PasserbyBeat[];
  adViewerCount: number;
}>;

const finiteInteger = (value: number, fallback: number): number =>
  Number.isFinite(value) ? Math.trunc(value) : fallback;

const boundedElapsed = (storyboard: StreetStoryboard, elapsedMs: number): number =>
  Math.min(
    storyboard.durationMs,
    Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0),
  );

export const completedSalesAt = (storyboard: StreetStoryboard, elapsedMs: number): number => {
  const boundedElapsedMs = boundedElapsed(storyboard, elapsedMs);
  let completed = 0;
  for (const sale of storyboard.sales) {
    if (sale.purchaseEndAtMs > boundedElapsedMs) break;
    completed += 1;
  }
  return completed;
};

export const remainingCupsAt = (storyboard: StreetStoryboard, elapsedMs: number): number =>
  Math.max(0, storyboard.prepared - completedSalesAt(storyboard, elapsedMs));

export const buyerPhaseAt = (sale: SaleBeat, elapsedMs: number): BuyerPhase => {
  if (elapsedMs < sale.approachAtMs || elapsedMs > sale.departAtMs) return "inactive";
  if (elapsedMs < sale.purchaseAtMs) return "approaching";
  if (elapsedMs < sale.purchaseEndAtMs) return "purchasing";
  if (elapsedMs < sale.drinkEndAtMs) return "drinking";
  return "departing";
};

export const buyerSlotForSale = (sale: SaleBeat, poolSize: number): number => {
  const safePoolSize = Math.max(1, finiteInteger(poolSize, 1));
  return sale.buyerIndex % safePoolSize;
};

export const sceneShotAt = (
  storyboard: StreetStoryboard,
  elapsedMs: number,
): SceneShotKind => {
  const elapsed = boundedElapsed(storyboard, elapsedMs);
  const shot = storyboard.shots.find(
    (candidate) =>
      elapsed >= candidate.startAtMs &&
      (elapsed < candidate.endAtMs || candidate.endAtMs === storyboard.durationMs),
  );
  return shot?.kind ?? "stand";
};

export const remainingCameraProgressAt = (
  storyboard: StreetStoryboard,
  elapsedMs: number,
): number => {
  const remainingShot = storyboard.shots.find((shot) => shot.kind === "remaining");
  if (remainingShot === undefined) return 0;
  const elapsed = boundedElapsed(storyboard, elapsedMs);
  if (elapsed <= remainingShot.startAtMs) return 0;
  if (elapsed >= remainingShot.endAtMs) return 1;
  const duration = Math.max(1, remainingShot.endAtMs - remainingShot.startAtMs);
  const transitionDuration = Math.max(1, duration * 0.62);
  const progress = Math.min(1, (elapsed - remainingShot.startAtMs) / transitionDuration);
  return progress * progress * (3 - 2 * progress);
};

export type SceneViewportClass =
  | "mobile-portrait"
  | "mobile-landscape"
  | "tablet"
  | "desktop";

export type SceneCameraComposition = Readonly<{
  mode: "portrait" | "balanced" | "wide";
  viewportClass: SceneViewportClass;
  shot: SceneShotKind;
  fov: number;
  position: readonly [number, number, number];
  lookAt: readonly [number, number, number];
}>;

const MOBILE_SHORT_EDGE_MAX = 500;
const DESKTOP_LONG_EDGE_MIN = 1_180;

const finiteViewportEdge = (value: number): number =>
  Math.max(1, Number.isFinite(value) ? value : 1);

export const sceneViewportClass = (
  width: number,
  height: number,
): SceneViewportClass => {
  const safeWidth = finiteViewportEdge(width);
  const safeHeight = finiteViewportEdge(height);
  const shortEdge = Math.min(safeWidth, safeHeight);
  const longEdge = Math.max(safeWidth, safeHeight);

  if (shortEdge <= MOBILE_SHORT_EDGE_MAX) {
    return safeWidth < safeHeight ? "mobile-portrait" : "mobile-landscape";
  }
  return longEdge >= DESKTOP_LONG_EDGE_MIN ? "desktop" : "tablet";
};

type SceneCameraProfile = Readonly<{
  fov: number;
  position: readonly [number, number, number];
  lookAt: readonly [number, number, number];
}>;

const CAMERA_PROFILES: Readonly<
  Record<SceneViewportClass, Readonly<Record<SceneShotKind, SceneCameraProfile>>>
> = Object.freeze({
  "mobile-portrait": Object.freeze({
    forecast: Object.freeze({
      fov: 60,
      position: [0, 19.5, 42] as const,
      lookAt: [0, 7, -8] as const,
    }),
    stand: Object.freeze({
      fov: 58,
      position: [0, 14.5, 36] as const,
      lookAt: [0, 7.5, 0.8] as const,
    }),
    remaining: Object.freeze({
      fov: 46,
      position: [0, 7.2, 16] as const,
      lookAt: [0, 2.8, 1] as const,
    }),
  }),
  "mobile-landscape": Object.freeze({
    forecast: Object.freeze({
      fov: 45,
      position: [0, 11.5, 31] as const,
      lookAt: [0, 5.3, -7] as const,
    }),
    stand: Object.freeze({
      fov: 42,
      position: [0, 9.3, 26] as const,
      lookAt: [0, 5, 3.2] as const,
    }),
    remaining: Object.freeze({
      fov: 33,
      position: [0, 5, 10] as const,
      lookAt: [0, 2.35, 1] as const,
    }),
  }),
  tablet: Object.freeze({
    forecast: Object.freeze({
      fov: 52,
      position: [0, 14.5, 38] as const,
      lookAt: [0, 6.2, -8] as const,
    }),
    stand: Object.freeze({
      fov: 49,
      position: [0, 11.8, 33] as const,
      lookAt: [0, 6, 1] as const,
    }),
    remaining: Object.freeze({
      fov: 36,
      position: [0, 5.7, 11.5] as const,
      lookAt: [0, 2.5, 1] as const,
    }),
  }),
  desktop: Object.freeze({
    forecast: Object.freeze({
      fov: 50,
      position: [0, 16.5, 46] as const,
      lookAt: [0, 6.8, -9] as const,
    }),
    stand: Object.freeze({
      fov: 47,
      position: [0, 13, 40] as const,
      lookAt: [0, 6.4, 0.5] as const,
    }),
    remaining: Object.freeze({
      fov: 34,
      position: [0, 6, 12.5] as const,
      lookAt: [0, 2.55, 1] as const,
    }),
  }),
});

export const sceneCameraComposition = (
  width: number,
  height: number,
  shot: SceneShotKind = "stand",
): SceneCameraComposition => {
  const safeWidth = finiteViewportEdge(width);
  const safeHeight = finiteViewportEdge(height);
  const aspect = safeWidth / safeHeight;
  const viewportClass = sceneViewportClass(safeWidth, safeHeight);
  const mode =
    aspect < 0.72 ? "portrait" : aspect > 1.65 ? "wide" : "balanced";
  const profile = CAMERA_PROFILES[viewportClass][shot];

  return Object.freeze({
    mode,
    viewportClass,
    shot,
    fov: profile.fov,
    position: profile.position,
    lookAt: profile.lookAt,
  });
};
