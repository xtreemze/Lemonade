import { describe, expect, it } from "vitest";

import { createPurchaseFeedbackSchedule } from "../src/purchase-feedback.js";

describe("purchase feedback schedule", () => {
  it("schedules serve, payment and drink in order for every small-day sale", () => {
    const schedule = createPurchaseFeedbackSchedule(5, 5000);
    expect(schedule).toHaveLength(5);
    for (const beat of schedule) {
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
