import { describe, expect, it } from "vitest";

import { dayCycleAt } from "../src/day-cycle.js";

describe("business-day atmosphere cycle", () => {
  it("moves from morning through midday into a materially darker night", () => {
    const morning = dayCycleAt(0, 10_000, "sunny");
    const midday = dayCycleAt(4_200, 10_000, "sunny");
    const night = dayCycleAt(10_000, 10_000, "sunny");

    expect(morning.progress).toBe(0);
    expect(midday.progress).toBeCloseTo(0.42);
    expect(night.progress).toBe(1);
    expect(midday.sunlightIntensity).toBeGreaterThan(morning.sunlightIntensity);
    expect(night.sunlightIntensity).toBeLessThan(morning.sunlightIntensity * 0.2);
    expect(night.hemisphereIntensity).toBeLessThan(midday.hemisphereIntensity * 0.4);
    expect(night.skyColor).not.toBe(midday.skyColor);
    expect(night.sunPosition[1]).toBeLessThan(0);
  });

  it("keeps thunderstorms darker than clear conditions through the daylight phase", () => {
    const clear = dayCycleAt(4_200, 10_000, "sunny");
    const storm = dayCycleAt(4_200, 10_000, "thunderstorm");

    expect(storm.sunlightIntensity).toBeLessThan(clear.sunlightIntensity);
    expect(storm.hemisphereIntensity).toBeLessThan(clear.hemisphereIntensity);
    expect(storm.skyColor).not.toBe(clear.skyColor);
  });

  it("clamps invalid or out-of-range elapsed time", () => {
    expect(dayCycleAt(-500, 10_000, "cloudy").progress).toBe(0);
    expect(dayCycleAt(15_000, 10_000, "cloudy").progress).toBe(1);
  });
});
