import { describe, expect, it } from "vitest";

import {
  DecisionOutsideOperatingScaleError,
  OPERATING_SCALE_THRESHOLDS_CENTS,
  createInitialState,
  glassCount,
  moneyCents,
  neutralEnvironment,
  operatingScaleForEquity,
  operatingScaleForState,
  signCount,
  simulateDay,
} from "../src/index.js";

describe("operating-scale progression", () => {
  it("restores the historical decision ceilings at every level", () => {
    expect(operatingScaleForEquity(0)).toMatchObject({
      level: 1,
      maxGlasses: 15,
      maxSigns: 3,
      maxPriceCents: 299,
    });
    expect(operatingScaleForEquity(OPERATING_SCALE_THRESHOLDS_CENTS.level2)).toMatchObject({
      level: 2,
      maxGlasses: 50,
      maxSigns: 10,
      maxPriceCents: 399,
    });
    expect(operatingScaleForEquity(OPERATING_SCALE_THRESHOLDS_CENTS.level3)).toMatchObject({
      level: 3,
      maxGlasses: 140,
      maxSigns: 25,
      maxPriceCents: 699,
    });
    expect(operatingScaleForEquity(OPERATING_SCALE_THRESHOLDS_CENTS.level4)).toMatchObject({
      level: 4,
      maxGlasses: 400,
      maxSigns: 40,
      maxPriceCents: 999,
    });
  });

  it("preserves the original 2017 absolute balance thresholds", () => {
    expect(OPERATING_SCALE_THRESHOLDS_CENTS).toEqual({
      level2: 10_000,
      level3: 50_000,
      level4: 500_000,
    });
  });

  it("downgrades when equity falls below an unlocked boundary", () => {
    expect(operatingScaleForEquity(500_000).level).toBe(4);
    expect(operatingScaleForEquity(499_999).level).toBe(3);
    expect(operatingScaleForEquity(50_000).level).toBe(3);
    expect(operatingScaleForEquity(49_999).level).toBe(2);
    expect(operatingScaleForEquity(10_000).level).toBe(2);
    expect(operatingScaleForEquity(9_999).level).toBe(1);
  });

  it("derives stand scale from the 2017 operating ledger, not later finance cash", () => {
    const initial = createInitialState();
    const financeRich = Object.freeze({
      ...initial,
      cash: moneyCents(900_000),
      loanBalance: moneyCents(0),
      tier: 4 as const,
    });

    expect(operatingScaleForState(financeRich).level).toBe(1);
  });
  it("rejects otherwise-affordable decisions outside the unlocked envelope", () => {
    const state = createInitialState();

    expect(() =>
      simulateDay(
        state,
        Object.freeze({
          glasses: glassCount(16),
          signs: signCount(1),
          price: moneyCents(150),
        }),
        neutralEnvironment(),
      ),
    ).toThrow(DecisionOutsideOperatingScaleError);

    expect(() =>
      simulateDay(
        state,
        Object.freeze({
          glasses: glassCount(15),
          signs: signCount(1),
          price: moneyCents(300),
        }),
        neutralEnvironment(),
      ),
    ).toThrow(DecisionOutsideOperatingScaleError);
  });
});
