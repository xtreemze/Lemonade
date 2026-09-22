import type {
  PasserbyBeat,
  SaleBeat,
  SceneShot,
  StreetDirection,
  StreetStoryboard,
} from "./storyboard.js";

export type StreetStoryboardInput = Readonly<{
  durationMs: number;
  prepared: number;
  sold: number;
  visibleSigns: number;
  priceCents: number;
  ambientPedestrianCount: number;
}>;

export const MAX_STORYBOARD_CUPS = 400 as const;
export const MAX_STORYBOARD_SIGNS = 40 as const;
export const ACTIVE_STREET_DURATION_MS = 10_000 as const;
export const ENDING_CLOSEUP_DURATION_MS = 4_000 as const;
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

const createShots = (
  durationMs: number,
  activeDurationMs: number,
): readonly SceneShot[] =>
  Object.freeze([
    Object.freeze({ kind: "stand", startAtMs: 0, endAtMs: activeDurationMs }),
    Object.freeze({ kind: "remaining", startAtMs: activeDurationMs, endAtMs: durationMs }),
  ]);

export const createStreetStoryboard = (input: StreetStoryboardInput): StreetStoryboard => {
  const durationMs = Math.max(1, finiteInteger(input.durationMs, 1));
  const minimumActiveDurationMs = Math.min(
    ACTIVE_STREET_DURATION_MS,
    durationMs,
  );
  const closeupDurationMs = Math.min(
    ENDING_CLOSEUP_DURATION_MS,
    Math.max(0, durationMs - minimumActiveDurationMs),
  );
  const activeDurationMs = durationMs - closeupDurationMs;
  const prepared = clampInteger(input.prepared, 0, MAX_STORYBOARD_CUPS);
  const sold = clampInteger(input.sold, 0, prepared);
  const visibleSigns = clampInteger(input.visibleSigns, 0, MAX_STORYBOARD_SIGNS);
  const priceCents = clampInteger(input.priceCents, 0, MAX_PRICE_CENTS);
  const ambientPedestrianCount = Math.max(1, finiteInteger(input.ambientPedestrianCount, 1));
  const passerbyCount = Math.max(sold + 1, ambientPedestrianCount + visibleSigns * 2);
  const advertisementRatio =
    visibleSigns === 0 ? 0 : Math.min(0.5, 0.12 + visibleSigns * 0.02);
  const adViewerCount =
    visibleSigns === 0
      ? 0
      : Math.min(passerbyCount, Math.max(1, Math.ceil(passerbyCount * advertisementRatio)));

  const purchaseWindowStart = Math.round(activeDurationMs * 0.12);
  const purchaseWindowEnd = Math.round(activeDurationMs * 0.72);
  const approachTravelMs = Math.min(650, Math.max(240, activeDurationMs * 0.09));
  const purchaseDurationMs = Math.min(220, Math.max(130, activeDurationMs * 0.028));
  const drinkDurationMs = Math.min(430, Math.max(240, activeDurationMs * 0.055));
  const departTravelMs = Math.min(650, Math.max(240, activeDurationMs * 0.09));

  const sales = Array.from({ length: sold }, (_, index): SaleBeat => {
    const purchaseAtMs =
      sold === 1
        ? Math.round(activeDurationMs * 0.48)
        : Math.round(
            purchaseWindowStart +
              ((purchaseWindowEnd - purchaseWindowStart) * index) / Math.max(1, sold - 1),
          );
    const purchaseEndAtMs = Math.min(
      activeDurationMs,
      Math.round(purchaseAtMs + purchaseDurationMs),
    );
    const drinkEndAtMs = Math.min(
      activeDurationMs,
      Math.round(purchaseEndAtMs + drinkDurationMs),
    );
    return Object.freeze({
      saleNumber: index + 1,
      buyerIndex: index,
      approachAtMs: Math.max(0, Math.round(purchaseAtMs - approachTravelMs)),
      purchaseAtMs,
      purchaseEndAtMs,
      drinkEndAtMs,
      departAtMs: Math.min(activeDurationMs, Math.round(drinkEndAtMs + departTravelMs)),
      direction: saleDirection(index),
      lane: index % 3,
      remainingCups: prepared - index - 1,
    });
  });

  const crossingDurationMs = Math.min(
    activeDurationMs,
    Math.max(1_100, activeDurationMs * 0.42),
  );
  const passersBy = Array.from({ length: passerbyCount }, (_, index): PasserbyBeat => {
    const centerAtMs = (activeDurationMs * (index + 0.5)) / passerbyCount;
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
    activeDurationMs,
    prepared,
    sold,
    visibleSigns,
    priceCents,
    priceLabel: formatPriceLabel(priceCents),
    shots: createShots(durationMs, activeDurationMs),
    sales: Object.freeze(sales),
    passersBy: Object.freeze(passersBy),
    adViewerCount,
  });
};
