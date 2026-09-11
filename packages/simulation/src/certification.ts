import { generateEnvironment, neutralEnvironment } from "./environment.js";
import { availableOperatingFunds, predictableFixedObligations } from "./finance.js";
import type {
  DailyLedgerEntry,
  DayDecision,
  DayEnvironment,
  DayResolution,
  GameState,
  LedgerLineKind,
  ProgressionTier,
} from "./model.js";
import {
  basisPoints,
  glassCount,
  moneyCents,
  seed,
  signCount,
  type Seed,
} from "./primitives.js";
import { createSeededRandom } from "./rng.js";
import { potentialDemand } from "./rules.js";
import { simulateDay } from "./simulate.js";
import { createInitialState } from "./state.js";
import { SIMULATION_SCHEMA_VERSION } from "./version.js";

export const CERTIFICATION_HORIZON_DAYS = 90 as const;

export const CERTIFICATION_SEEDS = Object.freeze([
  0x1e_ad_2026,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
] as const);

export const CERTIFICATION_STRATEGY_NAMES = Object.freeze([
  "conservative",
  "aggressive-inventory",
  "advertising-heavy",
  "high-price",
  "poor-decisions",
  "adaptive",
  "progression",
] as const);

export type CertificationStrategyName = (typeof CERTIFICATION_STRATEGY_NAMES)[number];

type ProposedDecision = Readonly<{
  glasses: number;
  signs: number;
  price: number;
}>;

type StrategyDefinition = Readonly<{
  name: CertificationStrategyName;
  description: string;
  decide(state: GameState, environment: DayEnvironment): DayDecision;
}>;

export type FinanceBurden = Readonly<{
  taxesCents: number;
  supplierFeesCents: number;
  bankFeesCents: number;
  loanInterestCents: number;
  savingsInterestCents: number;
  borrowedCents: number;
  repaidCents: number;
}>;

export type CertificationRunSummary = Readonly<{
  strategy: CertificationStrategyName;
  seed: number;
  completedDays: number;
  bankruptcyDay: number | null;
  finalCashCents: number;
  finalLoanBalanceCents: number;
  finalEquityCents: number;
  prepared: number;
  sold: number;
  waste: number;
  sellThroughBps: number;
  averagePriceHundredthsOfCent: number;
  averageSignsHundredths: number;
  exceptionalEvents: number;
  weatherContributionHundredths: number;
  sentimentContributionHundredths: number;
  eventImpactHundredths: number;
  maxTier: ProgressionTier;
  firstDayByTier: readonly (number | null)[];
  finance: FinanceBurden;
}>;

export type ProfileCertificationSummary = Readonly<{
  strategy: CertificationStrategyName;
  description: string;
  runs: number;
  bankruptRuns: number;
  earliestBankruptcyDay: number | null;
  survivalRateBps: number;
  finalEquityCents: Readonly<{
    min: number;
    p50: number;
    p90: number;
    max: number;
  }>;
  sellThroughBps: number;
  wasteRateBps: number;
  averagePriceHundredthsOfCent: number;
  averageSignsHundredths: number;
  exceptionalEventRateBps: number;
  weatherContributionHundredths: number;
  sentimentContributionHundredths: number;
  eventImpactHundredths: number;
  maxTier: ProgressionTier;
  earliestDayByTier: readonly (number | null)[];
  finance: FinanceBurden;
}>;

export type ControlledProbes = Readonly<{
  priceDemand: readonly Readonly<{ priceCents: number; demand: number }>[];
  advertising: readonly Readonly<{ signs: number; demand: number; marginalDemand: number }>[];
  weather: readonly Readonly<{ kind: string; demand: number }>[];
  sentiment: readonly Readonly<{ kind: string; demand: number }>[];
}>;

export type BalanceCertificationReport = Readonly<{
  simulationSchemaVersion: number;
  horizonDays: number;
  seeds: readonly number[];
  profiles: readonly ProfileCertificationSummary[];
  probes: ControlledProbes;
}>;

const expenseLineKinds: readonly LedgerLineKind[] = Object.freeze([
  "production",
  "advertising",
  "operating-fee",
  "tax",
  "bank-fee",
  "loan-interest",
]);

