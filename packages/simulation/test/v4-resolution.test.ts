import { describe, expect, it } from "vitest";

import {
  basisPoints,
  createInitialState,
  dayNumber,
  DecisionOutsideOperatingScaleError,
  glassCount,
  moneyCents,
  neutralEnvironment,
  neutralMarketMemory,
  OPERATING_SCALE_THRESHOLDS_CENTS,
  seed,
  signCount,
  signedMoneyCents,
  simulateDayV4,
  UnaffordableDecisionError,
  type DailyLedgerEntry,
  type DayDecision,
  type DayEnvironment,
  type GameState,
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


const stateAtScale = (level: 1 | 2 | 3 | 4): GameState => {
  const initial = createInitialState();
  if (level === 1) {
    return Object.freeze({ ...initial, cash: moneyCents(1_000_000) });
  }

  const targetBalance =
    level === 2
      ? OPERATING_SCALE_THRESHOLDS_CENTS.level2
      : level === 3
        ? OPERATING_SCALE_THRESHOLDS_CENTS.level3
        : OPERATING_SCALE_THRESHOLDS_CENTS.level4;
  const operatingProfit = targetBalance - 1000;
  const historicalEntry: DailyLedgerEntry = Object.freeze({
    day: dayNumber(1),
    tier: 0,
    decision: decision(1, 0, operatingProfit),
    environment: neutralEnvironment(),
    potentialDemand: glassCount(1),
    sold: glassCount(1),
    revenue: moneyCents(operatingProfit),
    financeIncome: moneyCents(0),
    expenses: moneyCents(0),
    net: signedMoneyCents(operatingProfit),
    cashDelta: signedMoneyCents(operatingProfit),
    borrowed: moneyCents(0),
    repaid: moneyCents(0),
    endingCash: moneyCents(targetBalance),
    endingLoanBalance: moneyCents(0),
    lines: Object.freeze([
      Object.freeze({
        kind: "revenue" as const,
        label: "Historical scale fixture",
        amount: moneyCents(operatingProfit),
        direction: "credit" as const,
      }),
    ]),
  });

  return Object.freeze({
    ...initial,
    day: dayNumber(2),
    cash: moneyCents(1_000_000),
    ledger: Object.freeze([historicalEntry]),
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



  it("rejects invalid decisions before resolving the market funnel", () => {
    expect(() =>
      simulateDayV4(
        createInitialState(),
        decision(5, 1, 0),
        neutralEnvironment(),
        seed(1),
        neutralMarketMemory(),
      ),
    ).toThrow("price must be greater than zero");

    expect(() =>
      simulateDayV4(
        createInitialState(),
        decision(16, 1, 150),
        neutralEnvironment(),
        seed(2),
        neutralMarketMemory(),
      ),
    ).toThrow(DecisionOutsideOperatingScaleError);

    const cashPoor = Object.freeze({
      ...createInitialState(),
      cash: moneyCents(100),
    });
    expect(() =>
      simulateDayV4(
        cashPoor,
        decision(2, 0, 150),
        neutralEnvironment(),
        seed(3),
        neutralMarketMemory(),
      ),
    ).toThrow(UnaffordableDecisionError);
  });

  it("turns willing customers into stockouts when no inventory is prepared", () => {
    const result = simulateDayV4(
      stateAtScale(1),
      decision(0, 3, 100),
      neutralEnvironment(),
      seed(0x00_ab_cd_ef),
      neutralMarketMemory(),
    );

    expect(result.market.summary.purchased).toBe(0);
    expect(Number(result.entry.sold)).toBe(0);
    expect(Number(result.entry.revenue)).toBe(0);
    expect(result.market.summary.stockout).toBe(result.market.summary.willing);
    expect(
      result.market.outcomes.some((outcome) => outcome.fulfillment.kind === "stockout"),
    ).toBe(result.market.summary.willing > 0);
  });

  it("never invents advertising awareness when the player bought no signs", () => {
    const result = simulateDayV4(
      stateAtScale(1),
      decision(5, 0, 150),
      neutralEnvironment(),
      seed(404),
      neutralMarketMemory(),
    );

    expect(result.market.summary.advertisingAware).toBe(0);
    expect(
      result.market.outcomes.some((outcome) => outcome.awareness.kind === "advertising"),
    ).toBe(false);
  });

  it("accepts the exact maximum decision envelope at every operating scale", () => {
    const envelopes = [
      Object.freeze({ level: 1 as const, glasses: 15, signs: 3, price: 299 }),
      Object.freeze({ level: 2 as const, glasses: 50, signs: 10, price: 399 }),
      Object.freeze({ level: 3 as const, glasses: 140, signs: 25, price: 699 }),
      Object.freeze({ level: 4 as const, glasses: 400, signs: 40, price: 999 }),
    ];

    for (const envelope of envelopes) {
      const result = simulateDayV4(
        stateAtScale(envelope.level),
        decision(envelope.glasses, envelope.signs, envelope.price),
        neutralEnvironment(),
        seed(1000 + envelope.level),
        neutralMarketMemory(),
      );

      expect(Number(result.entry.decision.glasses)).toBe(envelope.glasses);
      expect(Number(result.entry.decision.signs)).toBe(envelope.signs);
      expect(Number(result.entry.decision.price)).toBe(envelope.price);
      expect(Number(result.entry.sold)).toBeLessThanOrEqual(envelope.glasses);
      expect(result.market.summary.audience).toBeGreaterThan(0);
    }
  });

  it("does not create stockouts when prepared inventory exactly covers willing demand", () => {
    const state = stateAtScale(1);
    const environment = neutralEnvironment();
    const memory = neutralMarketMemory();
    let exactResult: ReturnType<typeof simulateDayV4> | undefined;

    for (let value = 1; value <= 128 && exactResult === undefined; value += 1) {
      const runSeed = seed(value);
      const probe = simulateDayV4(state, decision(15, 0, 299), environment, runSeed, memory);
      if (probe.market.summary.willing > 0 && probe.market.summary.willing <= 15) {
        exactResult = simulateDayV4(
          state,
          decision(probe.market.summary.willing, 0, 299),
          environment,
          runSeed,
          memory,
        );
      }
    }

    expect(exactResult).toBeDefined();
    if (exactResult === undefined) {
      return;
    }
    expect(exactResult.market.summary.stockout).toBe(0);
    expect(exactResult.market.summary.purchased).toBe(exactResult.market.summary.willing);
    expect(Number(exactResult.entry.sold)).toBe(exactResult.market.summary.willing);
  });


  it("carries market memory explicitly across consecutive v4 days", () => {
    const runSeed = seed(0x55_aa_55_aa);
    const first = simulateDayV4(
      stateAtScale(1),
      decision(10, 3, 200),
      neutralEnvironment(),
      runSeed,
      neutralMarketMemory(),
    );
    const second = simulateDayV4(
      first.nextState,
      decision(10, 0, 200),
      neutralEnvironment(),
      runSeed,
      first.market.memoryAfter,
    );

    expect(second.market.memoryBefore).toEqual(first.market.memoryAfter);
    expect(Number(first.market.memoryAfter.advertisingFatigue)).toBeGreaterThan(0);
    expect(Number(second.market.memoryAfter.advertisingFatigue)).toBeLessThan(
      Number(first.market.memoryAfter.advertisingFatigue),
    );
    expect(Number(second.market.memoryAfter.expectedPrice)).toBe(200);
  });

  it("keeps recurring customer core identity stable across days", () => {
    const runSeed = seed(0x13_57_9b_df);
    const first = simulateDayV4(
      stateAtScale(2),
      decision(20, 2, 200),
      neutralEnvironment(),
      runSeed,
      neutralMarketMemory(),
    );
    const second = simulateDayV4(
      first.nextState,
      decision(20, 2, 200),
      neutralEnvironment(),
      runSeed,
      first.market.memoryAfter,
    );

    const firstById = new Map(first.market.outcomes.map((outcome) => [Number(outcome.id), outcome]));
    const recurring = second.market.outcomes.filter((outcome) => firstById.has(Number(outcome.id)));

    expect(recurring.length).toBeGreaterThan(0);
    for (const outcome of recurring) {
      const previous = firstById.get(Number(outcome.id));
      expect(previous).toBeDefined();
      expect(outcome.type).toBe(previous?.type);
      expect(outcome.visualSeed).toBe(previous?.visualSeed);
    }
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
