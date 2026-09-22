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

export type SceneCameraComposition = Readonly<{
  mode: "portrait" | "balanced" | "wide";
  shot: SceneShotKind;
  fov: number;
  position: readonly [number, number, number];
  lookAt: readonly [number, number, number];
}>;

export const sceneCameraComposition = (
  width: number,
  height: number,
  shot: SceneShotKind = "stand",
): SceneCameraComposition => {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1);
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  const aspect = safeWidth / safeHeight;
  const mode = aspect < 0.72 ? "portrait" : aspect > 1.65 ? "wide" : "balanced";

  if (shot === "forecast") {
    return Object.freeze({
      mode,
      shot,
      fov: mode === "portrait" ? 57 : mode === "wide" ? 36 : 43,
      position:
        mode === "portrait"
          ? ([0, 14.6, 32] as const)
          : mode === "wide"
            ? ([0, 9.2, 19] as const)
            : ([0, 10.8, 23] as const),
      lookAt: [0, 1.65, -1.8] as const,
    });
  }

  if (shot === "remaining") {
    return Object.freeze({
      mode,
      shot,
      fov: mode === "portrait" ? 44 : mode === "wide" ? 30 : 34,
      position:
        mode === "portrait"
          ? ([0, 6.4, 13.8] as const)
          : mode === "wide"
            ? ([0, 4.1, 7.7] as const)
            : ([0, 4.8, 9.1] as const),
      lookAt: [0, 1.85, 1.02] as const,
    });
  }

  return Object.freeze({
    mode,
    shot,
    fov: mode === "portrait" ? 55 : mode === "wide" ? 35 : 40,
    position:
      mode === "portrait"
        ? ([0, 11.4, 27.4] as const)
        : mode === "wide"
          ? ([0, 7.6, 17.2] as const)
          : ([0, 8.7, 20.4] as const),
    lookAt: [0, 1.72, 3.35] as const,
  });
};