const cashExpenseLineKinds: readonly LedgerLineKind[] = Object.freeze([
  "production",
  "advertising",
  "operating-fee",
  "tax",
  "bank-fee",
]);

const financeZero = (): FinanceBurden =>
  Object.freeze({
    taxesCents: 0,
    supplierFeesCents: 0,
    bankFeesCents: 0,
    loanInterestCents: 0,
    savingsInterestCents: 0,
    borrowedCents: 0,
    repaidCents: 0,
  });

const failCertification = (message: string): never => {
  throw new Error(`Balance certification failed: ${message}`);
};

const requireInvariant = (condition: boolean, message: string): void => {
  if (!condition) failCertification(message);
};

const valueAt = <Value>(values: readonly Value[], index: number, label: string): Value => {
  const value = values[index];
  if (value === undefined) return failCertification(`${label} is incomplete`);
  return value;
};

const variableBudgetCents = (state: GameState): number =>
  Math.max(
    0,
    Number(availableOperatingFunds(state)) - Number(predictableFixedObligations(state)),
  );

const affordableDecision = (state: GameState, proposed: ProposedDecision): DayDecision => {
  const budget = variableBudgetCents(state);
  const requestedSigns = Math.max(0, Math.floor(proposed.signs));
  const requestedGlasses = Math.max(0, Math.floor(proposed.glasses));
  const price = Math.max(1, Math.floor(proposed.price));
  const signs = Math.min(requestedSigns, Math.floor(budget / Number(state.signCost)));
  const remaining = budget - signs * Number(state.signCost);
  const glasses = Math.min(requestedGlasses, Math.floor(remaining / Number(state.unitCost)));

  return Object.freeze({
    glasses: glassCount(glasses),
    signs: signCount(signs),
    price: moneyCents(price),
  });
};

const environmentStrength = (environment: DayEnvironment): number =>
  (Number(environment.weather.demandMultiplier) * Number(environment.sentiment.demandMultiplier)) /
  100_000_000;

const strategies: Readonly<Record<CertificationStrategyName, StrategyDefinition>> = Object.freeze({
  conservative: Object.freeze({
    name: "conservative",
    description: "Low price, no advertising, modest inventory.",
    decide: (state: GameState): DayDecision =>
      affordableDecision(state, { glasses: 28, signs: 0, price: 8 }),
  }),
  "aggressive-inventory": Object.freeze({
    name: "aggressive-inventory",
    description: "Commits most available working capital to inventory.",
    decide: (state: GameState): DayDecision => {
      const targetGlasses = Math.floor((variableBudgetCents(state) * 0.85) / Number(state.unitCost));
      return affordableDecision(state, {
        glasses: Math.min(160, targetGlasses),
        signs: 1,
        price: 9,
      });
    },
  }),
  "advertising-heavy": Object.freeze({
    name: "advertising-heavy",
    description: "Keeps five signs active and carries inventory for the resulting demand.",
    decide: (state: GameState): DayDecision =>
      affordableDecision(state, { glasses: 55, signs: 5, price: 10 }),
  }),
  "high-price": Object.freeze({
    name: "high-price",
    description: "Tests high-margin, low-volume play at twice the reference price.",
    decide: (state: GameState): DayDecision =>
      affordableDecision(state, { glasses: 30, signs: 1, price: 20 }),
  }),
  "poor-decisions": Object.freeze({
    name: "poor-decisions",
    description: "Intentionally overspends on signs while charging a demand-suppressing price.",
    decide: (state: GameState): DayDecision =>
      affordableDecision(state, { glasses: 10, signs: 8, price: 30 }),
  }),
  adaptive: Object.freeze({
    name: "adaptive",
    description: "Adjusts inventory, signs, and price from the visible weather/sentiment signal.",
    decide: (state: GameState, environment: DayEnvironment): DayDecision => {
      const strength = environmentStrength(environment);
      return affordableDecision(state, {
        glasses: strength >= 1.5 ? 70 : strength >= 1 ? 50 : 35,
        signs: strength < 0.9 ? 2 : 1,
        price: strength >= 1.15 ? 8 : strength >= 0.9 ? 9 : 7,
      });
    },
  }),
  progression: Object.freeze({
    name: "progression",
    description: "A growth-oriented policy intended to exercise every finance tier.",
    decide: (state: GameState, environment: DayEnvironment): DayDecision => {
      const strength = environmentStrength(environment);
      return affordableDecision(state, {
        glasses: strength >= 1.5 ? 75 : strength >= 0.9 ? 55 : 35,
        signs: 2,
        price: 9,
      });
    },
  }),
});

