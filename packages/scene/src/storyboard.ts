export type StreetDirection = -1 | 1;

export type BuyerPhase =
  | "inactive"
  | "approaching"
  | "purchasing"
  | "drinking"
  | "departing";

export type SceneShotKind = "establishing" | "street" | "purchase";

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
  return shot?.kind ?? "street";
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
  shot: SceneShotKind = "establishing",
): SceneCameraComposition => {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1);
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  const aspect = safeWidth / safeHeight;
  const mode = aspect < 0.72 ? "portrait" : aspect > 1.65 ? "wide" : "balanced";

  let fov = mode === "portrait" ? 47 : mode === "wide" ? 32 : 36;
  let x = 0;
  let y = mode === "portrait" ? 8.6 : mode === "wide" ? 6.5 : 7;
  let z = mode === "portrait" ? 17.8 : mode === "wide" ? 12.8 : 14.2;
  let lookY = mode === "wide" ? 1.75 : 1.8;
  let lookZ = mode === "portrait" ? 1.1 : mode === "wide" ? 0.7 : 0.8;

  if (shot === "street") {
    fov -= mode === "portrait" ? 4 : 1;
    y -= mode === "portrait" ? 1.7 : mode === "wide" ? 1 : 1.1;
    z -= mode === "portrait" ? 2.4 : mode === "wide" ? 1.3 : 1.5;
    lookY -= mode === "portrait" ? 0.25 : 0.35;
    lookZ += mode === "portrait" ? 1.6 : 1.75;
  } else if (shot === "purchase") {
    fov -= mode === "portrait" ? 10 : 2;
    x = mode === "portrait" ? 2.8 : mode === "wide" ? 3.2 : 3.1;
    y -= mode === "portrait" ? 3.8 : mode === "wide" ? 2.5 : 2.7;
    z -= mode === "portrait" ? 8.2 : mode === "wide" ? 5 : 5.7;
    lookY -= mode === "portrait" ? 0.25 : 0.3;
    lookZ += mode === "portrait" ? 0.25 : 0.45;
  }

  return Object.freeze({
    mode,
    shot,
    fov,
    position: [x, y, z] as const,
    lookAt: [0, lookY, lookZ] as const,
  });
};
