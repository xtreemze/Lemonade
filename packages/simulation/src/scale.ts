import type { GameState } from "./model.js";

export type OperatingScaleLevel = 1 | 2 | 3 | 4;

export type OperatingScaleRules = Readonly<{
  level: OperatingScaleLevel;
  maxGlasses: number;
  maxSigns: number;
  maxPriceCents: number;
}>;

/**
 * The historical browser game widened the three decision ranges as the stand
 * accumulated capital. Its dollar thresholds belonged to a different economy
 * (notably $1 production cost and dollar-scale prices), so copying those
 * absolute amounts or ratios into the Apple-II-derived cents economy stalls
 * progression. These milestones are balance-certified for the modern ruleset:
 * early expansion at $5, meaningful scale at $20, and mature scale at $100.
 * The historical slider ceilings themselves remain exact.
 */
export const OPERATING_SCALE_THRESHOLDS_CENTS = Object.freeze({
  level2: 500,
  level3: 2_000,
  level4: 10_000,
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
