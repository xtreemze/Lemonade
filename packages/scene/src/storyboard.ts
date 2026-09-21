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

export type StreetStoryboardInput = Readonly<{
  durationMs: number;
  prepared: number;
  sold: number;
  visibleSigns: number;
  priceCents: number;
  ambientPedestrianCount: number;
}>;

const MAX_PREPARED_CUPS = 250;
const MAX_VISIBLE_SIGNS = 25;
const MAX_PRICE_CENTS = 99_999;

const finiteInteger = (value: number, fallback: number): number =>
  Number.isFinite(value) ? Math.trunc(value) : fallback;

const clampInteger = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, finiteInteger(value, minimum)));

const saleDirection = (index: number): StreetDirection => (index % 2 === 0 ? -1 : 1);

export const formatPriceLabel = (priceCents: number): string => {
  const cents = clampInteger(priceCents, 0, MAX_PRICE_CENTS);
  if (cents === 0) return "FREE";
  return cents < 100 ? String(cents) + "¢" : "$" + (cents / 100).toFixed(2);
};

const createShots = (durationMs: number): readonly SceneShot[] => {
  const establishingEnd = Math.round(durationMs * 0.2);
  const purchaseStart = Math.round(durationMs * 0.48);
  const purchaseEnd = Math.round(durationMs * 0.72);
  return Object.freeze([
    Object.freeze({ kind: "establishing", startAtMs: 0, endAtMs: establishingEnd }),
    Object.freeze({
      kind: "street",
      startAtMs: establishingEnd,
      endAtMs: purchaseStart,
    }),
    Object.freeze({
      kind: "purchase",
      startAtMs: purchaseStart,
      endAtMs: purchaseEnd,
    }),
    Object.freeze({ kind: "street", startAtMs: purchaseEnd, endAtMs: durationMs }),
  ]);
};

export const createStreetStoryboard = (input: StreetStoryboardInput): StreetStoryboard => {
  const durationMs = Math.max(1, finiteInteger(input.durationMs, 1));
  const prepared = clampInteger(input.prepared, 0, MAX_PREPARED_CUPS);
  const sold = clampInteger(input.sold, 0, prepared);
  const visibleSigns = clampInteger(input.visibleSigns, 0, MAX_VISIBLE_SIGNS);
  const priceCents = clampInteger(input.priceCents, 0, MAX_PRICE_CENTS);
  const ambientPedestrianCount = Math.max(1, finiteInteger(input.ambientPedestrianCount, 1));
  const passerbyCount = Math.max(sold + 1, ambientPedestrianCount + visibleSigns * 2);
  const advertisementRatio =
    visibleSigns === 0 ? 0 : Math.min(0.5, 0.12 + visibleSigns * 0.02);
  const adViewerCount =
    visibleSigns === 0
      ? 0
      : Math.min(passerbyCount, Math.max(1, Math.ceil(passerbyCount * advertisementRatio)));

  const purchaseWindowStart = Math.round(durationMs * 0.16);
  const purchaseWindowEnd = Math.round(durationMs * 0.82);
  const approachTravelMs = Math.min(650, Math.max(240, durationMs * 0.09));
  const purchaseDurationMs = Math.min(220, Math.max(130, durationMs * 0.028));
  const drinkDurationMs = Math.min(430, Math.max(240, durationMs * 0.055));
  const departTravelMs = Math.min(650, Math.max(240, durationMs * 0.09));

  const sales = Array.from({ length: sold }, (_, index): SaleBeat => {
    const purchaseAtMs =
      sold === 1
        ? Math.round(durationMs * 0.52)
        : Math.round(
            purchaseWindowStart +
              ((purchaseWindowEnd - purchaseWindowStart) * index) / Math.max(1, sold - 1),
          );
    const purchaseEndAtMs = Math.min(
      durationMs,
      Math.round(purchaseAtMs + purchaseDurationMs),
    );
    const drinkEndAtMs = Math.min(
      durationMs,
      Math.round(purchaseEndAtMs + drinkDurationMs),
    );
    return Object.freeze({
      saleNumber: index + 1,
      buyerIndex: index,
      approachAtMs: Math.max(0, Math.round(purchaseAtMs - approachTravelMs)),
      purchaseAtMs,
      purchaseEndAtMs,
      drinkEndAtMs,
      departAtMs: Math.min(durationMs, Math.round(drinkEndAtMs + departTravelMs)),
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
    priceCents,
    priceLabel: formatPriceLabel(priceCents),
    shots: createShots(durationMs),
    sales: Object.freeze(sales),
    passersBy: Object.freeze(passersBy),
    adViewerCount,
  });
};

const boundedElapsed = (storyboard: StreetStoryboard, elapsedMs: number): number =>
  Math.min(
    storyboard.durationMs,
    Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0),
  );

export const completedSalesAt = (storyboard: StreetStoryboard, elapsedMs: number): number => {
  const boundedElapsedMs = boundedElapsed(storyboard, elapsedMs);
  let completed = 0;
  for (const sale of storyboard.sales) {
    if (sale.purchaseAtMs > boundedElapsedMs) break;
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
