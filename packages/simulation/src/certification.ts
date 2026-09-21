import { generateEnvironment, neutralEnvironment } from "./environment.js";
import { availableOperatingFunds, predictableFixedObligations } from "./finance.js";
import {
  LEGACY_STARTING_BALANCE_CENTS,
  legacyConfidenceForState,
  legacyMarketingEffect,
  legacyOperatingBalanceCents,
  legacyWeatherEffect,
} from "./legacy.js";
import type {
  DailyLedgerEntry,
  DayDecision,
  DayEnvironment,
  DayResolution,
  GameState,
  LedgerLineKind,
  ProgressionTier,
  Weather,
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
import { operatingScaleForState, type OperatingScaleLevel } from "./scale.js";
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
  finalOperatingBalanceCents: number;
  prepared: number;
  sold: number;
  waste: number;
  sellThroughBps: number;
  averagePriceHundredthsOfCent: number;
  averageSignsHundredths: number;
  maxTier: ProgressionTier;
  firstDayByTier: readonly (number | null)[];
  maxOperatingScale: OperatingScaleLevel;
  firstDayByOperatingScale: readonly (number | null)[];
  finance: FinanceBurden;
}>;

export type ProfileCertificationSummary = Readonly<{
  strategy: CertificationStrategyName;
  description: string;
  runs: number;
  bankruptRuns: number;
  survivalRateBps: number;
  finalOperatingBalanceCents: Readonly<{
    min: number;
    p50: number;
    p90: number;
    max: number;
  }>;
  sellThroughBps: number;
  wasteRateBps: number;
  averagePriceHundredthsOfCent: number;
  averageSignsHundredths: number;
  maxTier: ProgressionTier;
  earliestDayByTier: readonly (number | null)[];
  maxOperatingScale: OperatingScaleLevel;
  earliestDayByOperatingScale: readonly (number | null)[];
  finance: FinanceBurden;
}>;

export type ControlledProbes = Readonly<{
  priceDemand: readonly Readonly<{ priceCents: number; demand: number }>[];
  advertising: readonly Readonly<{ signs: number; effect: number; demand: number }>[];
  weather: readonly Readonly<{ kind: Weather["kind"]; effect: number; demand: number }>[];
  confidence: readonly Readonly<{ confidence: number; demand: number }>[];
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
  const scale = operatingScaleForState(state);
  const requestedSigns = Math.min(scale.maxSigns, Math.max(0, Math.floor(proposed.signs)));
  const requestedGlasses = Math.min(scale.maxGlasses, Math.max(0, Math.floor(proposed.glasses)));
  const price = Math.min(scale.maxPriceCents, Math.max(1, Math.floor(proposed.price)));
  const signs = Math.min(requestedSigns, Math.floor(budget / Number(state.signCost)));
  const remaining = budget - signs * Number(state.signCost);
  const glasses = Math.min(requestedGlasses, Math.floor(remaining / Number(state.unitCost)));

  return Object.freeze({
    glasses: glassCount(glasses),
    signs: signCount(signs),
    price: moneyCents(price),
  });
};

