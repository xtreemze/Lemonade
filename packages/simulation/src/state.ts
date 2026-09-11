import type { GameState } from "./model.js";
import { dayNumber, moneyCents, type DayNumber, type MoneyCents } from "./primitives.js";

export const productionCostForDay = (day: DayNumber): MoneyCents => {
  const dayValue = Number(day);
  if (dayValue <= 2) return moneyCents(2);
  if (dayValue <= 6) return moneyCents(4);
  return moneyCents(5);
};

export const createInitialState = (): GameState =>
  Object.freeze({
    day: dayNumber(1),
    cash: moneyCents(200),
    loanBalance: moneyCents(0),
    unitCost: moneyCents(2),
    signCost: moneyCents(15),
    tier: 0,
    ledger: Object.freeze([]),
  });
