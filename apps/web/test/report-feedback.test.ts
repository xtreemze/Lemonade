import { operatingScaleForBalance } from "@lemonade/simulation";
import { describe, expect, it } from "vitest";

import {
  affordabilityShortfallMessage,
  bankruptcyMessage,
  standLevelTransitionMessage,
} from "../src/report-feedback.js";

describe("legacy feedback presentation", () => {
  it("explains the exact affordability shortfall", () => {
    expect(affordabilityShortfallMessage(1050, 1000)).toBe(
      "This plan is $0.50 over available operating funds. Reduce glasses or signs.",
    );
    expect(affordabilityShortfallMessage(1000, 1000)).toBeNull();
  });

  it("makes stand upgrades and downgrades explicit without adding controls", () => {
    expect(
      standLevelTransitionMessage(operatingScaleForBalance(9999), operatingScaleForBalance(10_000)),
    ).toBe("Stand level 2 unlocked — tomorrow: up to 50 cups, 10 signs, $3.99 per cup.");

    expect(
      standLevelTransitionMessage(operatingScaleForBalance(10_000), operatingScaleForBalance(9999)),
    ).toBe("Stand level 1 tomorrow — capacity returns to 15 cups, 3 signs, $2.99 per cup.");
  });

  it("describes bankruptcy as a terminal stand closure", () => {
    expect(bankruptcyMessage(true)).toBe(
      "Bankrupt — operating balance fell below the $10.00 reserve. The stand closes after today. Review the run, then start a new game.",
    );
    expect(bankruptcyMessage(false)).toBeNull();
  });
});