const sumLines = (entry: DailyLedgerEntry, kinds: readonly LedgerLineKind[]): number =>
  entry.lines.reduce(
    (total, line) => total + (kinds.includes(line.kind) ? Number(line.amount) : 0),
    0,
  );

const lineAmount = (entry: DailyLedgerEntry, kind: LedgerLineKind): number =>
  entry.lines.reduce(
    (total, line) => total + (line.kind === kind ? Number(line.amount) : 0),
    0,
  );

const certifyDailyResolution = (resolution: DayResolution): void => {
  const { previousState, nextState, entry } = resolution;
  const prepared = Number(entry.decision.glasses);
  const sold = Number(entry.sold);
  const expectedRevenue = sold * Number(entry.decision.price);
  const expenseLines = sumLines(entry, expenseLineKinds);
  const cashExpenseLines = sumLines(entry, cashExpenseLineKinds);
  const loanInterest = lineAmount(entry, "loan-interest");
  const paidLoanInterest =
    Number(previousState.loanBalance) +
    Number(entry.borrowed) +
    loanInterest -
    Number(entry.repaid) -
    Number(entry.endingLoanBalance);
  const expectedCash =
    Number(previousState.cash) +
    Number(entry.borrowed) +
    Number(entry.revenue) +
    Number(entry.financeIncome) -
    cashExpenseLines -
    paidLoanInterest -
    Number(entry.repaid);

  requireInvariant(sold <= prepared, `day ${String(Number(entry.day))} sold more than prepared`);
  requireInvariant(expectedRevenue === Number(entry.revenue), `day ${String(Number(entry.day))} revenue identity`);
  requireInvariant(expenseLines === Number(entry.expenses), `day ${String(Number(entry.day))} expense identity`);
  requireInvariant(
    Number(entry.revenue) + Number(entry.financeIncome) - Number(entry.expenses) === Number(entry.net),
    `day ${String(Number(entry.day))} net identity`,
  );
  requireInvariant(
    Number(entry.endingCash) - Number(previousState.cash) === Number(entry.cashDelta),
    `day ${String(Number(entry.day))} cash-delta identity`,
  );
  requireInvariant(
    paidLoanInterest >= 0 && paidLoanInterest <= loanInterest,
    `day ${String(Number(entry.day))} loan-interest settlement bounds`,
  );
  requireInvariant(expectedCash === Number(entry.endingCash), `day ${String(Number(entry.day))} cash-flow identity`);
  requireInvariant(nextState.cash === entry.endingCash, `day ${String(Number(entry.day))} next cash continuity`);
  requireInvariant(
    nextState.loanBalance === entry.endingLoanBalance,
    `day ${String(Number(entry.day))} next debt continuity`,
  );
  requireInvariant(
    Number(nextState.day) === Number(previousState.day) + 1,
    `day ${String(Number(entry.day))} day continuity`,
  );
  requireInvariant(
    nextState.ledger.length === previousState.ledger.length + 1,
    `day ${String(Number(entry.day))} ledger append`,
  );
};

const financeForEntry = (entry: DailyLedgerEntry): FinanceBurden =>
  Object.freeze({
    taxesCents: lineAmount(entry, "tax"),
    supplierFeesCents: lineAmount(entry, "operating-fee"),
    bankFeesCents: lineAmount(entry, "bank-fee"),
    loanInterestCents: lineAmount(entry, "loan-interest"),
    savingsInterestCents: lineAmount(entry, "savings-interest"),
    borrowedCents: Number(entry.borrowed),
    repaidCents: Number(entry.repaid),
  });

