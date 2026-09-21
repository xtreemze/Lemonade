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

  const table: Record<
    SceneCameraComposition["mode"],
    Record<SceneShotKind, Omit<SceneCameraComposition, "mode" | "shot">>
  > = {
    portrait: {
      establishing: {
        fov: 47,
        position: [0, 8.6, 17.8],
        lookAt: [0, 1.8, 1.1],
      },
      street: {
        fov: 43,
        position: [0, 6.9, 15.4],
        lookAt: [0, 1.55, 2.7],
      },
      purchase: {
        fov: 37,
        position: [2.8, 4.8, 9.6],
        lookAt: [0, 1.55, 1.35],
      },
    },
    balanced: {
      establishing: {
        fov: 36,
        position: [0, 7, 14.2],
        lookAt: [0, 1.8, 0.8],
      },
      street: {
        fov: 35,
        position: [0, 5.9, 12.7],
        lookAt: [0, 1.45, 2.55],
      },
      purchase: {
        fov: 34,
        position: [3.1, 4.3, 8.5],
        lookAt: [0, 1.5, 1.25],
      },
    },
    wide: {
      establishing: {
        fov: 32,
        position: [0, 6.5, 12.8],
        lookAt: [0, 1.75, 0.7],
      },
      street: {
        fov: 31,
        position: [0, 5.5, 11.5],
        lookAt: [0, 1.4, 2.45],
      },
      purchase: {
        fov: 30,
        position: [3.2, 4, 7.8],
        lookAt: [0, 1.45, 1.15],
      },
    },
  };

  const composition = table[mode][shot];
  return Object.freeze({ mode, shot, ...composition });
};
