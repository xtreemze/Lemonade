import { describe, expect, it } from "vitest";

import {
  assertCustomerOutcomeConsistency,
  audienceTargetsForLevel,
  type CustomerOutcome,
  createMarketRandom,
  customerId,
  customerTraitsFor,
  dayAudienceFor,
  dayAudienceForWeather,
  dayNumber,
  seed,
  summarizeAudience,
} from "../src/index.js";

const outcome = (
  id: number,
  value: Omit<CustomerOutcome, "id" | "type" | "visualSeed">,
): CustomerOutcome =>
  Object.freeze({
    id: customerId(id),
    type: "impulse",
    visualSeed: seed(id + 100),
    ...value,
  });

describe("audience identity and selection", () => {
  it("derives stable customer traits from the run seed and customer id", () => {
    const runSeed = seed(0x12_34_56_78);
    const id = customerId(17);

    const first = customerTraitsFor(runSeed, id);
    const repeated = customerTraitsFor(runSeed, id);

    expect(repeated).toEqual(first);
    expect(customerTraitsFor(seed(0x12_34_56_79), id)).not.toEqual(first);
    expect(customerTraitsFor(runSeed, customerId(18))).not.toEqual(first);
  });

  it("keeps audience selection independent from unrelated named random streams", () => {
    const runSeed = seed(0xfe_ed_be_ef);
    const day = dayNumber(8);
    const before = dayAudienceFor(runSeed, day, 3);
    const unrelated = createMarketRandom(runSeed, "conversion", {
      day,
      customerId: customerId(4),
    });

    for (let draw = 0; draw < 100; draw += 1) {
      unrelated.nextUnit();
    }

    expect(dayAudienceFor(runSeed, day, 3)).toEqual(before);
  });

  it("selects deterministic, unique audiences within every operating-scale pool", () => {
    const runSeed = seed(42);
    const day = dayNumber(5);

    for (const level of [1, 2, 3, 4] as const) {
      const targets = audienceTargetsForLevel(level);
      const first = dayAudienceFor(runSeed, day, level);
      const repeated = dayAudienceFor(runSeed, day, level);
      const ids = first.customerIds.map(Number);

      expect(repeated).toEqual(first);
      expect(first.neighborhoodSize).toBe(targets.neighborhoodSize);
      expect(first.customerIds).toHaveLength(targets.dailyAudience);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every((id) => id >= 0 && id < first.neighborhoodSize)).toBe(true);
    }
  });

  it("changes the active audience by day without changing customer identity rules", () => {
    const runSeed = seed(777);
    const firstDay = dayAudienceFor(runSeed, dayNumber(1), 2);
    const secondDay = dayAudienceFor(runSeed, dayNumber(2), 2);

    expect(secondDay.customerIds).not.toEqual(firstDay.customerIds);

    const recurringId = firstDay.customerIds.find((id) => secondDay.customerIds.includes(id));
    expect(recurringId).toBeDefined();
    if (recurringId === undefined) {
      return;
    }

    expect(customerTraitsFor(runSeed, recurringId)).toEqual(
      customerTraitsFor(runSeed, recurringId),
    );
  });
});


describe("weather-conditioned audience selection", () => {
  it("keeps audience size and neighborhood size independent from weather", () => {
    const runSeed = seed(0x44_33_22_11);
    const day = dayNumber(9);

    for (const level of [1, 2, 3, 4] as const) {
      const baseline = dayAudienceForWeather(runSeed, day, level, "sunny");
      for (const weather of ["cloudy", "hot-and-dry", "thunderstorm"] as const) {
        const conditioned = dayAudienceForWeather(runSeed, day, level, weather);
        expect(conditioned.neighborhoodSize).toBe(baseline.neighborhoodSize);
        expect(conditioned.customerIds).toHaveLength(baseline.customerIds.length);
      }
    }
  });

  it("replays identical weather-conditioned customer ids", () => {
    const input = Object.freeze({
      runSeed: seed(0x0f_0e_0d_0c),
      day: dayNumber(14),
      level: 3 as const,
      weather: "thunderstorm" as const,
    });

    expect(
      dayAudienceForWeather(input.runSeed, input.day, input.level, input.weather),
    ).toEqual(dayAudienceForWeather(input.runSeed, input.day, input.level, input.weather));
  });

  it("keeps storm selection bounded instead of replacing the whole audience", () => {
    const runSeed = seed(0x10_20_30_40);
    const day = dayNumber(17);
    const sunny = dayAudienceForWeather(runSeed, day, 3, "sunny");
    const storm = dayAudienceForWeather(runSeed, day, 3, "thunderstorm");
    const sunnyIds = new Set(sunny.customerIds.map(Number));
    const overlap = storm.customerIds.filter((id) => sunnyIds.has(Number(id))).length;

    expect(overlap / sunny.customerIds.length).toBeGreaterThanOrEqual(0.55);
    expect(storm.customerIds).not.toEqual(sunny.customerIds);
  });

  it("shifts storm composition toward committed regular and destination customers", () => {
    let sunnyPreferred = 0;
    let stormPreferred = 0;
    let sunnyImpulse = 0;
    let stormImpulse = 0;

    for (let seedValue = 1; seedValue <= 48; seedValue += 1) {
      const runSeed = seed(seedValue);
      const day = dayNumber((seedValue % 20) + 1);
      const sunny = dayAudienceForWeather(runSeed, day, 2, "sunny");
      const storm = dayAudienceForWeather(runSeed, day, 2, "thunderstorm");

      for (const id of sunny.customerIds) {
        const traits = customerTraitsFor(runSeed, id);
        sunnyPreferred +=
          traits.type === "regular" || traits.type === "destination" ? 1 : 0;
        sunnyImpulse += traits.type === "impulse" ? 1 : 0;
      }
      for (const id of storm.customerIds) {
        const traits = customerTraitsFor(runSeed, id);
        stormPreferred +=
          traits.type === "regular" || traits.type === "destination" ? 1 : 0;
        stormImpulse += traits.type === "impulse" ? 1 : 0;
      }
    }

    expect(stormPreferred).toBeGreaterThan(sunnyPreferred);
    expect(stormImpulse).toBeLessThan(sunnyImpulse);
  });

  it("does not let unrelated market RNG draws perturb weather-conditioned selection", () => {
    const runSeed = seed(0xfe_dc_ba_98);
    const day = dayNumber(12);
    const before = dayAudienceForWeather(runSeed, day, 2, "thunderstorm");
    const unrelated = createMarketRandom(runSeed, "conversion", {
      day,
      customerId: customerId(9),
    });

    for (let draw = 0; draw < 100; draw += 1) {
      unrelated.nextUnit();
    }

    expect(dayAudienceForWeather(runSeed, day, 2, "thunderstorm")).toEqual(before);
  });
});

