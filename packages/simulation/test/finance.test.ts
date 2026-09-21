import { describe, expect, it } from "vitest";

import {
  availableOperatingFunds,
  createInitialState,
  dayNumber,
  financeRulesForTier,
  glassCount,
  moneyCents,
  neutralEnvironment,
  progressionTierForEquity,
  signCount,
  simulateDay,
  type DayDecision,
  type GameState,
  type ProgressionTier,
} from "../src/index.js";

const decision = (glasses: number, signs: number, price: number): DayDecision =>
  Object.freeze({
    glasses: glassCount(glasses),
    signs: signCount(signs),
    price: moneyCents(price),
  });

const stateFor = (
  day: number,
  tier: ProgressionTier,
  cash: number,
  loanBalance = 0,
): GameState =>
  Object.freeze({
    ...createInitialState(),
    day: dayNumber(day),
    tier,
    cash: moneyCents(cash),
    loanBalance: moneyCents(loanBalance),
    unitCost: moneyCents(100),
  });

describe("finance progression", () => {
  it("unlocks finance complexity from business equity without adding decision variables", () => {
    expect(progressionTierForEquity(0)).toBe(0);
    expect(progressionTierForEquity(10_000)).toBe(1);
    expect(progressionTierForEquity(50_000)).toBe(2);
    expect(progressionTierForEquity(500_000)).toBe(3);
    expect(progressionTierForEquity(1_000_000)).toBe(4);

    expect(Number(financeRulesForTier(0).creditLimit)).toBe(0);
    expect(Number(financeRulesForTier(3).creditLimit)).toBeGreaterThan(0);
  });

  it("advances finance only after the historical first scale threshold", () => {
    const result = simulateDay(
      stateFor(6, 0, 9_900),
      decision(1, 0, 250),
      neutralEnvironment(),
    );

    expect(Number(result.entry.endingCash)).toBe(10_050);
    expect(result.entry.tier).toBe(0);
    expect(result.nextState.tier).toBe(1);
  });

  it("adds supplier fees before taxes", () => {
    const result = simulateDay(
      stateFor(7, 1, 20_000),
      decision(1, 0, 250),
      neutralEnvironment(),
    );

    expect(Number(result.entry.expenses)).toBe(105);
    expect(Number(result.entry.net)).toBe(145);
    expect(result.entry.lines.some((line) => line.kind === "operating-fee")).toBe(true);
    expect(result.entry.lines.some((line) => line.kind === "tax")).toBe(false);
  });

  it("taxes only positive operating profit", () => {
    const profit = simulateDay(
      stateFor(14, 2, 60_000),
      decision(1, 0, 250),
      neutralEnvironment(),
    );
    const loss = simulateDay(
      stateFor(14, 2, 60_000),
      decision(1, 0, 50),
      neutralEnvironment(),
    );

    const profitTax = profit.entry.lines.find((line) => line.kind === "tax");
    expect(Number(profitTax?.amount ?? 0)).toBe(7);
    expect(loss.entry.lines.some((line) => line.kind === "tax")).toBe(false);
  });

  it("uses working-capital credit automatically when the three-control plan exceeds cash", () => {
    const state = stateFor(21, 3, 50);
    expect(Number(availableOperatingFunds(state))).toBe(550);

    const result = simulateDay(state, decision(5, 0, 250), neutralEnvironment());

    expect(Number(result.entry.borrowed)).toBeGreaterThan(0);
    expect(Number(result.entry.endingLoanBalance)).toBeGreaterThanOrEqual(0);
    expect(Number(result.entry.endingCash)).toBeGreaterThanOrEqual(0);
    expect(result.entry.lines.some((line) => line.kind === "loan-draw")).toBe(true);
  });

  it("charges loan interest without counting principal as an expense", () => {
    const result = simulateDay(
      stateFor(21, 3, 100, 500),
      decision(0, 0, 150),
      neutralEnvironment(),
    );

    const interest = result.entry.lines.find((line) => line.kind === "loan-interest");
    expect(Number(interest?.amount ?? 0)).toBe(2);
    expect(Number(result.entry.expenses)).toBe(17);
    expect(Number(result.entry.borrowed)).toBe(0);
  });

  it("credits savings interest only when no loan remains", () => {
    const result = simulateDay(
      stateFor(21, 3, 100_000),
      decision(0, 0, 150),
      neutralEnvironment(),
    );

    expect(Number(result.entry.financeIncome)).toBeGreaterThan(0);
    expect(Number(result.entry.net)).toBeGreaterThan(-20);
    expect(Number(result.entry.endingCash)).toBeGreaterThan(99_000);
    expect(result.entry.lines.some((line) => line.kind === "savings-interest")).toBe(true);
  });

  it("conserves business equity across operating and financing flows", () => {
    const states = [
      stateFor(14, 2, 60_000),
      stateFor(21, 3, 50),
      stateFor(21, 3, 1_000, 500),
      stateFor(35, 4, 20_000, 250),
    ] as const;

    for (const state of states) {
      const result = simulateDay(state, decision(1, 0, 250), neutralEnvironment());
      const openingEquity = Number(state.cash) - Number(state.loanBalance);
      const endingEquity =
        Number(result.entry.endingCash) - Number(result.entry.endingLoanBalance);

      expect(endingEquity).toBe(openingEquity + Number(result.entry.net));
      expect(Number(result.entry.cashDelta)).toBe(
        Number(result.entry.endingCash) - Number(state.cash),
      );
    }
  });
});
