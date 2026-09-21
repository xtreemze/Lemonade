import { describe, expect, it } from "vitest";

import {
  CERTIFICATION_HORIZON_DAYS,
  CERTIFICATION_SEEDS,
  CERTIFICATION_STRATEGY_NAMES,
  assertBalanceCertification,
  formatBalanceCertification,
  runBalanceCertification,
} from "../src/index.js";

describe("balance certification", () => {
  it("produces deterministic output for the fixed fixture corpus", () => {
    const first = runBalanceCertification();
    const second = runBalanceCertification();

    expect(second).toEqual(first);
    expect(first.horizonDays).toBe(CERTIFICATION_HORIZON_DAYS);
    expect(first.seeds).toEqual(CERTIFICATION_SEEDS);
    expect(first.profiles.map((profile) => profile.strategy)).toEqual(
      CERTIFICATION_STRATEGY_NAMES,
    );
  });

  it("passes 2017 equation, accounting, and progression guardrails", () => {
    const report = runBalanceCertification();

    expect(() => {
      assertBalanceCertification(report);
    }).not.toThrow();

    const progression = report.profiles.find((profile) => profile.strategy === "progression");
    expect(progression?.maxOperatingScale).toBeGreaterThanOrEqual(2);

    const prices = report.probes.priceDemand;
    expect(prices.map((point) => point.demand)).toEqual(
      [...prices].map((point) => point.demand).sort((left, right) => right - left),
    );
    expect(report.probes.weather.map((point) => point.effect)).toEqual([1, 2, 5, 10]);
  });

  it("formats a human-reviewable deterministic report", () => {
    const text = formatBalanceCertification(runBalanceCertification());

    expect(text).toContain("# Lemonade 2017 balance certification");
    expect(text).toContain("advertising-heavy");
    expect(text).toContain("Finance burden across the corpus");
    expect(text).toContain("2017 controlled probes");
    expect(text).toContain("Certification guardrails: PASS");
  });
});
