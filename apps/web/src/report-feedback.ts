import { LEGACY_STARTING_BALANCE_CENTS, type OperatingScaleRules } from "@lemonade/simulation";

const formatMoney = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

export const affordabilityShortfallMessage = (
  spendCents: number,
  operatingFundsCents: number,
): string | null => {
  const shortfallCents = spendCents - operatingFundsCents;
  if (shortfallCents <= 0) {
    return null;
  }
  return `This plan is ${formatMoney(shortfallCents)} over available operating funds. Reduce glasses or signs.`;
};

export const standLevelTransitionMessage = (
  previous: OperatingScaleRules,
  next: OperatingScaleRules,
): string | null => {
  if (previous.level === next.level) {
    return null;
  }

  const envelope = `${String(next.maxGlasses)} cups, ${String(next.maxSigns)} signs, ${formatMoney(next.maxPriceCents)} per cup`;

  return next.level > previous.level
    ? `Stand level ${String(next.level)} unlocked — tomorrow: up to ${envelope}.`
    : `Stand level ${String(next.level)} tomorrow — capacity returns to ${envelope}.`;
};

export const bankruptcyMessage = (bankrupt: boolean): string | null =>
  bankrupt
    ? `Bankrupt — operating balance fell below the ${formatMoney(LEGACY_STARTING_BALANCE_CENTS)} reserve. The stand closes after today. Review the run, then start a new game.`
    : null;