const addFinance = (left: FinanceBurden, right: FinanceBurden): FinanceBurden =>
  Object.freeze({
    taxesCents: left.taxesCents + right.taxesCents,
    supplierFeesCents: left.supplierFeesCents + right.supplierFeesCents,
    bankFeesCents: left.bankFeesCents + right.bankFeesCents,
    loanInterestCents: left.loanInterestCents + right.loanInterestCents,
    savingsInterestCents: left.savingsInterestCents + right.savingsInterestCents,
    borrowedCents: left.borrowedCents + right.borrowedCents,
    repaidCents: left.repaidCents + right.repaidCents,
  });

const roundRatio = (numerator: number, denominator: number, scale: number): number =>
  denominator === 0 ? 0 : Math.round((numerator * scale) / denominator);

const demandContribution = (
  entry: DailyLedgerEntry,
): Readonly<{ weather: number; sentiment: number; event: number }> => {
  const neutral = neutralEnvironment();
  const neutralDemand = Number(potentialDemand(entry.decision.price, entry.decision.signs, neutral));
  const weatherOnly: DayEnvironment = Object.freeze({
    weather: entry.environment.weather,
    sentiment: neutral.sentiment,
    event: neutral.event,
  });
  const sentimentOnly: DayEnvironment = Object.freeze({
    weather: neutral.weather,
    sentiment: entry.environment.sentiment,
    event: neutral.event,
  });
  const eventNeutralized: DayEnvironment = Object.freeze({
    weather: entry.environment.weather,
    sentiment: entry.environment.sentiment,
    event: neutral.event,
  });
  const weatherDemand = Number(
    potentialDemand(entry.decision.price, entry.decision.signs, weatherOnly),
  );
  const sentimentDemand = Number(
    potentialDemand(entry.decision.price, entry.decision.signs, sentimentOnly),
  );
  const baselineEventDemand = Number(
    potentialDemand(entry.decision.price, entry.decision.signs, eventNeutralized),
  );
  const baselineEventSold = Math.min(Number(entry.decision.glasses), baselineEventDemand);

  return Object.freeze({
    weather: Math.abs(weatherDemand - neutralDemand),
    sentiment: Math.abs(sentimentDemand - neutralDemand),
    event: Math.abs(Number(entry.sold) - baselineEventSold),
  });
};

const runStrategy = (
  strategy: StrategyDefinition,
  runSeed: Seed,
  horizonDays: number,
): CertificationRunSummary => {
  let state = createInitialState();
  const random = createSeededRandom(runSeed);
  let bankruptcyDay: number | null = null;
  let prepared = 0;
  let sold = 0;
  let totalPrice = 0;
  let totalSigns = 0;
  let exceptionalEvents = 0;
  let weatherContribution = 0;
  let sentimentContribution = 0;
  let eventImpact = 0;
  let finance = financeZero();
  let maxTier: ProgressionTier = state.tier;
  const firstDayByTier: (number | null)[] = [1, null, null, null, null];

  for (let index = 0; index < horizonDays; index += 1) {
    if (Number(availableOperatingFunds(state)) < Number(predictableFixedObligations(state))) {
      bankruptcyDay = Number(state.day);
      break;
    }

    const environment = generateEnvironment(state.day, random);
    const decision = strategy.decide(state, environment);
    const resolution = simulateDay(state, decision, environment);
    certifyDailyResolution(resolution);

    const entry = resolution.entry;
    const contribution = demandContribution(entry);
    prepared += Number(entry.decision.glasses);
    sold += Number(entry.sold);
    totalPrice += Number(entry.decision.price);
    totalSigns += Number(entry.decision.signs);
    exceptionalEvents += entry.environment.event.kind === "none" ? 0 : 1;
    weatherContribution += contribution.weather;
    sentimentContribution += contribution.sentiment;
    eventImpact += contribution.event;
    finance = addFinance(finance, financeForEntry(entry));

    state = resolution.nextState;
    maxTier = state.tier > maxTier ? state.tier : maxTier;
    if (firstDayByTier[state.tier] === null) {
      firstDayByTier[state.tier] = Number(state.day);
    }
  }

  const completedDays = state.ledger.length;
  const waste = prepared - sold;

  return Object.freeze({
    strategy: strategy.name,
    seed: Number(runSeed),
    completedDays,
    bankruptcyDay,
    finalCashCents: Number(state.cash),
    finalLoanBalanceCents: Number(state.loanBalance),
    finalEquityCents: Number(state.cash) - Number(state.loanBalance),
    prepared,
    sold,
    waste,
    sellThroughBps: roundRatio(sold, prepared, 10_000),
    averagePriceHundredthsOfCent: roundRatio(totalPrice, completedDays, 100),
    averageSignsHundredths: roundRatio(totalSigns, completedDays, 100),
    exceptionalEvents,
    weatherContributionHundredths: roundRatio(weatherContribution, completedDays, 100),
    sentimentContributionHundredths: roundRatio(sentimentContribution, completedDays, 100),
    eventImpactHundredths: roundRatio(eventImpact, completedDays, 100),
    maxTier,
    firstDayByTier: Object.freeze(firstDayByTier),
    finance,
  });
};

