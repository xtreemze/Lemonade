import { describe, expect, it } from "vitest";

import {
  basisPoints,
  createInitialState,
  createSeededRandom,
  type DayDecision,
  type DayEnvironment,
  dayNumber,
  generateEnvironment,
  glassCount,
  legacyConfidenceForState,
  legacyMarketingEffect,
  moneyCents,
  neutralEnvironment,
  potentialDemand,
  seed,
  signCount,
  simulateDay,
  UnaffordableDecisionError,
} from "../src/index.js";

const decision = (glasses: number, signs: number, priceCents: number): DayDecision =>
  Object.freeze({
    glasses: glassCount(glasses),
    signs: signCount(signs),
    price: moneyCents(priceCents),
  });

describe("2017 demand rules", () => {
  it("preserves the original signs-squared/log advertising term", () => {
    expect(legacyMarketingEffect(signCount(0))).toBe(0);
    expect(legacyMarketingEffect(signCount(1))).toBeCloseTo(1 / Math.log(2));
    expect(legacyMarketingEffect(signCount(3))).toBeCloseTo(9 / Math.log(4));
  });

  it("uses inverse price continuously without an arbitrary 10-cent breakpoint", () => {
    const environment = neutralEnvironment();
    const confidence = 3;

    expect(Number(potentialDemand(moneyCents(150), signCount(1), confidence, environment))).toBe(
      50,
    );
    expect(Number(potentialDemand(moneyCents(300), signCount(1), confidence, environment))).toBe(
      25,
    );
    expect(Number(potentialDemand(moneyCents(600), signCount(1), confidence, environment))).toBe(
      12,
    );
  });

  it("starts with the historical confidence value", () => {
    expect(legacyConfidenceForState(createInitialState())).toBe(3);
  });

  it("preserves the original first-day confidence behavior", () => {
    const profitable = simulateDay(createInitialState(), decision(5, 1, 150), neutralEnvironment());
    expect(legacyConfidenceForState(profitable.nextState)).toBe(1);

    const zeroProfit = simulateDay(createInitialState(), decision(0, 0, 150), neutralEnvironment());
    expect(legacyConfidenceForState(zeroProfit.nextState)).toBe(2);
  });
});

describe("day resolution", () => {
  it("caps sales by prepared inventory and conserves cents", () => {
    const result = simulateDay(createInitialState(), decision(5, 1, 150), neutralEnvironment());

    expect(Number(result.entry.sold)).toBe(5);
    expect(Number(result.entry.revenue)).toBe(750);
    expect(Number(result.entry.expenses)).toBe(550);
    expect(Number(result.entry.net)).toBe(200);
    expect(Number(result.entry.endingCash)).toBe(1200);
    expect(Number(result.nextState.cash)).toBe(
      Number(result.previousState.cash) + Number(result.entry.net),
    );
  });

  it("rejects spending that exceeds available cash inside the unlocked envelope", () => {
    const cashPoorState = Object.freeze({
      ...createInitialState(),
      cash: moneyCents(100),
    });
    expect(() => simulateDay(cashPoorState, decision(2, 0, 150), neutralEnvironment())).toThrow(
      UnaffordableDecisionError,
    );
  });

  it("preserves the 2017 storm variant as reduced rather than zero demand", () => {
    const environment: DayEnvironment = Object.freeze({
      weather: Object.freeze({
        kind: "thunderstorm",
        demandMultiplier: basisPoints(0),
      }),
      sentiment: Object.freeze({
        kind: "hot",
        demandMultiplier: basisPoints(11_500),
      }),
      event: Object.freeze({
        kind: "none",
        demandMultiplier: basisPoints(10_000),
      }),
    });

    const result = simulateDay(createInitialState(), decision(5, 3, 150), environment);
    expect(Number(result.entry.sold)).toBeGreaterThan(0);
  });

  it("does not let later presentation events override 2017 demand", () => {
    const environment: DayEnvironment = Object.freeze({
      weather: Object.freeze({
        kind: "cloudy",
        demandMultiplier: basisPoints(7000),
      }),
      sentiment: Object.freeze({
        kind: "very-cold",
        demandMultiplier: basisPoints(8500),
      }),
      event: Object.freeze({
        kind: "workers-buy-out",
        demandMultiplier: basisPoints(10_000),
      }),
    });

    const result = simulateDay(createInitialState(), decision(5, 0, 150), environment);
    expect(Number(result.entry.sold)).toBe(4);
    expect(Number(result.entry.potentialDemand)).toBe(4);
  });

  it("keeps the 2017 one-dollar cup cost constant", () => {
    const first = simulateDay(createInitialState(), decision(5, 0, 150), neutralEnvironment());
    const second = simulateDay(first.nextState, decision(5, 0, 150), neutralEnvironment());

    expect(Number(first.nextState.unitCost)).toBe(100);
    expect(Number(second.nextState.unitCost)).toBe(100);
  });

  it("holds accounting and inventory invariants across a decision grid", () => {
    const fundedState = Object.freeze({
      ...createInitialState(),
      cash: moneyCents(5000),
    });
    const glassesValues = [0, 1, 5, 10] as const;
    const signValues = [0, 1, 3] as const;
    const priceValues = [100, 150, 250] as const;

    for (const glasses of glassesValues) {
      for (const signs of signValues) {
        for (const price of priceValues) {
          const result = simulateDay(
            fundedState,
            decision(glasses, signs, price),
            neutralEnvironment(),
          );

          expect(Number(result.entry.sold)).toBeLessThanOrEqual(glasses);
          expect(Number(result.entry.revenue)).toBe(Number(result.entry.sold) * price);
          expect(Number(result.entry.endingCash)).toBe(
            Number(result.previousState.cash) + Number(result.entry.net),
          );
        }
      }
    }
  });
});

describe("deterministic environment generation", () => {
  it("starts day one sunny, then uses the 2017 four-variant weather draw", () => {
    const random = createSeededRandom(seed(123));
    expect(generateEnvironment(dayNumber(1), random).weather.kind).toBe("sunny");
    expect(["thunderstorm", "cloudy", "hot-and-dry", "sunny"]).toContain(
      generateEnvironment(dayNumber(2), random).weather.kind,
    );
  });

  it("replays the same environment sequence from the same seed", () => {
    const left = createSeededRandom(seed(0x00_c0_ff_ee));
    const right = createSeededRandom(seed(0x00_c0_ff_ee));

    const leftSequence = Array.from({ length: 40 }, (_, index) =>
      generateEnvironment(dayNumber(index + 1), left),
    );
    const rightSequence = Array.from({ length: 40 }, (_, index) =>
      generateEnvironment(dayNumber(index + 1), right),
    );

    expect(leftSequence).toEqual(rightSequence);
  });
});
