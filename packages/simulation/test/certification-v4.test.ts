import { describe, expect, it } from "vitest";

import {
  assertV4BalanceCertification,
  formatV4BalanceCertification,
  runV4BalanceCertification,
} from "../src/certification-v4.js";

const TEST_SEEDS = Object.freeze([1, 2, 3, 5] as const);

describe("ruleset-v4 balance certification", () => {
  it("keeps the integrated exploit probes deterministic and inside their guardrails", () => {
    const first = runV4BalanceCertification(TEST_SEEDS);
    const repeated = runV4BalanceCertification(TEST_SEEDS);

    expect(repeated).toEqual(first);
    expect(() => assertV4BalanceCertification(first)).not.toThrow();
    expect(first.rulesetVersion).toBe(4);
    expect(first.advertising.map((probe) => probe.level)).toEqual([1, 2, 3, 4]);
    expect(first.advertising[0]?.points).toHaveLength(4);
    expect(first.advertising[1]?.points).toHaveLength(11);
    expect(first.advertising[2]?.points).toHaveLength(26);
    expect(first.advertising[3]?.points).toHaveLength(41);
    expect(first.price.map((probe) => probe.weather)).toEqual([
      "sunny",
      "cloudy",
      "hot-and-dry",
      "thunderstorm",
    ]);
    expect(first.memory.fatigueBps.at(-1)).toBeGreaterThan(first.memory.fatigueBps[0] ?? 0);
    expect(first.memory.recoveryBps.at(-1)).toBeLessThan(first.memory.recoveryBps[0] ?? 0);
  });

  it("formats separate human-reviewable v4 evidence without rewriting the 2017 report", () => {
    const report = runV4BalanceCertification(TEST_SEEDS);
    assertV4BalanceCertification(report);
    const text = formatV4BalanceCertification(report);

    expect(text).toContain("# Lemonade ruleset-v4 balance certification");
    expect(text).toContain("Advertising saturation");
    expect(text).toContain("Price / weather probes");
    expect(text).toContain("Market-memory recovery");
    expect(text).toContain("Integrated accounting + v4 funnel invariants: PASS");
  });
});