const percentile = (values: readonly number[], ratio: number): number => {
  if (values.length === 0) return failCertification("cannot summarize an empty value set");
  const ordered = [...values].sort((a, b) => a - b);
  return valueAt(ordered, Math.floor((ordered.length - 1) * ratio), "percentile values");
};

const aggregateFinance = (runs: readonly CertificationRunSummary[]): FinanceBurden =>
  runs.reduce<FinanceBurden>((total, run) => addFinance(total, run.finance), financeZero());

const earliestTierDays = (runs: readonly CertificationRunSummary[]): readonly (number | null)[] =>
  Object.freeze(
    [0, 1, 2, 3, 4].map((tier) => {
      const days = runs
        .map((run) => run.firstDayByTier[tier] ?? null)
        .filter((day): day is number => day !== null);
      return days.length === 0 ? null : Math.min(...days);
    }),
  );

const aggregateProfile = (
  strategy: StrategyDefinition,
  runs: readonly CertificationRunSummary[],
): ProfileCertificationSummary => {
  const completedDays = runs.reduce((total, run) => total + run.completedDays, 0);
  const prepared = runs.reduce((total, run) => total + run.prepared, 0);
  const sold = runs.reduce((total, run) => total + run.sold, 0);
  const exceptionalEvents = runs.reduce((total, run) => total + run.exceptionalEvents, 0);
  const bankruptDays = runs
    .map((run) => run.bankruptcyDay)
    .filter((day): day is number => day !== null);
  const equities = runs.map((run) => run.finalEquityCents);
  const maxTier = runs.reduce<ProgressionTier>(
    (maximum, run) => (run.maxTier > maximum ? run.maxTier : maximum),
    0,
  );

  return Object.freeze({
    strategy: strategy.name,
    description: strategy.description,
    runs: runs.length,
    bankruptRuns: bankruptDays.length,
    earliestBankruptcyDay: bankruptDays.length === 0 ? null : Math.min(...bankruptDays),
    survivalRateBps: roundRatio(runs.length - bankruptDays.length, runs.length, 10_000),
    finalEquityCents: Object.freeze({
      min: percentile(equities, 0),
      p50: percentile(equities, 0.5),
      p90: percentile(equities, 0.9),
      max: percentile(equities, 1),
    }),
    sellThroughBps: roundRatio(sold, prepared, 10_000),
    wasteRateBps: roundRatio(prepared - sold, prepared, 10_000),
    averagePriceHundredthsOfCent: roundRatio(
      runs.reduce((total, run) => total + run.averagePriceHundredthsOfCent * run.completedDays, 0),
      completedDays,
      1,
    ),
    averageSignsHundredths: roundRatio(
      runs.reduce((total, run) => total + run.averageSignsHundredths * run.completedDays, 0),
      completedDays,
      1,
    ),
    exceptionalEventRateBps: roundRatio(exceptionalEvents, completedDays, 10_000),
    weatherContributionHundredths: roundRatio(
      runs.reduce((total, run) => total + run.weatherContributionHundredths * run.completedDays, 0),
      completedDays,
      1,
    ),
    sentimentContributionHundredths: roundRatio(
      runs.reduce((total, run) => total + run.sentimentContributionHundredths * run.completedDays, 0),
      completedDays,
      1,
    ),
    eventImpactHundredths: roundRatio(
      runs.reduce((total, run) => total + run.eventImpactHundredths * run.completedDays, 0),
      completedDays,
      1,
    ),
    maxTier,
    earliestDayByTier: earliestTierDays(runs),
    finance: aggregateFinance(runs),
  });
};

