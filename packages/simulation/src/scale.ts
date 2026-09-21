import type { GameState } from "./model.js";
import { legacyOperatingBalanceCents } from "./legacy.js";

export type OperatingScaleLevel = 1 | 2 | 3 | 4;

export type OperatingScaleRules = Readonly<{
  level: OperatingScaleLevel;
  maxGlasses: number;
  maxSigns: number;
  maxPriceCents: number;
}>;

export const OPERATING_SCALE_THRESHOLDS_CENTS = Object.freeze({
  level2: 10_000,
  level3: 50_000,
  level4: 500_000,
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

export const operatingScaleForBalance = (balanceCents: number): OperatingScaleRules => {
  if (!Number.isSafeInteger(balanceCents)) {
    throw new TypeError("operating balance must be a safe integer number of cents");
  }

  if (balanceCents < OPERATING_SCALE_THRESHOLDS_CENTS.level2) return RULES[1];
  if (balanceCents < OPERATING_SCALE_THRESHOLDS_CENTS.level3) return RULES[2];
  if (balanceCents < OPERATING_SCALE_THRESHOLDS_CENTS.level4) return RULES[3];
  return RULES[4];
};

export const operatingScaleForEquity = operatingScaleForBalance;

export const operatingScaleForState = (
  state: Pick<GameState, "ledger">,
): OperatingScaleRules =>
  operatingScaleForBalance(legacyOperatingBalanceCents(state));
