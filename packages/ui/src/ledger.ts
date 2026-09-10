import type { DailyLedgerEntry } from "@lemonade/simulation";

export type LedgerPoint = Readonly<{
  day: number;
  prepared: number;
  sold: number;
  priceCents: number;
  revenueCents: number;
  expensesCents: number;
  netCents: number;
  endingCashCents: number;
}>;

export const projectLedger = (
  entries: readonly DailyLedgerEntry[],
): readonly LedgerPoint[] =>
  Object.freeze(
    entries.map((entry) =>
      Object.freeze({
        day: Number(entry.day),
        prepared: Number(entry.decision.glasses),
        sold: Number(entry.sold),
        priceCents: Number(entry.decision.price),
        revenueCents: Number(entry.revenue),
        expensesCents: Number(entry.expenses),
        netCents: Number(entry.net),
        endingCashCents: Number(entry.endingCash),
      }),
    ),
  );

export const sellThroughBasisPoints = (point: LedgerPoint): number =>
  point.prepared === 0 ? 0 : Math.round((point.sold / point.prepared) * 10_000);