const controlledProbes = (): ControlledProbes => {
  const neutral = neutralEnvironment();
  const priceDemand = Object.freeze(
    [5, 8, 10, 12, 15, 20].map((priceCents) =>
      Object.freeze({
        priceCents,
        demand: Number(potentialDemand(moneyCents(priceCents), signCount(0), neutral)),
      }),
    ),
  );

  let previousDemand = 0;
  const advertising = Object.freeze(
    [0, 1, 2, 3, 4, 5].map((signs) => {
      const demand = Number(potentialDemand(moneyCents(10), signCount(signs), neutral));
      const point = Object.freeze({
        signs,
        demand,
        marginalDemand: signs === 0 ? demand : demand - previousDemand,
      });
      previousDemand = demand;
      return point;
    }),
  );

  const weatherVariants = Object.freeze([
    Object.freeze({ kind: "thunderstorm", demandMultiplier: basisPoints(0) }),
    Object.freeze({ kind: "cloudy", demandMultiplier: basisPoints(7_000) }),
    Object.freeze({ kind: "sunny", demandMultiplier: basisPoints(10_000) }),
    Object.freeze({ kind: "hot-and-dry", demandMultiplier: basisPoints(20_000) }),
  ] as const);
  const weather = Object.freeze(
    weatherVariants.map((variant) =>
      Object.freeze({
        kind: variant.kind,
        demand: Number(
          potentialDemand(
            moneyCents(10),
            signCount(1),
            Object.freeze({ weather: variant, sentiment: neutral.sentiment, event: neutral.event }),
          ),
        ),
      }),
    ),
  );

  const sentimentVariants = Object.freeze([
    Object.freeze({ kind: "very-cold", demandMultiplier: basisPoints(8_500) }),
    Object.freeze({ kind: "cold", demandMultiplier: basisPoints(9_250) }),
    Object.freeze({ kind: "neutral", demandMultiplier: basisPoints(10_000) }),
    Object.freeze({ kind: "warm", demandMultiplier: basisPoints(10_750) }),
    Object.freeze({ kind: "hot", demandMultiplier: basisPoints(11_500) }),
  ] as const);
  const sentiment = Object.freeze(
    sentimentVariants.map((variant) =>
      Object.freeze({
        kind: variant.kind,
        demand: Number(
          potentialDemand(
            moneyCents(10),
            signCount(1),
            Object.freeze({ weather: neutral.weather, sentiment: variant, event: neutral.event }),
          ),
        ),
      }),
    ),
  );

  return Object.freeze({ priceDemand, advertising, weather, sentiment });
};

export const runBalanceCertification = (
  horizonDays = CERTIFICATION_HORIZON_DAYS,
  seedValues: readonly number[] = CERTIFICATION_SEEDS,
): BalanceCertificationReport => {
  requireInvariant(
    Number.isSafeInteger(horizonDays) && horizonDays > 0,
    "certification horizon must be a positive safe integer",
  );
  requireInvariant(seedValues.length > 0, "certification requires at least one seed");

  const profiles = CERTIFICATION_STRATEGY_NAMES.map((name) => {
    const strategy = strategies[name];
    const runs = seedValues.map((value) => runStrategy(strategy, seed(value), horizonDays));
    return aggregateProfile(strategy, runs);
  });

  return Object.freeze({
    simulationSchemaVersion: SIMULATION_SCHEMA_VERSION,
    horizonDays,
    seeds: Object.freeze([...seedValues]),
    profiles: Object.freeze(profiles),
    probes: controlledProbes(),
  });
};

const profile = (
  report: BalanceCertificationReport,
  name: CertificationStrategyName,
): ProfileCertificationSummary => {
  const result = report.profiles.find((candidate) => candidate.strategy === name);
  if (result === undefined) return failCertification(`missing strategy profile ${name}`);
  return result;
};

type DemandProbePoint = Readonly<{ kind?: string; priceCents?: number; demand: number }>;

