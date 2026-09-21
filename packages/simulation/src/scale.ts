import type { GameState } from "./model.js";

export type OperatingScaleLevel = 1 | 2 | 3 | 4;

export type OperatingScaleRules = Readonly<{
  level: OperatingScaleLevel;
  maxGlasses: number;
  maxSigns: number;
  maxPriceCents: number;
}>;

/**
 * The historical browser game started with $10 of assets and widened its
 * decision ranges at $100, $500, and $5,000: 10x, 50x, and 500x starting
 * capital. The modern simulation starts with $2, so preserve those progression
 * ratios in the current cents-based economy rather than copying incompatible
 * absolute dollar thresholds.
 */
export const OPERATING_SCALE_THRESHOLDS_CENTS = Object.freeze({
  level2: 2_000,
  level3: 10_000,
  level4: 100_000,
});

const RULES: Readonly<Record<OperatingScaleLevel, OperatingScaleRules>> = Object.freeze({
  1: Object.freeze({
    level: 1,
    maxGlasses: 15,
    maxSigns: 3,
    maxPriceCents: 299,
  }),
  2: Object.freeze({
    level: 2,
    maxGlasses: 50,
    maxSigns: 10,
    maxPriceCents: 399,
  }),
  3: Object.freeze({
    level: 3,
    maxGlasses: 140,
    maxSigns: 25,
    maxPriceCents: 699,
  }),
  4: Object.freeze({
    level: 4,
    maxGlasses: 400,
    maxSigns: 40,
    maxPriceCents: 999,
  }),
});

export const operatingScaleForEquity = (equityCents: number): OperatingScaleRules => {
  if (!Number.isSafeInteger(equityCents)) {
    throw new TypeError("equity must be a safe integer number of cents");
  }

  if (equityCents < OPERATING_SCALE_THRESHOLDS_CENTS.level2) return RULES[1];
  if (equityCents < OPERATING_SCALE_THRESHOLDS_CENTS.level3) return RULES[2];
  if (equityCents < OPERATING_SCALE_THRESHOLDS_CENTS.level4) return RULES[3];
  return RULES[4];
};

export const operatingScaleForState = (
  state: Pick<GameState, "cash" | "loanBalance">,
): OperatingScaleRules =>
  operatingScaleForEquity(Number(state.cash) - Number(state.loanBalance));
