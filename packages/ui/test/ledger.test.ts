import { describe, expect, it } from "vitest";

import {
  basisPoints,
  dayNumber,
  glassCount,
  moneyCents,
  signCount,
  signedMoneyCents,
  type DailyLedgerEntry,
} from "@lemonade/simulation";

import { projectLedger, sellThroughBasisPoints } from "../src/ledger.js";

const entry = (day: number, prepared: number, sold: number): DailyLedgerEntry =>
  Object.freeze({
    day: dayNumber(day),
    decision: Object.freeze({
      glasses: glassCount(prepared),
      signs: signCount(1),
      price: moneyCents(10),
    }),
    environment: Object.freeze({
      weather: Object.freeze({ kind: "sunny", demandMultiplier: basisPoints(10_000) }),
      sentiment: Object.freeze({ kind: "neutral", demandMultiplier: basisPoints(10_000) }),
      event: Object.freeze({ kind: "none", demandMultiplier: basisPoints(10_000) }),
    }),
    potentialDemand: glassCount(sold),
    sold: glassCount(sold),
    revenue: moneyCents(sold * 10),
    expenses: moneyCents(prepared * 2 + 15),
    net: signedMoneyCents(sold * 10 - (prepared * 2 + 15)),
    endingCash: moneyCents(200 + sold * 10 - (prepared * 2 + 15)),
    lines: Object.freeze([]),
  });

describe("ledger projection", () => {
  it("projects immutable historical values without recomputing them", () => {
    const points = projectLedger([entry(1, 20, 15), entry(2, 24, 24)]);

    expect(points).toEqual([
      expect.objectContaining({ day: 1, prepared: 20, sold: 15, priceCents: 10 }),
      expect.objectContaining({ day: 2, prepared: 24, sold: 24, priceCents: 10 }),
    ]);
    expect(Object.isFrozen(points)).toBe(true);
    expect(Object.isFrozen(points[0])).toBe(true);
  });

  it("reports sell-through in basis points and handles zero inventory", () => {
    expect(sellThroughBasisPoints(projectLedger([entry(1, 20, 15)])[0]!)).toBe(7_500);
    expect(sellThroughBasisPoints(projectLedger([entry(1, 0, 0)])[0]!)).toBe(0);
  });
});
