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

export const endingCloseupProgressAt = (
  storyboard: StreetStoryboard,
  elapsedMs: number,
): number => {
  const elapsed = boundedElapsed(storyboard, elapsedMs);
  if (elapsed <= storyboard.activeDurationMs) return 0;
  const duration = Math.max(1, storyboard.durationMs - storyboard.activeDurationMs);
  return Math.min(1, (elapsed - storyboard.activeDurationMs) / duration);
};

export const endingConfidenceAt = (
  storyboard: StreetStoryboard,
  elapsedMs: number,
  currentConfidence: number,
  nextConfidence: number,
): number => {
  const progress = endingCloseupProgressAt(storyboard, elapsedMs);
  const eased = progress * progress * (3 - 2 * progress);
  return currentConfidence + (nextConfidence - currentConfidence) * eased;
};


export type SellerGestureFrame = Readonly<{
  strength: number;
  armLift: number;
  armSpread: number;
  torsoLift: number;
  headTilt: number;
}>;

export const sellerGestureAt = (
  storyboard: StreetStoryboard,
  elapsedMs: number,
  currentConfidence: number,
  nextConfidence: number,
): SellerGestureFrame => {
  const progress = endingCloseupProgressAt(storyboard, elapsedMs);
  const gestureProgress = Math.min(
    1,
    Math.max(0, (progress - 0.32) / 0.68),
  );
  const strength =
    gestureProgress * gestureProgress * (3 - 2 * gestureProgress);
  const confidence = Math.min(
    1,
    Math.max(
      0,
      endingConfidenceAt(
        storyboard,
        elapsedMs,
        currentConfidence,
        nextConfidence,
      ) / 5,
    ),
  );
  const mix = (low: number, high: number): number =>
    low + (high - low) * confidence;

  return Object.freeze({
    strength,
    armLift: mix(0.08, -0.62) * strength,
    armSpread: mix(0.06, 0.5) * strength,
    torsoLift: mix(-0.035, 0.055) * strength,
    headTilt: mix(0.075, -0.05) * strength,
  });
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
  fov: number;
  position: readonly [number, number, number];
  lookAt: readonly [number, number, number];
}>;

const finiteViewportEdge = (value: number): number =>
  Math.max(1, Number.isFinite(value) ? value : 1);

const VIEWPORT_CLASSES = [
  "mobile-portrait",
  "mobile-landscape",
  "tablet",
  "desktop",
] as const;

const viewportClassIndex = (width: number, height: number): 0 | 1 | 2 | 3 => {
  const shortEdge = Math.min(width, height);
  if (shortEdge <= 500) return width < height ? 0 : 1;
  return Math.max(width, height) >= 1_180 ? 3 : 2;
};

export const sceneViewportClass = (
  width: number,
  height: number,
): SceneViewportClass =>
  VIEWPORT_CLASSES[
    viewportClassIndex(finiteViewportEdge(width), finiteViewportEdge(height))
  ];

type SceneCameraProfile = readonly [
  fov: number,
  positionY: number,
  positionZ: number,
  lookAtY: number,
  lookAtZ: number,
];

const CAMERA_PROFILES: readonly [
  readonly [SceneCameraProfile, SceneCameraProfile, SceneCameraProfile],
  readonly [SceneCameraProfile, SceneCameraProfile, SceneCameraProfile],
  readonly [SceneCameraProfile, SceneCameraProfile, SceneCameraProfile],
  readonly [SceneCameraProfile, SceneCameraProfile, SceneCameraProfile],
] = [
  [[60, 19.5, 42, 7, -8], [58, 14.5, 36, 7.5, 0.8], [46, 7.2, 16, 2.8, 1]],
  [[45, 11.5, 31, 5.3, -7], [42, 9.3, 26, 5, 3.2], [33, 5, 10, 2.35, 1]],
  [[52, 14.5, 38, 6.2, -8], [49, 11.8, 33, 6, 1], [36, 5.7, 11.5, 2.5, 1]],
  [[50, 16.5, 46, 6.8, -9], [47, 13, 40, 6.4, 0.5], [34, 6, 12.5, 2.55, 1]],
];

export const sceneCameraComposition = (
  width: number,
  height: number,
  shot: SceneShotKind = "stand",
): SceneCameraComposition => {
  const safeWidth = finiteViewportEdge(width);
  const safeHeight = finiteViewportEdge(height);
  const aspect = safeWidth / safeHeight;
  const mode =
    aspect < 0.72 ? "portrait" : aspect > 1.65 ? "wide" : "balanced";
  const shotIndex = shot === "forecast" ? 0 : shot === "stand" ? 1 : 2;
  const profile =
    CAMERA_PROFILES[viewportClassIndex(safeWidth, safeHeight)][shotIndex];

  return {
    mode,
    fov: profile[0],
    position: [0, profile[1], profile[2]],
    lookAt: [0, profile[3], profile[4]],
  };
};