const strategies: Readonly<Record<CertificationStrategyName, StrategyDefinition>> = Object.freeze({
  conservative: Object.freeze({
    name: "conservative",
    description: "A small 2017-style stand: five cups, no signs, $1.50 price.",
    decide: (state: GameState): DayDecision =>
      affordableDecision(state, { glasses: 5, signs: 0, price: 150 }),
  }),
  "aggressive-inventory": Object.freeze({
    name: "aggressive-inventory",
    description: "Uses the unlocked inventory envelope without changing the 2017 price law.",
    decide: (state: GameState): DayDecision => {
      const scale = operatingScaleForState(state);
      return affordableDecision(state, {
        glasses: scale.maxGlasses,
        signs: 0,
        price: 150,
      });
    },
  }),
  "advertising-heavy": Object.freeze({
    name: "advertising-heavy",
    description: "Exercises the original signs-squared/log advertising term.",
    decide: (state: GameState): DayDecision => {
      const scale = operatingScaleForState(state);
      return affordableDecision(state, {
        glasses: scale.maxGlasses,
        signs: scale.maxSigns,
        price: 150,
      });
    },
  }),
  "high-price": Object.freeze({
    name: "high-price",
    description: "Uses the highest unlocked price without any special 10-cent penalty.",
    decide: (state: GameState): DayDecision => {
      const scale = operatingScaleForState(state);
      return affordableDecision(state, {
        glasses: Math.min(10, scale.maxGlasses),
        signs: 1,
        price: scale.maxPriceCents,
      });
    },
  }),
  "poor-decisions": Object.freeze({
    name: "poor-decisions",
    description: "Overproduces and advertises while pricing below production cost.",
    decide: (state: GameState): DayDecision => {
      const scale = operatingScaleForState(state);
      return affordableDecision(state, {
        glasses: scale.maxGlasses,
        signs: scale.maxSigns,
        price: 50,
      });
    },
  }),
  adaptive: Object.freeze({
    name: "adaptive",
    description: "Adapts the same three decisions to the visible 2017 weather variant.",
    decide: (state: GameState, environment: DayEnvironment): DayDecision => {
      const weatherEffect = legacyWeatherEffect(environment.weather);
      if (weatherEffect >= 10) {
        return affordableDecision(state, { glasses: 12, signs: 1, price: 200 });
      }
      if (weatherEffect >= 5) {
        return affordableDecision(state, { glasses: 9, signs: 1, price: 175 });
      }
      if (weatherEffect >= 2) {
        return affordableDecision(state, { glasses: 6, signs: 0, price: 150 });
      }
      return affordableDecision(state, { glasses: 3, signs: 0, price: 125 });
    },
  }),
  progression: Object.freeze({
    name: "progression",
    description: "Growth policy intended to exercise the historical operating levels.",
    decide: (state: GameState): DayDecision => {
      const scale = operatingScaleForState(state);
      return affordableDecision(state, {
        glasses: scale.maxGlasses,
        signs: Math.min(2, scale.maxSigns),
        price: Math.min(200, scale.maxPriceCents),
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
  requireInvariant(expectedRevenue === Number(entry.revenue), "revenue identity");
  requireInvariant(expenseLines === Number(entry.expenses), "expense identity");
  requireInvariant(
    Number(entry.revenue) + Number(entry.financeIncome) - Number(entry.expenses) === Number(entry.net),
    "net identity",
  );
  requireInvariant(expectedCash === Number(entry.endingCash), "cash-flow identity");
  requireInvariant(nextState.cash === entry.endingCash, "next-state cash continuity");
  requireInvariant(nextState.loanBalance === entry.endingLoanBalance, "next-state debt continuity");
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
  let finance = financeZero();
  let maxTier: ProgressionTier = state.tier;
  const firstDayByTier: (number | null)[] = [1, null, null, null, null];
  let maxOperatingScale = operatingScaleForState(state).level;
  const firstDayByOperatingScale: (number | null)[] = [1, null, null, null];

  for (let index = 0; index < horizonDays; index += 1) {
    if (
      legacyOperatingBalanceCents(state) < LEGACY_STARTING_BALANCE_CENTS ||
      Number(availableOperatingFunds(state)) < Number(predictableFixedObligations(state))
    ) {
      bankruptcyDay = Number(state.day);
      break;
    }

    const environment = generateEnvironment(state.day, random);
    const decision = strategy.decide(state, environment);
    const resolution = simulateDay(state, decision, environment);
    certifyDailyResolution(resolution);

    const entry = resolution.entry;
    prepared += Number(entry.decision.glasses);
    sold += Number(entry.sold);
    totalPrice += Number(entry.decision.price);
    totalSigns += Number(entry.decision.signs);
    finance = addFinance(finance, financeForEntry(entry));

    state = resolution.nextState;
    maxTier = state.tier > maxTier ? state.tier : maxTier;
    if (firstDayByTier[state.tier] === null) {
      firstDayByTier[state.tier] = Number(state.day);
    }
    const operatingScale = operatingScaleForState(state).level;
    maxOperatingScale =
      operatingScale > maxOperatingScale ? operatingScale : maxOperatingScale;
    if (firstDayByOperatingScale[operatingScale - 1] === null) {
      firstDayByOperatingScale[operatingScale - 1] = Number(state.day);
    }
  }

  const completedDays = state.ledger.length;
  return Object.freeze({
    strategy: strategy.name,
    seed: Number(runSeed),
    completedDays,
    bankruptcyDay,
    finalCashCents: Number(state.cash),
    finalLoanBalanceCents: Number(state.loanBalance),
    finalOperatingBalanceCents: legacyOperatingBalanceCents(state),
    prepared,
    sold,
    waste: prepared - sold,
    sellThroughBps: roundRatio(sold, prepared, 10_000),
    averagePriceHundredthsOfCent: roundRatio(totalPrice, completedDays, 100),
    averageSignsHundredths: roundRatio(totalSigns, completedDays, 100),
    maxTier,
    firstDayByTier: Object.freeze(firstDayByTier),
    maxOperatingScale,
    firstDayByOperatingScale: Object.freeze(firstDayByOperatingScale),
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

const earliestDays = (
  runs: readonly CertificationRunSummary[],
  selector: (run: CertificationRunSummary) => readonly (number | null)[],
  indices: readonly number[],
): readonly (number | null)[] =>
  Object.freeze(
    indices.map((index) => {
      const days = runs
        .map((run) => selector(run)[index] ?? null)
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
  const balances = runs.map((run) => run.finalOperatingBalanceCents);
  const maxTier = runs.reduce<ProgressionTier>(
    (maximum, run) => (run.maxTier > maximum ? run.maxTier : maximum),
    0,
  );
  const maxOperatingScale = runs.reduce<OperatingScaleLevel>(
    (maximum, run) => (run.maxOperatingScale > maximum ? run.maxOperatingScale : maximum),
    1,
  );
  const bankruptRuns = runs.filter((run) => run.bankruptcyDay !== null).length;

  return Object.freeze({
    strategy: strategy.name,
    description: strategy.description,
    runs: runs.length,
    bankruptRuns,
    survivalRateBps: roundRatio(runs.length - bankruptRuns, runs.length, 10_000),
    finalOperatingBalanceCents: Object.freeze({
      min: percentile(balances, 0),
      p50: percentile(balances, 0.5),
      p90: percentile(balances, 0.9),
      max: percentile(balances, 1),
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
    maxTier,
    earliestDayByTier: earliestDays(runs, (run) => run.firstDayByTier, [0, 1, 2, 3, 4]),
    maxOperatingScale,
    earliestDayByOperatingScale: earliestDays(
      runs,
      (run) => run.firstDayByOperatingScale,
      [0, 1, 2, 3],
    ),
    finance: aggregateFinance(runs),
  });
};

const environmentForWeather = (kind: Weather["kind"]): DayEnvironment => {
  const neutral = neutralEnvironment();
  return Object.freeze({
    weather: Object.freeze({
      kind,
      demandMultiplier: basisPoints(10_000),
    }) as Weather,
    sentiment: neutral.sentiment,
    event: neutral.event,
  });
};

const controlledProbes = (): ControlledProbes => {
  const neutral = neutralEnvironment();
  const priceDemand = Object.freeze(
    [100, 150, 200, 250, 299].map((priceCents) =>
      Object.freeze({
        priceCents,
        demand: Number(
          potentialDemand(moneyCents(priceCents), signCount(1), 3, neutral),
        ),
      }),
    ),
  );

  const advertising = Object.freeze(
    [0, 1, 2, 3, 5, 10].map((signs) =>
      Object.freeze({
        signs,
        effect: legacyMarketingEffect(signCount(signs)),
        demand: Number(
          potentialDemand(moneyCents(150), signCount(signs), 3, neutral),
        ),
      }),
    ),
  );

  const weather = Object.freeze(
    (["thunderstorm", "cloudy", "hot-and-dry", "sunny"] as const).map((kind) => {
      const environment = environmentForWeather(kind);
      return Object.freeze({
        kind,
        effect: legacyWeatherEffect(environment.weather),
        demand: Number(
          potentialDemand(moneyCents(150), signCount(1), 3, environment),
        ),
      });
    }),
  );

  const confidence = Object.freeze(
    [0, 1, 2, 3, 4, 5].map((value) =>
      Object.freeze({
        confidence: value,
        demand: Number(
          potentialDemand(
            moneyCents(150),
            signCount(1),
            value as ReturnType<typeof legacyConfidenceForState>,
            neutral,
          ),
        ),
      }),
    ),
  );

  return Object.freeze({ priceDemand, advertising, weather, confidence });
};

export const runBalanceCertification = (
  horizonDays: number = CERTIFICATION_HORIZON_DAYS,
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

export const assertBalanceCertification = (report: BalanceCertificationReport): void => {
  requireInvariant(
    report.simulationSchemaVersion === SIMULATION_SCHEMA_VERSION,
    "report simulation schema does not match the running engine",
  );
  requireInvariant(
    report.profiles.length === CERTIFICATION_STRATEGY_NAMES.length,
    "fixture corpus is incomplete",
  );

  const price = report.probes.priceDemand;
  for (let index = 1; index < price.length; index += 1) {
    requireInvariant(
      valueAt(price, index - 1, "price probe").demand >
        valueAt(price, index, "price probe").demand,
      "2017 inverse-price demand must remain continuously decreasing",
    );
  }

  const revenuePotentials = price.map((point) => point.priceCents * point.demand);
  requireInvariant(
    Math.max(...revenuePotentials) - Math.min(...revenuePotentials) <= 300,
    "inverse-price probe developed a discontinuous price penalty",
  );

  const advertising = report.probes.advertising;
  for (let index = 1; index < advertising.length; index += 1) {
    requireInvariant(
      valueAt(advertising, index, "advertising probe").effect >=
        valueAt(advertising, index - 1, "advertising probe").effect,
      "2017 signs-squared/log advertising effect must not decrease",
    );
  }

  requireInvariant(
    Math.abs(valueAt(advertising, 1, "advertising probe").effect - 1 / Math.log(2)) < 1e-9,
    "one-sign marketing effect no longer matches the 2017 equation",
  );

  const weatherEffects = report.probes.weather.map((point) => point.effect);
  requireInvariant(
    weatherEffects.join(",") === "1,2,5,10",
    "weather variants must preserve the 2017 v^2 + 1 effects",
  );

  const confidence = report.probes.confidence.map((point) => point.demand);
  for (let index = 1; index < confidence.length; index += 1) {
    requireInvariant(
      valueAt(confidence, index, "confidence probe") >=
        valueAt(confidence, index - 1, "confidence probe"),
      "confidence contribution must remain monotonic",
    );
  }

  const progression = report.profiles.find((item) => item.strategy === "progression");
  if (progression === undefined) failCertification("missing progression profile");
  requireInvariant(
    progression.maxOperatingScale >= 2,
    "growth fixture must exercise historical operating progression",
  );
};

const dollars = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
const percentFromBps = (bps: number): string => `${(bps / 100).toFixed(1)}%`;
const decimalHundredths = (hundredths: number): string => (hundredths / 100).toFixed(2);

export const formatBalanceCertification = (report: BalanceCertificationReport): string => {
  const lines = [
    "# Lemonade 2017 balance certification",
    "",
    `Simulation schema: ${String(report.simulationSchemaVersion)}`,
    `Corpus: ${String(report.profiles.length)} strategies × ${String(report.seeds.length)} seeds × up to ${String(report.horizonDays)} days`,
    "",
    "| Strategy | Survival | Operating balance p50 | Sell-through | Avg price | Avg signs | Max stand | Finance tier |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const item of report.profiles) {
    lines.push(
      `| ${item.strategy} | ${percentFromBps(item.survivalRateBps)} | ${dollars(item.finalOperatingBalanceCents.p50)} | ${percentFromBps(item.sellThroughBps)} | ${dollars(Math.round(item.averagePriceHundredthsOfCent / 100))} | ${decimalHundredths(item.averageSignsHundredths)} | ${String(item.maxOperatingScale)} | ${String(item.maxTier)} |`,
    );
  }

  lines.push(
    "",
    "## 2017 controlled probes",
    "",
    `Price → demand: ${report.probes.priceDemand.map((point) => `${dollars(point.priceCents)}=${String(point.demand)}`).join(", ")}`,
    `Signs → marketing effect: ${report.probes.advertising.map((point) => `${String(point.signs)}=${point.effect.toFixed(3)}`).join(", ")}`,
    `Weather → effect/demand: ${report.probes.weather.map((point) => `${point.kind}=${String(point.effect)}x/${String(point.demand)}`).join(", ")}`,
    `Confidence → demand: ${report.probes.confidence.map((point) => `${String(point.confidence)}=${String(point.demand)}`).join(", ")}`,
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

  lines.push("", "Certification guardrails: PASS");
  return lines.join("\n");
};
