export type StreetDirection = -1 | 1;

export type SaleBeat = Readonly<{
  saleNumber: number;
  buyerIndex: number;
  approachAtMs: number;
  purchaseAtMs: number;
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
  sales: readonly SaleBeat[];
  passersBy: readonly PasserbyBeat[];
  adViewerCount: number;
}>;

export type StreetStoryboardInput = Readonly<{
  durationMs: number;
  prepared: number;
  sold: number;
  visibleSigns: number;
  ambientPedestrianCount: number;
}>;

const MAX_PREPARED_CUPS = 250;
const MAX_VISIBLE_SIGNS = 25;

const finiteInteger = (value: number, fallback: number): number =>
  Number.isFinite(value) ? Math.trunc(value) : fallback;

const clampInteger = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, finiteInteger(value, minimum)));

const saleDirection = (index: number): StreetDirection => (index % 2 === 0 ? -1 : 1);

export const createStreetStoryboard = (input: StreetStoryboardInput): StreetStoryboard => {
  const durationMs = Math.max(1, finiteInteger(input.durationMs, 1));
  const prepared = clampInteger(input.prepared, 0, MAX_PREPARED_CUPS);
  const sold = clampInteger(input.sold, 0, prepared);
  const visibleSigns = clampInteger(input.visibleSigns, 0, MAX_VISIBLE_SIGNS);
  const ambientPedestrianCount = Math.max(1, finiteInteger(input.ambientPedestrianCount, 1));
  const passerbyCount = Math.max(
    sold + 1,
    ambientPedestrianCount + visibleSigns * 2,
  );
  const advertisementRatio =
    visibleSigns === 0 ? 0 : Math.min(0.5, 0.12 + visibleSigns * 0.02);
  const adViewerCount =
    visibleSigns === 0
      ? 0
      : Math.min(passerbyCount, Math.max(1, Math.ceil(passerbyCount * advertisementRatio)));

  const saleSpacingMs = durationMs / (sold + 1);
  const saleTravelMs = Math.min(900, Math.max(160, saleSpacingMs * 1.6));
  const sales = Array.from({ length: sold }, (_, index): SaleBeat => {
    const purchaseAtMs = Math.round(saleSpacingMs * (index + 1));
    return Object.freeze({
      saleNumber: index + 1,
      buyerIndex: index,
      approachAtMs: Math.max(0, Math.round(purchaseAtMs - saleTravelMs)),
      purchaseAtMs,
      departAtMs: Math.min(durationMs, Math.round(purchaseAtMs + saleTravelMs)),
      direction: saleDirection(index),
      lane: index % 3,
      remainingCups: prepared - index - 1,
    });
  });

  const crossingDurationMs = Math.min(durationMs, Math.max(1_100, durationMs * 0.42));
  const passersBy = Array.from({ length: passerbyCount }, (_, index): PasserbyBeat => {
    const centerAtMs = (durationMs * (index + 0.5)) / passerbyCount;
    const seesAdvertisement = index < adViewerCount;
    return Object.freeze({
      pedestrianIndex: index,
      startAtMs: Math.round(centerAtMs - crossingDurationMs / 2),
      endAtMs: Math.round(centerAtMs + crossingDurationMs / 2),
      direction: saleDirection(index + 1),
      lane: index % 4,
      seesAdvertisement,
      signIndex: seesAdvertisement && visibleSigns > 0 ? index % visibleSigns : -1,
    });
  });

  return Object.freeze({
    durationMs,
    prepared,
    sold,
    visibleSigns,
    sales: Object.freeze(sales),
    passersBy: Object.freeze(passersBy),
    adViewerCount,
  });
};

export const completedSalesAt = (storyboard: StreetStoryboard, elapsedMs: number): number => {
  const boundedElapsedMs = Math.min(
    storyboard.durationMs,
    Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0),
  );
  let completed = 0;
  for (const sale of storyboard.sales) {
    if (sale.purchaseAtMs > boundedElapsedMs) break;
    completed += 1;
  }
  return completed;
};

export const remainingCupsAt = (storyboard: StreetStoryboard, elapsedMs: number): number =>
  Math.max(0, storyboard.prepared - completedSalesAt(storyboard, elapsedMs));

export type SceneCameraComposition = Readonly<{
  mode: "portrait" | "balanced" | "wide";
  fov: number;
  position: readonly [number, number, number];
  lookAt: readonly [number, number, number];
}>;

export const sceneCameraComposition = (
  width: number,
  height: number,
): SceneCameraComposition => {
  const safeWidth = Math.max(1, Number.isFinite(width) ? width : 1);
  const safeHeight = Math.max(1, Number.isFinite(height) ? height : 1);
  const aspect = safeWidth / safeHeight;

  if (aspect < 0.72) {
    return Object.freeze({
      mode: "portrait",
      fov: 47,
      position: [0, 8.6, 17.8] as const,
      lookAt: [0, 1.8, 1.1] as const,
    });
  }
  if (aspect > 1.65) {
    return Object.freeze({
      mode: "wide",
      fov: 32,
      position: [0, 6.5, 12.8] as const,
      lookAt: [0, 1.75, 0.7] as const,
    });
  }
  return Object.freeze({
    mode: "balanced",
    fov: 36,
    position: [0, 7.0, 14.2] as const,
    lookAt: [0, 1.8, 0.8] as const,
  });
};
