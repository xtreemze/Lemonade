import { describe, expect, it } from "vitest";

import {
  assertCustomerOutcomeConsistency,
  audienceRulesForScale,
  createNamedRandom,
  customerId,
  dayNumber,
  deriveCustomerTraits,
  seed,
  selectDayAudience,
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
  it("derives stable customer traits from neighborhood seed and customer id", () => {
    const neighborhoodSeed = seed(0x1e_ad_2026);
    const id = customerId(17);
    const first = deriveCustomerTraits(neighborhoodSeed, id);

    expect(deriveCustomerTraits(neighborhoodSeed, id)).toEqual(first);
    expect(
      deriveCustomerTraits(neighborhoodSeed, customerId(18)),
    ).not.toEqual(first);
    expect(
      deriveCustomerTraits(seed(0x1e_ad_2027), id),
    ).not.toEqual(first);
  });

  it("selects deterministic daily audiences from finite scale-specific pools", () => {
    const neighborhoodSeed = seed(0x4c_45_4d_4f);

    for (const level of [1, 2, 3, 4] as const) {
      const rules = audienceRulesForScale(level);
      const audience = selectDayAudience(
        neighborhoodSeed,
        dayNumber(12),
        level,
      );

      expect(audience.neighborhoodSize).toBe(rules.neighborhoodSize);
      expect(audience.customerIds).toHaveLength(rules.dailyAudience);
      expect(new Set(audience.customerIds).size).toBe(rules.dailyAudience);
      expect(
        audience.customerIds.every(
          (id) => Number(id) >= 0 && Number(id) < rules.neighborhoodSize,
        ),
      ).toBe(true);
      expect(
        selectDayAudience(neighborhoodSeed, dayNumber(12), level),
      ).toEqual(audience);
    }
  });

  it("keeps audience selection isolated from unrelated named random streams", () => {
    const neighborhoodSeed = seed(0x0a_11_ce);
    const baseline = selectDayAudience(
      neighborhoodSeed,
      dayNumber(7),
      3,
    );
    const presentation = createNamedRandom(
      neighborhoodSeed,
      "scene-presentation",
      7,
    );

    for (let draw = 0; draw < 1_000; draw += 1) {
      presentation.nextUnit();
    }

    expect(
      selectDayAudience(neighborhoodSeed, dayNumber(7), 3),
    ).toEqual(baseline);
    expect(
      selectDayAudience(neighborhoodSeed, dayNumber(8), 3).customerIds,
    ).not.toEqual(baseline.customerIds);
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
