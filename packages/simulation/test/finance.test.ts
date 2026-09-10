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
    unitCost: moneyCents(day <= 2 ? 2 : day <= 6 ? 4 : 5),
  });

describe("finance progression", () => {
  it("unlocks finance complexity from business equity without adding decision variables", () => {
    expect(progressionTierForEquity(0)).toBe(0);
    expect(progressionTierForEquity(500)).toBe(1);
    expect(progressionTierForEquity(2_000)).toBe(2);
    expect(progressionTierForEquity(5_000)).toBe(3);
    expect(progressionTierForEquity(10_000)).toBe(4);

    expect(Number(financeRulesForTier(0).creditLimit)).toBe(0);
    expect(Number(financeRulesForTier(3).creditLimit)).toBeGreaterThan(0);
  });

  it("advances the stored tier when ending equity crosses a threshold", () => {
    const result = simulateDay(
      stateFor(6, 0, 440),
      decision(10, 0, 10),
      neutralEnvironment(),
    );

    expect(Number(result.entry.endingCash)).toBe(500);
    expect(result.entry.tier).toBe(0);
    expect(result.nextState.tier).toBe(1);
  });

  it("adds supplier fees before taxes", () => {
    const result = simulateDay(
      stateFor(7, 1, 1_000),
      decision(10, 0, 10),
      neutralEnvironment(),
    );

    expect(Number(result.entry.expenses)).toBe(55);
    expect(Number(result.entry.net)).toBe(45);
    expect(result.entry.lines.some((line) => line.kind === "operating-fee")).toBe(true);
    expect(result.entry.lines.some((line) => line.kind === "tax")).toBe(false);
  });

  it("taxes only positive operating profit", () => {
    const profit = simulateDay(
      stateFor(14, 2, 1_000),
      decision(10, 0, 10),
      neutralEnvironment(),
    );
    const loss = simulateDay(
      stateFor(14, 2, 1_000),
      decision(10, 0, 1),
      neutralEnvironment(),
    );

    const profitTax = profit.entry.lines.find((line) => line.kind === "tax");
    expect(Number(profitTax?.amount ?? 0)).toBe(2);
    expect(loss.entry.lines.some((line) => line.kind === "tax")).toBe(false);
  });

  it("uses working-capital credit automatically when the three-control plan exceeds cash", () => {
    const state = stateFor(21, 3, 5);
    expect(Number(availableOperatingFunds(state))).toBe(505);

    const result = simulateDay(state, decision(10, 0, 10), neutralEnvironment());

    expect(Number(result.entry.borrowed)).toBe(60);
    expect(Number(result.entry.endingLoanBalance)).toBe(60);
    expect(Number(result.entry.endingCash)).toBe(97);
    expect(result.entry.lines.some((line) => line.kind === "loan-draw")).toBe(true);
  });

  it("charges loan interest without counting principal as an expense", () => {
    const result = simulateDay(
      stateFor(21, 3, 100, 500),
      decision(0, 0, 10),
      neutralEnvironment(),
    );

    const interest = result.entry.lines.find((line) => line.kind === "loan-interest");
    expect(Number(interest?.amount ?? 0)).toBe(2);
    expect(Number(result.entry.expenses)).toBe(17);
    expect(Number(result.entry.borrowed)).toBe(0);
  });

  it("credits savings interest only when no loan remains", () => {
    const result = simulateDay(
      stateFor(21, 3, 1_000),
      decision(0, 0, 10),
      neutralEnvironment(),
    );

    expect(Number(result.entry.financeIncome)).toBe(1);
    expect(Number(result.entry.net)).toBe(-14);
    expect(Number(result.entry.endingCash)).toBe(986);
    expect(result.entry.lines.some((line) => line.kind === "savings-interest")).toBe(true);
  });

  it("conserves business equity across operating and financing flows", () => {
    const states = [
      stateFor(14, 2, 1_000),
      stateFor(21, 3, 5),
      stateFor(21, 3, 100, 500),
      stateFor(35, 4, 750, 250),
    ] as const;

    for (const state of states) {
      const result = simulateDay(state, decision(10, 0, 10), neutralEnvironment());
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
