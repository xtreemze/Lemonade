import type { DailyLedgerEntry, GameState, MarketSentiment, Weather } from "./model.js";

export const LEGACY_STARTING_BALANCE_CENTS = 1_000 as const;
export const LEGACY_CUP_COST_CENTS = 100 as const;
export const LEGACY_SIGN_COST_CENTS = 50 as const;

export type LegacyConfidence = 0 | 1 | 2 | 3 | 4 | 5;
export type LegacyWeatherVariant = 0 | 1 | 2 | 3;
export type LegacyConfidenceRoll = 1 | 2 | 3;

const coreOperatingNetCents = (entry: DailyLedgerEntry): number => {
  const operatingExpenses = entry.lines
    .filter((line) => line.kind === "production" || line.kind === "advertising")
    .reduce((total, line) => total + Number(line.amount), 0);
  return Number(entry.revenue) - operatingExpenses;
};

export const legacyOperatingBalanceCents = (
  state: Pick<GameState, "ledger">,
): number => {
  const startingBalanceCents: number = LEGACY_STARTING_BALANCE_CENTS;
  return state.ledger.reduce<number>(
    (balance, entry) => balance + coreOperatingNetCents(entry),
    startingBalanceCents,
  );
};

const confidenceAfterEntry = (
  balanceCents: number,
  dailyProfitCents: number,
  completedDaysBeforeEntry: number,
): LegacyConfidence => {
  if (balanceCents < LEGACY_STARTING_BALANCE_CENTS) return 0;
  if (dailyProfitCents === 0) return 2;

  const averageCents =
    (balanceCents - dailyProfitCents) / completedDaysBeforeEntry;
  if (dailyProfitCents < averageCents) return 1;

  if (dailyProfitCents - averageCents < 6_000) {
    return Math.round(
      (dailyProfitCents - averageCents) / 2_000 + 2,
    ) as LegacyConfidence;
  }

  return 5;
};

/**
 * Replays the 2017 determineConfidence() state machine from the immutable
 * ledger. This preserves the original first-day division-by-zero behavior:
 * the average is +Infinity and a positive first-day profit yields confidence 1.
 */
export const legacyConfidenceForState = (
  state: Pick<GameState, "ledger">,
): LegacyConfidence => {
  let balanceCents = LEGACY_STARTING_BALANCE_CENTS;
  let confidence: LegacyConfidence = 3;

  state.ledger.forEach((entry, index) => {
    const dailyProfitCents = coreOperatingNetCents(entry);
    balanceCents += dailyProfitCents;
    confidence = confidenceAfterEntry(balanceCents, dailyProfitCents, index);
  });

  return confidence;
};

export const legacyWeatherVariant = (weather: Weather): LegacyWeatherVariant => {
  switch (weather.kind) {
    case "thunderstorm":
      return 0;
    case "cloudy":
      return 1;
    case "hot-and-dry":
      return 2;
    case "sunny":
      return 3;
  }
};

export const legacyWeatherEffect = (weather: Weather): number => {
  const variant = legacyWeatherVariant(weather);
  return variant ** 2 + 1;
};

/**
 * The 2017 randomNumber(1, 3.5) expression yields 1/2/3 with probabilities
 * 40%/40%/20%. The modern environment stores that deterministic roll in the
 * existing sentiment union so older serialized document shapes remain compact.
 */
export const legacyConfidenceRoll = (
  sentiment: MarketSentiment,
): LegacyConfidenceRoll => {
  switch (sentiment.kind) {
    case "cold":
    case "very-cold":
    case "hot":
      return 1;
    case "neutral":
      return 2;
    case "warm":
      return 3;
  }
};
