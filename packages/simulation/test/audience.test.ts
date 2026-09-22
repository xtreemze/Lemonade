import { describe, expect, it } from "vitest";

import {
  assertCustomerOutcomeConsistency,
  audienceTargetsForLevel,
  createMarketRandom,
  customerId,
  customerTraitsFor,
  dayAudienceFor,
  dayNumber,
  seed,
  summarizeAudience,
  type CustomerOutcome,
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
    const runSeed = seed(0x1234_5678);
    const id = customerId(17);

    const first = customerTraitsFor(runSeed, id);
    const repeated = customerTraitsFor(runSeed, id);

    expect(repeated).toEqual(first);
    expect(customerTraitsFor(seed(0x1234_5679), id)).not.toEqual(first);
    expect(customerTraitsFor(runSeed, customerId(18))).not.toEqual(first);
  });

  it("keeps audience selection independent from unrelated named random streams", () => {
    const runSeed = seed(0xfeed_beef);
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
      expect(ids.every((id) => id >= 0 && id < first.neighborhoodSize)).toBe(
        true,
      );
    }
  });

  it("changes the active audience by day without changing customer identity rules", () => {
    const runSeed = seed(777);
    const firstDay = dayAudienceFor(runSeed, dayNumber(1), 2);
    const secondDay = dayAudienceFor(runSeed, dayNumber(2), 2);

    expect(secondDay.customerIds).not.toEqual(firstDay.customerIds);

    const recurringId = firstDay.customerIds.find((id) =>
      secondDay.customerIds.includes(id),
    );
    expect(recurringId).toBeDefined();
    if (recurringId === undefined) return;

    expect(customerTraitsFor(runSeed, recurringId)).toEqual(
      customerTraitsFor(runSeed, recurringId),
    );
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
    }).toThrow(
      "unaware customers cannot evaluate price or receive fulfillment",
    );
  });

  it("rejects price rejection with fulfillment", () => {
    const impossible = outcome(0, {
      awareness: Object.freeze({ kind: "organic" }),
      conversion: Object.freeze({ kind: "price-rejected" }),
      fulfillment: Object.freeze({ kind: "stockout" }),
    });

    expect(() => {
      assertCustomerOutcomeConsistency(impossible);
    }).toThrow(
      "price-rejected customers cannot be fulfilled",
    );
  });

  it("requires every willing customer to purchase or encounter stockout", () => {
    const impossible = outcome(0, {
      awareness: Object.freeze({ kind: "advertising", signIndex: 0 }),
      conversion: Object.freeze({ kind: "willing" }),
      fulfillment: Object.freeze({ kind: "none" }),
    });

    expect(() => {
      assertCustomerOutcomeConsistency(impossible);
    }).toThrow(
      "willing customers must purchase or encounter stockout",
    );
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
    }).toThrow(
      "sign index must be a non-negative safe integer",
    );
    expect(() => {
      assertCustomerOutcomeConsistency(invalidSale);
    }).toThrow(
      "sale index must be a non-negative safe integer",
    );
  });
});
