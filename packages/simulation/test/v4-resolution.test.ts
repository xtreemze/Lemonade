import { describe, expect, it } from "vitest";

import {
  basisPoints,
  createInitialState,
  glassCount,
  moneyCents,
  neutralEnvironment,
  neutralMarketMemory,
  seed,
  signCount,
  simulateDayV4,
  type DayDecision,
  type DayEnvironment,
} from "../src/index.js";

const decision = (glasses: number, signs: number, priceCents: number): DayDecision =>
  Object.freeze({
    glasses: glassCount(glasses),
    signs: signCount(signs),
    price: moneyCents(priceCents),
  });

const stormEnvironment = (): DayEnvironment => {
  const neutral = neutralEnvironment();
  return Object.freeze({
    weather: Object.freeze({
      kind: "thunderstorm",
      demandMultiplier: basisPoints(0),
    }),
    sentiment: neutral.sentiment,
    event: neutral.event,
  });
};

describe("v4 customer-funnel day resolution", () => {
  it("replays identical customer outcomes and accounting from identical inputs", () => {
    const state = createInitialState();
    const inputDecision = decision(5, 1, 150);
    const environment = neutralEnvironment();
    const runSeed = seed(0x12_34_56_78);
    const memory = neutralMarketMemory();

    const first = simulateDayV4(state, inputDecision, environment, runSeed, memory);
    const repeated = simulateDayV4(state, inputDecision, environment, runSeed, memory);

    expect(repeated).toEqual(first);
    expect(first.market.rulesetVersion).toBe(4);
    expect(first.market.summary.purchased).toBe(Number(first.entry.sold));
    expect(first.market.summary.willing).toBe(
      first.market.summary.purchased + first.market.summary.stockout,
    );
    expect(first.market.summary.audience).toBe(
      first.market.summary.unaware + first.market.summary.aware,
    );
    expect(first.market.summary.aware).toBe(
      first.market.summary.priceRejected + first.market.summary.willing,
    );
    expect(Number(first.entry.revenue)).toBe(
      Number(first.entry.sold) * Number(inputDecision.price),
    );
  });

  it("fulfills willing customers deterministically up to prepared inventory", () => {
    const result = simulateDayV4(
      Object.freeze({ ...createInitialState(), cash: moneyCents(10_000) }),
      decision(1, 3, 100),
      neutralEnvironment(),
      seed(0x00_c0_ff_ee),
      neutralMarketMemory(),
    );

    expect(result.market.summary.purchased).toBeLessThanOrEqual(1);
    expect(Number(result.entry.sold)).toBe(result.market.summary.purchased);
    expect(result.market.outcomes.filter((outcome) => outcome.fulfillment.kind === "purchased"))
      .toHaveLength(result.market.summary.purchased);
    expect(result.market.outcomes.filter((outcome) => outcome.fulfillment.kind === "stockout"))
      .toHaveLength(result.market.summary.stockout);

    const saleIndices = result.market.outcomes
      .filter((outcome) => outcome.fulfillment.kind === "purchased")
      .map((outcome) => (outcome.fulfillment.kind === "purchased" ? outcome.fulfillment.saleIndex : -1));
    expect(saleIndices).toEqual(saleIndices.map((_, index) => index));
  });

  it("uses customer weather tolerance instead of the legacy population multiplier", () => {
    const state = Object.freeze({ ...createInitialState(), cash: moneyCents(10_000) });
    const inputDecision = decision(5, 3, 150);
    const runSeed = seed(919_191);
    const memory = neutralMarketMemory();

    const sunny = simulateDayV4(
      state,
      inputDecision,
      neutralEnvironment(),
      runSeed,
      memory,
    );
    const storm = simulateDayV4(
      state,
      inputDecision,
      stormEnvironment(),
      runSeed,
      memory,
    );

    expect(storm.market.audience.customerIds).toEqual(sunny.market.audience.customerIds);
    expect(storm.market.summary.audience).toBe(sunny.market.summary.audience);
    expect(storm.market.outcomes.map((outcome) => outcome.id)).toEqual(
      sunny.market.outcomes.map((outcome) => outcome.id),
    );
  });

  it("updates compact market memory from the authoritative funnel", () => {
    const memory = neutralMarketMemory();
    const result = simulateDayV4(
      Object.freeze({ ...createInitialState(), cash: moneyCents(10_000) }),
      decision(0, 3, 250),
      neutralEnvironment(),
      seed(77),
      memory,
    );

    expect(result.market.memoryBefore).toEqual(memory);
    expect(Number(result.market.memoryAfter.expectedPrice)).toBe(250);
    expect(Number(result.market.memoryAfter.advertisingFatigue)).toBeGreaterThan(0);
    if (result.market.summary.willing > 0) {
      expect(Number(result.market.memoryAfter.stockoutPressure)).toBeGreaterThan(0);
    }
    expect(Number(result.market.memoryAfter.satisfaction)).toBeGreaterThanOrEqual(0);
    expect(Number(result.market.memoryAfter.satisfaction)).toBeLessThanOrEqual(10_000);
  });

  it("keeps customer outcomes exhaustive and internally consistent", () => {
    const result = simulateDayV4(
      Object.freeze({ ...createInitialState(), cash: moneyCents(10_000) }),
      decision(5, 2, 200),
      neutralEnvironment(),
      seed(2026),
      neutralMarketMemory(),
    );

    expect(result.market.outcomes).toHaveLength(result.market.summary.audience);

    for (const outcome of result.market.outcomes) {
      if (outcome.awareness.kind === "unaware") {
        expect(outcome.conversion.kind).toBe("not-evaluated");
        expect(outcome.fulfillment.kind).toBe("none");
      } else if (outcome.conversion.kind === "price-rejected") {
        expect(outcome.fulfillment.kind).toBe("none");
      } else {
        expect(["purchased", "stockout"]).toContain(outcome.fulfillment.kind);
      }
    }
  });
});
