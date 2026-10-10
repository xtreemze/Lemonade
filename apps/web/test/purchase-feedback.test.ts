import { describe, expect, it } from "vitest";

import {
  createAuthoritativePurchaseFeedbackSchedule,
  createPurchaseFeedbackSchedule,
} from "../src/purchase-feedback.js";

describe("purchase feedback schedule", () => {
  it("schedules serve, payment and drink in order for every small-day sale", () => {
    const schedule = createPurchaseFeedbackSchedule(5, 5000);
    expect(schedule).toHaveLength(5);
    for (const beat of schedule) {
      expect(beat.iceClinkAtMs).toBeLessThanOrEqual(beat.pourAtMs);
      expect(beat.pourAtMs).toBeLessThanOrEqual(beat.serveAtMs);
      expect(beat.serveAtMs).toBeLessThan(beat.paymentAtMs);
      expect(beat.paymentAtMs).toBeLessThan(beat.drinkAtMs);
      expect(beat.drinkAtMs).toBeLessThanOrEqual(5000);
    }
  });

  it("rate-limits dense days while sampling the full sales span", () => {
    const schedule = createPurchaseFeedbackSchedule(400, 6000);
    expect(schedule.length).toBeLessThanOrEqual(12);
    expect(schedule[0]?.saleNumber).toBe(1);
    expect(schedule.at(-1)?.saleNumber).toBe(400);
  });

  it("is deterministic and produces no events when nothing sold", () => {
    expect(createPurchaseFeedbackSchedule(0, 5000)).toEqual([]);
    expect(createPurchaseFeedbackSchedule(12, 5000)).toEqual(
      createPurchaseFeedbackSchedule(12, 5000),
    );
  });
});


describe("authoritative purchase feedback schedule", () => {
  const outcome = (
    id: number,
    fulfillment:
      | Readonly<{ kind: "none" }>
      | Readonly<{ kind: "stockout" }>
      | Readonly<{ kind: "purchased"; saleIndex: number }>,
  ) =>
    Object.freeze({
      id,
      fulfillment,
    });

  it("emits feedback only for authoritative purchased outcomes", () => {
    const schedule = createAuthoritativePurchaseFeedbackSchedule(
      Object.freeze([
        outcome(10, Object.freeze({ kind: "none" as const })),
        outcome(11, Object.freeze({ kind: "purchased" as const, saleIndex: 0 })),
        outcome(12, Object.freeze({ kind: "stockout" as const })),
        outcome(13, Object.freeze({ kind: "purchased" as const, saleIndex: 1 })),
      ]),
      5000,
    );

    expect(schedule).toHaveLength(2);
    expect(schedule.map((beat) => beat.saleNumber)).toEqual([1, 2]);
    expect(schedule.map((beat) => beat.customerId)).toEqual([11, 13]);
  });

  it("samples dense authoritative purchase days across the full sale span", () => {
    const outcomes = Object.freeze(
      Array.from({ length: 400 }, (_, saleIndex) =>
        outcome(
          1000 + saleIndex,
          Object.freeze({ kind: "purchased" as const, saleIndex }),
        ),
      ),
    );

    const schedule = createAuthoritativePurchaseFeedbackSchedule(outcomes, 6000);

    expect(schedule.length).toBeLessThanOrEqual(12);
    expect(schedule[0]).toMatchObject({ saleNumber: 1, customerId: 1000 });
    expect(schedule.at(-1)).toMatchObject({ saleNumber: 400, customerId: 1399 });
  });

  it("rejects non-contiguous authoritative sale indexes", () => {
    expect(() =>
      createAuthoritativePurchaseFeedbackSchedule(
        Object.freeze([
          outcome(1, Object.freeze({ kind: "purchased" as const, saleIndex: 0 })),
          outcome(2, Object.freeze({ kind: "purchased" as const, saleIndex: 2 })),
        ]),
        5000,
      ),
    ).toThrow(/saleIndex/u);
  });
});
