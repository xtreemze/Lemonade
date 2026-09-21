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

import { summarizeCompletedWeek } from "../src/weekly.js";

const entry = (day: number): DailyLedgerEntry => {
  const prepared = 10 + day;
  const sold = day;
  const revenue = sold * 10;
  const expenses = prepared * 2;
  const net = revenue - expenses;

  return Object.freeze({
    day: dayNumber(day),
    tier: 0,
    decision: Object.freeze({
      glasses: glassCount(prepared),
      signs: signCount(0),
      price: moneyCents(10),
    }),
    environment: Object.freeze({
      weather: Object.freeze({ kind: "sunny", demandMultiplier: basisPoints(10_000) }),
      sentiment: Object.freeze({ kind: "neutral", demandMultiplier: basisPoints(10_000) }),
      event: Object.freeze({ kind: "none", demandMultiplier: basisPoints(10_000) }),
    }),
    potentialDemand: glassCount(sold),
    sold: glassCount(sold),
    revenue: moneyCents(revenue),
    financeIncome: moneyCents(0),
    expenses: moneyCents(expenses),
    net: signedMoneyCents(net),
    cashDelta: signedMoneyCents(net),
    borrowed: moneyCents(0),
    repaid: moneyCents(0),
    endingCash: moneyCents(300 + day),
    endingLoanBalance: moneyCents(day),
    lines: Object.freeze([]),
  });
};

const entriesThrough = (day: number): readonly DailyLedgerEntry[] =>
  Object.freeze(Array.from({ length: day }, (_, index) => entry(index + 1)));

describe("weekly report summary", () => {
  it("appears only after a complete seven-day boundary", () => {
    expect(summarizeCompletedWeek(entriesThrough(6))).toBeNull();

    const week = summarizeCompletedWeek(entriesThrough(7));
    expect(week).not.toBeNull();
    expect(week).toEqual(
      expect.objectContaining({
        weekNumber: 1,
        startDay: 1,
        endDay: 7,
        prepared: 98,
        sold: 28,
        revenueCents: 280,
        expensesCents: 196,
        netCents: 84,
        averageDailyNetCents: 12,
        sellThroughBasisPoints: 2_857,
        profitableDays: 5,
        lossDays: 2,
        endingCashCents: 307,
        endingDebtCents: 7,
        bestDay: { day: 7, netCents: 36 },
        worstDay: { day: 1, netCents: -12 },
      }),
    );
    expect(Object.isFrozen(week)).toBe(true);
    expect(Object.isFrozen(week?.bestDay)).toBe(true);

    expect(summarizeCompletedWeek(entriesThrough(8))).toBeNull();
  });

  it("summarizes the latest completed week without mixing prior weeks", () => {
    const week = summarizeCompletedWeek(entriesThrough(14));

    expect(week).toEqual(
      expect.objectContaining({
        weekNumber: 2,
        startDay: 8,
        endDay: 14,
      }),
    );
    expect(week?.bestDay.day).toBe(14);
    expect(week?.worstDay.day).toBe(8);
  });

  it("refuses a nominal week boundary when ledger days are not contiguous", () => {
    expect(
      summarizeCompletedWeek([
        entry(1),
        entry(2),
        entry(3),
        entry(4),
        entry(5),
        entry(6),
        entry(14),
      ]),
    ).toBeNull();
  });
});