describe("audience outcome contracts", () => {
  it("summarizes an exhaustive awareness -> conversion -> fulfillment funnel", () => {
    const outcomes = Object.freeze([
      outcome(0, {
        awareness: Object.freeze({ kind: "unaware" }),
        conversion: Object.freeze({ kind: "not-evaluated" }),
        fulfillment: Object.freeze({ kind: "none" }),
      }),
      outcome(1, {
        awareness: Object.freeze({ kind: "organic" }),
        conversion: Object.freeze({ kind: "price-rejected" }),
        fulfillment: Object.freeze({ kind: "none" }),
      }),
      outcome(2, {
        awareness: Object.freeze({ kind: "advertising", signIndex: 0 }),
        conversion: Object.freeze({ kind: "willing" }),
        fulfillment: Object.freeze({ kind: "purchased", saleIndex: 0 }),
      }),
      outcome(3, {
        awareness: Object.freeze({ kind: "advertising", signIndex: 1 }),
        conversion: Object.freeze({ kind: "willing" }),
        fulfillment: Object.freeze({ kind: "stockout" }),
      }),
    ]);

    expect(summarizeAudience(outcomes)).toEqual({
      audience: 4,
      unaware: 1,
      organicAware: 1,
      advertisingAware: 2,
      aware: 3,
      priceRejected: 1,
      willing: 2,
      purchased: 1,
      stockout: 1,
    });
  });

  it("rejects impossible unaware purchase states", () => {
    const impossible = outcome(0, {
      awareness: Object.freeze({ kind: "unaware" }),
      conversion: Object.freeze({ kind: "willing" }),
      fulfillment: Object.freeze({ kind: "purchased", saleIndex: 0 }),
    });

    expect(() => {
      assertCustomerOutcomeConsistency(impossible);
    }).toThrow("unaware customers cannot evaluate price or receive fulfillment");
  });

  it("rejects price rejection with fulfillment", () => {
    const impossible = outcome(0, {
      awareness: Object.freeze({ kind: "organic" }),
      conversion: Object.freeze({ kind: "price-rejected" }),
      fulfillment: Object.freeze({ kind: "stockout" }),
    });

    expect(() => {
      assertCustomerOutcomeConsistency(impossible);
    }).toThrow("price-rejected customers cannot be fulfilled");
  });

  it("requires every willing customer to purchase or encounter stockout", () => {
    const impossible = outcome(0, {
      awareness: Object.freeze({ kind: "advertising", signIndex: 0 }),
      conversion: Object.freeze({ kind: "willing" }),
      fulfillment: Object.freeze({ kind: "none" }),
    });

    expect(() => {
      assertCustomerOutcomeConsistency(impossible);
    }).toThrow("willing customers must purchase or encounter stockout");
  });

  it("validates zero-based sign and sale indices", () => {
    const invalidSign = outcome(0, {
      awareness: Object.freeze({ kind: "advertising", signIndex: -1 }),
      conversion: Object.freeze({ kind: "price-rejected" }),
      fulfillment: Object.freeze({ kind: "none" }),
    });
    const invalidSale = outcome(1, {
      awareness: Object.freeze({ kind: "organic" }),
      conversion: Object.freeze({ kind: "willing" }),
      fulfillment: Object.freeze({ kind: "purchased", saleIndex: -1 }),
    });

    expect(() => {
      assertCustomerOutcomeConsistency(invalidSign);
    }).toThrow("sign index must be a non-negative safe integer");
    expect(() => {
      assertCustomerOutcomeConsistency(invalidSale);
    }).toThrow("sale index must be a non-negative safe integer");
  });
});
