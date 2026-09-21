import type { DailyLedgerEntry } from "@lemonade/simulation";

const DAYS_PER_WEEK = 7;

export type WeeklyDayHighlight = Readonly<{
  day: number;
  netCents: number;
}>;

export type WeeklyReport = Readonly<{
  weekNumber: number;
  startDay: number;
  endDay: number;
  prepared: number;
  sold: number;
  revenueCents: number;
  financeIncomeCents: number;
  expensesCents: number;
  netCents: number;
  averageDailyNetCents: number;
  sellThroughBasisPoints: number;
  profitableDays: number;
  lossDays: number;
  endingCashCents: number;
  endingDebtCents: number;
  bestDay: WeeklyDayHighlight;
  worstDay: WeeklyDayHighlight;
}>;

const sum = (
  entries: readonly DailyLedgerEntry[],
  select: (entry: DailyLedgerEntry) => number,
): number => entries.reduce((total, entry) => total + select(entry), 0);

const highlight = (entry: DailyLedgerEntry): WeeklyDayHighlight =>
  Object.freeze({
    day: Number(entry.day),
    netCents: Number(entry.net),
  });

export const summarizeCompletedWeek = (
  entries: readonly DailyLedgerEntry[],
): WeeklyReport | null => {
  const latest = entries.at(-1);
  if (latest === undefined) return null;

  const endDay = Number(latest.day);
  if (endDay % DAYS_PER_WEEK !== 0 || entries.length < DAYS_PER_WEEK) return null;

  const startDay = endDay - (DAYS_PER_WEEK - 1);
  const weekEntries = entries.slice(-DAYS_PER_WEEK);

  for (const [index, entry] of weekEntries.entries()) {
    if (Number(entry.day) !== startDay + index) return null;
  }

  let best = weekEntries[0];
  let worst = weekEntries[0];
  if (best === undefined || worst === undefined) return null;

  for (const entry of weekEntries.slice(1)) {
    if (Number(entry.net) > Number(best.net)) best = entry;
    if (Number(entry.net) < Number(worst.net)) worst = entry;
  }

  const prepared = sum(weekEntries, (entry) => Number(entry.decision.glasses));
  const sold = sum(weekEntries, (entry) => Number(entry.sold));
  const revenueCents = sum(weekEntries, (entry) => Number(entry.revenue));
  const financeIncomeCents = sum(weekEntries, (entry) => Number(entry.financeIncome));
  const expensesCents = sum(weekEntries, (entry) => Number(entry.expenses));
  const netCents = sum(weekEntries, (entry) => Number(entry.net));
  const profitableDays = weekEntries.filter((entry) => Number(entry.net) > 0).length;
  const lossDays = weekEntries.filter((entry) => Number(entry.net) < 0).length;

  return Object.freeze({
    weekNumber: endDay / DAYS_PER_WEEK,
    startDay,
    endDay,
    prepared,
    sold,
    revenueCents,
    financeIncomeCents,
    expensesCents,
    netCents,
    averageDailyNetCents: Math.round(netCents / DAYS_PER_WEEK),
    sellThroughBasisPoints:
      prepared === 0 ? 0 : Math.round((sold / prepared) * 10_000),
    profitableDays,
    lossDays,
    endingCashCents: Number(latest.endingCash),
    endingDebtCents: Number(latest.endingLoanBalance),
    bestDay: highlight(best),
    worstDay: highlight(worst),
  });
};
