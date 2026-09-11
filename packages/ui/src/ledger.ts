import type { DailyLedgerEntry } from "@lemonade/simulation";

export type LedgerPoint = Readonly<{
  day: number;
  tier: number;
  prepared: number;
  sold: number;
  priceCents: number;
  revenueCents: number;
  financeIncomeCents: number;
  expensesCents: number;
  netCents: number;
  cashDeltaCents: number;
  borrowedCents: number;
  repaidCents: number;
  endingCashCents: number;
  endingDebtCents: number;
}>;

export const projectLedger = (
  entries: readonly DailyLedgerEntry[],
): readonly LedgerPoint[] =>
  Object.freeze(
    entries.map((entry) =>
      Object.freeze({
        day: Number(entry.day),
        tier: entry.tier,
        prepared: Number(entry.decision.glasses),
        sold: Number(entry.sold),
        priceCents: Number(entry.decision.price),
        revenueCents: Number(entry.revenue),
        financeIncomeCents: Number(entry.financeIncome),
        expensesCents: Number(entry.expenses),
        netCents: Number(entry.net),
        cashDeltaCents: Number(entry.cashDelta),
        borrowedCents: Number(entry.borrowed),
        repaidCents: Number(entry.repaid),
        endingCashCents: Number(entry.endingCash),
        endingDebtCents: Number(entry.endingLoanBalance),
      }),
    ),
  );

export const sellThroughBasisPoints = (point: LedgerPoint): number =>
  point.prepared === 0 ? 0 : Math.round((point.sold / point.prepared) * 10_000);
