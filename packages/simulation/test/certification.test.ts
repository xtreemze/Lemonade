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

  it("passes accounting, progression, and strategic guardrails", () => {
    const report = runBalanceCertification();

    expect(() => {
      assertBalanceCertification(report);
    }).not.toThrow();

    const progression = report.profiles.find((profile) => profile.strategy === "progression");
    expect(progression?.maxTier).toBe(4);
    expect(progression?.earliestDayByTier.slice(0, 5).every((day) => day !== null)).toBe(true);
  });

  it("formats a human-reviewable deterministic report", () => {
    const text = formatBalanceCertification(runBalanceCertification());

    expect(text).toContain("# Lemonade balance certification");
    expect(text).toContain("advertising-heavy");
    expect(text).toContain("Finance burden across the corpus");
    expect(text).toContain("Controlled probes");
    expect(text).toContain("Certification guardrails: PASS");
  });
});