const demandAt = (
  points: readonly DemandProbePoint[],
  predicate: (point: DemandProbePoint) => boolean,
): number => {
  const point = points.find(predicate);
  if (point === undefined) return failCertification("missing controlled demand probe");
  return point.demand;
};

export const assertBalanceCertification = (report: BalanceCertificationReport): void => {
  requireInvariant(
    report.simulationSchemaVersion === SIMULATION_SCHEMA_VERSION,
    "report simulation schema does not match the running engine",
  );
  requireInvariant(
    report.profiles.length === CERTIFICATION_STRATEGY_NAMES.length,
    "fixture corpus is incomplete",
  );

  for (const stableName of [
    "conservative",
    "advertising-heavy",
    "adaptive",
    "progression",
  ] as const) {
    requireInvariant(
      profile(report, stableName).survivalRateBps === 10_000,
      `${stableName} should survive the certification horizon across the fixed seed corpus`,
    );
  }

  const conservative = profile(report, "conservative");
  const advertisingHeavy = profile(report, "advertising-heavy");
  const highPrice = profile(report, "high-price");
  const poor = profile(report, "poor-decisions");
  const adaptive = profile(report, "adaptive");
  const progression = profile(report, "progression");

  requireInvariant(
    conservative.finalEquityCents.p50 >= 3_000,
    "conservative median equity fell below the survivability guardrail",
  );
  requireInvariant(
    adaptive.finalEquityCents.p50 >= 5_000,
    "adaptive median equity fell below the growth guardrail",
  );
  requireInvariant(
    progression.finalEquityCents.p50 >= 8_000,
    "progression median equity fell below the tier-exercise guardrail",
  );
  requireInvariant(
    poor.finalEquityCents.p50 < adaptive.finalEquityCents.p50,
    "intentionally poor decisions should not outperform adaptive play",
  );
  requireInvariant(
    highPrice.sellThroughBps < 7_000,
    "high-price play no longer pays a material volume penalty",
  );
  requireInvariant(
    advertisingHeavy.averageSignsHundredths > conservative.averageSignsHundredths + 300,
    "advertising-heavy and conservative fixtures no longer exercise distinct advertising regimes",
  );
  requireInvariant(progression.maxTier === 4, "progression fixture must reach tier 4");
  requireInvariant(
    progression.earliestDayByTier.slice(0, 5).every((day) => day !== null),
    "progression fixture must visit every current finance tier",
  );

  const medianEquities = report.profiles.map((item) => item.finalEquityCents.p50);
  requireInvariant(
    Math.max(...medianEquities) - Math.min(...medianEquities) >= 5_000,
    "strategy outcomes collapsed into an insufficient equity spread",
  );
  const sellThrough = report.profiles.map((item) => item.sellThroughBps);
  requireInvariant(
    Math.max(...sellThrough) - Math.min(...sellThrough) >= 3_000,
    "strategy outcomes collapsed into an insufficient sell-through spread",
  );

  const demandAtFive = demandAt(report.probes.priceDemand, (point) => point.priceCents === 5);
  const demandAtTen = demandAt(report.probes.priceDemand, (point) => point.priceCents === 10);
  const demandAtTwenty = demandAt(report.probes.priceDemand, (point) => point.priceCents === 20);
  requireInvariant(
    demandAtFive > demandAtTen && demandAtTen > demandAtTwenty,
    "price/demand probe must remain strictly decreasing across 5c, 10c, and 20c",
  );

  const advertisingMarginals = report.probes.advertising
    .filter((point) => point.signs > 0)
    .map((point) => point.marginalDemand);
  requireInvariant(
    advertisingMarginals.length > 1 && valueAt(advertisingMarginals, 0, "advertising marginal probe") > 0,
    "advertising probe must produce positive first-sign demand",
  );
  for (let index = 1; index < advertisingMarginals.length; index += 1) {
    const previous = valueAt(advertisingMarginals, index - 1, "advertising marginal probe");
    const current = valueAt(advertisingMarginals, index, "advertising marginal probe");
    requireInvariant(current <= previous, "advertising marginal benefit must not increase with more signs");
  }

  const thunderstorm = demandAt(report.probes.weather, (point) => point.kind === "thunderstorm");
  const cloudy = demandAt(report.probes.weather, (point) => point.kind === "cloudy");
  const sunny = demandAt(report.probes.weather, (point) => point.kind === "sunny");
  const hotAndDry = demandAt(report.probes.weather, (point) => point.kind === "hot-and-dry");
  requireInvariant(
    thunderstorm === 0 && cloudy < sunny && sunny < hotAndDry,
    "weather demand ordering changed unexpectedly",
  );

  const veryCold = demandAt(report.probes.sentiment, (point) => point.kind === "very-cold");
  const neutralSentiment = demandAt(report.probes.sentiment, (point) => point.kind === "neutral");
  const hotSentiment = demandAt(report.probes.sentiment, (point) => point.kind === "hot");
  requireInvariant(
    veryCold < neutralSentiment && neutralSentiment < hotSentiment,
    "market sentiment demand ordering changed unexpectedly",
  );
};

