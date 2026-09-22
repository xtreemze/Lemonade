import { describe, expect, it } from "vitest";

import {
  assertCustomerOutcomeConsistency,
  customerId,
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

    expect(() => {\n      assertCustomerOutcomeConsistency(impossible);\n    }).toThrow(
      "unaware customers cannot evaluate price or receive fulfillment",
    );
  });

  it("rejects price rejection with fulfillment", () => {
    const impossible = outcome(0, {
      awareness: Object.freeze({ kind: "organic" }),
      conversion: Object.freeze({ kind: "price-rejected" }),
      fulfillment: Object.freeze({ kind: "stockout" }),
    });

    expect(() => {\n      assertCustomerOutcomeConsistency(impossible);\n    }).toThrow(
      "price-rejected customers cannot be fulfilled",
    );
  });

  it("requires every willing customer to purchase or encounter stockout", () => {
    const impossible = outcome(0, {
      awareness: Object.freeze({ kind: "advertising", signIndex: 0 }),
      conversion: Object.freeze({ kind: "willing" }),
      fulfillment: Object.freeze({ kind: "none" }),
    });

    expect(() => {\n      assertCustomerOutcomeConsistency(impossible);\n    }).toThrow(
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

    expect(() => {\n      assertCustomerOutcomeConsistency(invalidSign);\n    }).toThrow(
      "sign index must be a non-negative safe integer",
    );
    expect(() => {\n      assertCustomerOutcomeConsistency(invalidSale);\n    }).toThrow(
      "sale index must be a non-negative safe integer",
    );
  });
});
