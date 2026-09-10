import { describe, expect, it } from "vitest";

import {
  UnaffordableDecisionError,
  basisPoints,
  classicAdvertisingMultiplier,
  classicPriceDemand,
  createInitialState,
  createSeededRandom,
  dayNumber,
  generateEnvironment,
  glassCount,
  moneyCents,
  neutralEnvironment,
  seed,
  signCount,
  simulateDay,
  type DayDecision,
  type DayEnvironment,
} from "../src/index.js";

const decision = (
  glasses: number,
  signs: number,
  priceCents: number,
): DayDecision =>
  Object.freeze({
    glasses: glassCount(glasses),
    signs: signCount(signs),
    price: moneyCents(priceCents),
  });

describe("classic demand rules", () => {
  it("preserves the Apple II reference-price curve", () => {
    expect(classicPriceDemand(moneyCents(10))).toBe(30);
    expect(classicPriceDemand(moneyCents(5))).toBe(42);
    expect(classicPriceDemand(moneyCents(20))).toBe(7.5);
  });

  it("makes advertising useful with diminishing returns", () => {
    const zero = classicAdvertisingMultiplier(signCount(0));
    const one = classicAdvertisingMultiplier(signCount(1));
    const two = classicAdvertisingMultiplier(signCount(2));
    const ten = classicAdvertisingMultiplier(signCount(10));

    expect(zero).toBe(1);
    expect(one).toBeGreaterThan(zero);
    expect(two - one).toBeLessThan(one - zero);
    expect(ten).toBeLessThan(2);
  });
});

describe("day resolution", () => {
  it("caps sales by prepared inventory and conserves cents", () => {
    const result = simulateDay(
      createInitialState(),
      decision(20, 1, 10),
      neutralEnvironment(),
    );

    expect(Number(result.entry.sold)).toBe(20);
    expect(Number(result.entry.revenue)).toBe(200);
    expect(Number(result.entry.expenses)).toBe(55);
    expect(Number(result.entry.net)).toBe(145);
    expect(Number(result.entry.endingCash)).toBe(345);
    expect(Number(result.nextState.cash)).toBe(
      Number(result.previousState.cash) + Number(result.entry.net),
    );
  });

  it("rejects spending that exceeds available cash", () => {
    expect(() =>
      simulateDay(createInitialState(), decision(100, 1, 10), neutralEnvironment()),
    ).toThrow(UnaffordableDecisionError);
  });

  it("keeps thunderstorms economically decisive without presentation timing", () => {
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

    const result = simulateDay(createInitialState(), decision(20, 3, 5), environment);
    expect(Number(result.entry.sold)).toBe(0);
  });

  it("models the worker sell-out event without bypassing affordability", () => {
    const environment: DayEnvironment = Object.freeze({
      weather: Object.freeze({
        kind: "cloudy",
        demandMultiplier: basisPoints(7_000),
      }),
      sentiment: Object.freeze({
        kind: "very-cold",
        demandMultiplier: basisPoints(8_500),
      }),
      event: Object.freeze({
        kind: "workers-buy-out",
        demandMultiplier: basisPoints(10_000),
      }),
    });

    const result = simulateDay(createInitialState(), decision(25, 0, 50), environment);
    expect(Number(result.entry.sold)).toBe(25);
    expect(Number(result.entry.potentialDemand)).toBeGreaterThanOrEqual(25);
  });

  it("applies the classic staged production-cost lesson", () => {
    const first = simulateDay(
      createInitialState(),
      decision(5, 0, 10),
      neutralEnvironment(),
    );
    const second = simulateDay(
      first.nextState,
      decision(5, 0, 10),
      neutralEnvironment(),
    );

    expect(Number(first.nextState.unitCost)).toBe(2);
    expect(Number(second.nextState.unitCost)).toBe(4);
  });

  it("holds accounting and inventory invariants across a decision grid", () => {
    const glassesValues = [0, 1, 5, 20, 50] as const;
    const signValues = [0, 1, 3] as const;
    const priceValues = [5, 10, 25] as const;

    for (const glasses of glassesValues) {
      for (const signs of signValues) {
        for (const price of priceValues) {
          const result = simulateDay(
            createInitialState(),
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
  it("protects the first two days with sunny weather", () => {
    const random = createSeededRandom(seed(123));
    expect(generateEnvironment(dayNumber(1), random).weather.kind).toBe("sunny");
    expect(generateEnvironment(dayNumber(2), random).weather.kind).toBe("sunny");
  });

  it("replays the same environment sequence from the same seed", () => {
    const left = createSeededRandom(seed(0x00c0_ffee));
    const right = createSeededRandom(seed(0x00c0_ffee));

    const leftSequence = Array.from({ length: 40 }, (_, index) =>
      generateEnvironment(dayNumber(index + 1), left),
    );
    const rightSequence = Array.from({ length: 40 }, (_, index) =>
      generateEnvironment(dayNumber(index + 1), right),
    );

    expect(leftSequence).toEqual(rightSequence);
  });
});