const dollars = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
const percentFromBps = (bps: number): string => `${(bps / 100).toFixed(1)}%`;
const decimalHundredths = (hundredths: number): string => (hundredths / 100).toFixed(2);

export const formatBalanceCertification = (report: BalanceCertificationReport): string => {
  const lines = [
    "# Lemonade balance certification",
    "",
    `Simulation schema: ${String(report.simulationSchemaVersion)}`,
    `Corpus: ${String(report.profiles.length)} strategies × ${String(report.seeds.length)} seeds × up to ${String(report.horizonDays)} days`,
    "",
    "| Strategy | Survival | Equity p50 | Equity p90 | Sell-through | Avg price | Avg signs | Max tier |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const item of report.profiles) {
    lines.push(
      `| ${item.strategy} | ${percentFromBps(item.survivalRateBps)} | ${dollars(item.finalEquityCents.p50)} | ${dollars(item.finalEquityCents.p90)} | ${percentFromBps(item.sellThroughBps)} | ${(item.averagePriceHundredthsOfCent / 100).toFixed(2)}¢ | ${decimalHundredths(item.averageSignsHundredths)} | ${String(item.maxTier)} |`,
    );
  }

  lines.push(
    "",
    "## Signal and event sensitivity",
    "",
    "| Strategy | Weather Δ demand/day | Sentiment Δ demand/day | Exceptional-event rate | Event impact/day |",
    "| --- | ---: | ---: | ---: | ---: |",
  );
  for (const item of report.profiles) {
    lines.push(
      `| ${item.strategy} | ${decimalHundredths(item.weatherContributionHundredths)} | ${decimalHundredths(item.sentimentContributionHundredths)} | ${percentFromBps(item.exceptionalEventRateBps)} | ${decimalHundredths(item.eventImpactHundredths)} |`,
    );
  }

  lines.push(
    "",
    "## Finance burden across the corpus",
    "",
    "| Strategy | Taxes | Supplier fees | Bank fees | Loan interest | Borrowed | Repaid | Savings interest |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const item of report.profiles) {
    lines.push(
      `| ${item.strategy} | ${dollars(item.finance.taxesCents)} | ${dollars(item.finance.supplierFeesCents)} | ${dollars(item.finance.bankFeesCents)} | ${dollars(item.finance.loanInterestCents)} | ${dollars(item.finance.borrowedCents)} | ${dollars(item.finance.repaidCents)} | ${dollars(item.finance.savingsInterestCents)} |`,
    );
  }

  lines.push(
    "",
    "## Controlled probes",
    "",
    `Price → demand: ${report.probes.priceDemand.map((point) => `${String(point.priceCents)}¢=${String(point.demand)}`).join(", ")}`,
    `Signs → demand (marginal): ${report.probes.advertising.map((point) => `${String(point.signs)}=${String(point.demand)} (+${String(point.marginalDemand)})`).join(", ")}`,
    `Weather → demand: ${report.probes.weather.map((point) => `${point.kind}=${String(point.demand)}`).join(", ")}`,
    `Sentiment → demand: ${report.probes.sentiment.map((point) => `${point.kind}=${String(point.demand)}`).join(", ")}`,
    "",
    "Certification guardrails: PASS",
  );

  return lines.join("\n");
};
