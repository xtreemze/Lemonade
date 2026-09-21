import type { GameState } from "./model.js";
import {
  LEGACY_CUP_COST_CENTS,
  LEGACY_SIGN_COST_CENTS,
  LEGACY_STARTING_BALANCE_CENTS,
} from "./legacy.js";
import { dayNumber, moneyCents, type DayNumber, type MoneyCents } from "./primitives.js";

export const productionCostForDay = (day: DayNumber): MoneyCents => {
  if (Number(day) < 1) throw new RangeError("day must be positive");
  return moneyCents(LEGACY_CUP_COST_CENTS);
};

export const createInitialState = (): GameState =>
  Object.freeze({
    day: dayNumber(1),
    cash: moneyCents(LEGACY_STARTING_BALANCE_CENTS),
    loanBalance: moneyCents(0),
    unitCost: moneyCents(LEGACY_CUP_COST_CENTS),
    signCost: moneyCents(LEGACY_SIGN_COST_CENTS),
    tier: 0,
    ledger: Object.freeze([]),
  });
