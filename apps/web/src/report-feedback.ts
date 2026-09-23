import type { OperatingScaleRules } from "@lemonade/simulation";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatMoney = (cents: number): string => moneyFormatter.format(cents / 100);

export const affordabilityShortfallMessage = (
  spendCents: number,
  operatingFundsCents: number,
): string | null => {
  const shortfallCents = spendCents - operatingFundsCents;
  if (shortfallCents <= 0) return null;
  return `This plan is ${formatMoney(shortfallCents)} over available operating funds. Reduce glasses or signs.`;
};

export const standLevelTransitionMessage = (
  previous: OperatingScaleRules,
  next: OperatingScaleRules,
): string | null => {
  if (previous.level === next.level) return null;

  const envelope =
    `${String(next.maxGlasses)} cups, ${String(next.maxSigns)} signs, ${formatMoney(next.maxPriceCents)} per cup`;

  return next.level > previous.level
    ? `Stand level ${String(next.level)} unlocked — tomorrow: up to ${envelope}.`
    : `Stand level ${String(next.level)} tomorrow — capacity returns to ${envelope}.`;
};

export const bankruptcyMessage = (bankrupt: boolean): string | null =>
  bankrupt
    ? "Bankrupt — operating balance fell below the $10.00 reserve. The stand closes after today. Review the run, then start a new game."
    : null;
