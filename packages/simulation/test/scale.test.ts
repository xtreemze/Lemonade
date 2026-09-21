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

  it("normalizes the original 10x, 50x, and 500x asset thresholds to current starting equity", () => {
    expect(OPERATING_SCALE_THRESHOLDS_CENTS).toEqual({
      level2: 2_000,
      level3: 10_000,
      level4: 100_000,
    });
  });

  it("downgrades when equity falls below an unlocked boundary", () => {
    expect(operatingScaleForEquity(10_000).level).toBe(3);
    expect(operatingScaleForEquity(9_999).level).toBe(2);
    expect(operatingScaleForEquity(2_000).level).toBe(2);
    expect(operatingScaleForEquity(1_999).level).toBe(1);
  });

  it("derives scale from equity rather than finance tier or cash alone", () => {
    const initial = createInitialState();
    const leveraged = Object.freeze({
      ...initial,
      cash: moneyCents(12_000),
      loanBalance: moneyCents(3_000),
      tier: 4 as const,
    });

    expect(operatingScaleForState(leveraged).level).toBe(2);
  });
  it("rejects otherwise-affordable decisions outside the unlocked envelope", () => {
    const state = createInitialState();

    expect(() =>
      simulateDay(
        state,
        Object.freeze({
          glasses: glassCount(16),
          signs: signCount(1),
          price: moneyCents(10),
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
