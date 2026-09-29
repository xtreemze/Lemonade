import { advertisingBaseReach } from "./advertising.js";
import type { MarketMemory } from "./audience.js";
import { neutralMarketMemory } from "./memory.js";
import { certifyDailyResolution } from "./certification.js";
import { neutralEnvironment } from "./environment.js";
import type {
  DailyLedgerEntry,
  DayDecision,
  DayEnvironment,
  GameState,
  Weather,
} from "./model.js";
import {
  basisPoints,
  dayNumber,
  glassCount,
  moneyCents,
  type Seed,
  seed,
  signCount,
  signedMoneyCents,
} from "./primitives.js";
import {
  OPERATING_SCALE_THRESHOLDS_CENTS,
  type OperatingScaleLevel,
  operatingScaleForState,
} from "./scale.js";
import { simulateDayV4, type V4DayResolution } from "./simulate-v4.js";
import { createInitialState } from "./state.js";
import { SIMULATION_RULESET_VERSION } from "./version.js";

export const V4_CERTIFICATION_SEEDS = Object.freeze([
  0x1e_ad_20_26, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987,
] as const);

const PRICE_POINTS_CENTS = Object.freeze([50, 100, 150, 200, 250, 299] as const);
const WEATHER_KINDS = Object.freeze([
  "sunny",
  "cloudy",
  "hot-and-dry",
  "thunderstorm",
] as const);

export type V4AdvertisingPoint = Readonly<{
  signs: number;
  baseReachBps: number;
  advertisingAwareBps: number;
  organicAwareBps: number;
}>;

export type V4AdvertisingLevelProbe = Readonly<{
  level: OperatingScaleLevel;
  audiencePerSeed: number;
  points: readonly V4AdvertisingPoint[];
}>;

export type V4PricePoint = Readonly<{
  priceCents: number;
  aware: number;
  willing: number;
  purchased: number;
  revenueCents: number;
  netCents: number;
}>;

export type V4PriceWeatherProbe = Readonly<{
  weather: Weather["kind"];
  points: readonly V4PricePoint[];
  bestRevenuePriceCents: number;
  bestNetPriceCents: number;
}>;

export type V4MemoryProbe = Readonly<{
  fatigueBps: readonly number[];
  recoveryBps: readonly number[];
  stockoutPressureBps: readonly number[];
  satisfactionBps: readonly number[];
}>;

export type V4BalanceCertificationReport = Readonly<{
  rulesetVersion: typeof SIMULATION_RULESET_VERSION;
  seeds: readonly number[];
  advertising: readonly V4AdvertisingLevelProbe[];
  price: readonly V4PriceWeatherProbe[];
  memory: V4MemoryProbe;
}>;

const fail = (message: string): never => {
  throw new Error(`V4 balance certification failed: ${message}`);
};

const requireInvariant = (condition: boolean, message: string): void => {
  if (!condition) {
    fail(message);
  }
};

const ratioBps = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : Math.round((numerator * 10_000) / denominator);

const decision = (glasses: number, signs: number, priceCents: number): DayDecision =>
  Object.freeze({
    glasses: glassCount(glasses),
    signs: signCount(signs),
    price: moneyCents(priceCents),
  });

const stateAtScale = (level: OperatingScaleLevel): GameState => {
  const initial = createInitialState();
  if (level === 1) {
    return Object.freeze({ ...initial, cash: moneyCents(1_000_000) });
  }

  const targetBalance =
    level === 2
      ? OPERATING_SCALE_THRESHOLDS_CENTS.level2
      : level === 3
        ? OPERATING_SCALE_THRESHOLDS_CENTS.level3
        : OPERATING_SCALE_THRESHOLDS_CENTS.level4;
  const operatingProfit = targetBalance - 1000;
  const historicalEntry: DailyLedgerEntry = Object.freeze({
    day: dayNumber(1),
    tier: 0,
    decision: decision(1, 0, 150),
    environment: neutralEnvironment(),
    potentialDemand: glassCount(1),
    sold: glassCount(1),
    revenue: moneyCents(operatingProfit),
    financeIncome: moneyCents(0),
    expenses: moneyCents(0),
    net: signedMoneyCents(operatingProfit),
    cashDelta: signedMoneyCents(operatingProfit),
    borrowed: moneyCents(0),
    repaid: moneyCents(0),
    endingCash: moneyCents(targetBalance),
    endingLoanBalance: moneyCents(0),
    lines: Object.freeze([
      Object.freeze({
        kind: "revenue" as const,
        label: "V4 certification scale fixture",
        amount: moneyCents(operatingProfit),
        direction: "credit" as const,
      }),
    ]),
  });

  const state = Object.freeze({
    ...initial,
    day: dayNumber(2),
    cash: moneyCents(1_000_000),
    ledger: Object.freeze([historicalEntry]),
  });
  requireInvariant(
    operatingScaleForState(state).level === level,
    `scale fixture failed for level ${String(level)}`,
  );
  return state;
};

const environmentForWeather = (kind: Weather["kind"]): DayEnvironment => {
  const neutral = neutralEnvironment();
  return Object.freeze({
    weather: Object.freeze({
      kind,
      demandMultiplier: basisPoints(10_000),
    }),
    sentiment: neutral.sentiment,
    event: neutral.event,
  });
};

const certifyResolution = (resolution: V4DayResolution): void => {
  certifyDailyResolution(resolution);
  const summary = resolution.market.summary;
  requireInvariant(
    summary.audience === summary.unaware + summary.aware,
    "audience partition is not exhaustive",
  );
  requireInvariant(
    summary.aware === summary.priceRejected + summary.willing,
    "awareness/conversion partition is not exhaustive",
  );
  requireInvariant(
    summary.willing === summary.purchased + summary.stockout,
    "willing/fulfillment partition is not exhaustive",
  );
  requireInvariant(
    summary.purchased === Number(resolution.entry.sold),
    "authoritative purchases do not match ledger sales",
  );
  requireInvariant(
    resolution.market.outcomes.length === summary.audience,
    "customer outcomes do not cover the daily audience",
  );
};

const aggregateAdvertisingPoint = (
  state: GameState,
  seeds: readonly number[],
  signs: number,
): V4AdvertisingPoint => {
  let audience = 0;
  let advertisingAware = 0;
  let organicAware = 0;
  for (const seedValue of seeds) {
    const result = simulateDayV4(
      state,
      decision(0, signs, 150),
      neutralEnvironment(),
      seed(seedValue),
      neutralMarketMemory(),
    );
    certifyResolution(result);
    audience += result.market.summary.audience;
    advertisingAware += result.market.summary.advertisingAware;
    organicAware += result.market.summary.organicAware;
  }

  return Object.freeze({
    signs,
    baseReachBps: Number(advertisingBaseReach(signCount(signs))),
    advertisingAwareBps: ratioBps(advertisingAware, audience),
    organicAwareBps: ratioBps(organicAware, audience),
  });
};

const advertisingProbe = (
  level: OperatingScaleLevel,
  seeds: readonly number[],
): V4AdvertisingLevelProbe => {
  const state = stateAtScale(level);
  const scale = operatingScaleForState(state);
  const points = Object.freeze(
    Array.from({ length: scale.maxSigns + 1 }, (_, signs) =>
      aggregateAdvertisingPoint(state, seeds, signs),
    ),
  );
  const baseline = simulateDayV4(
    state,
    decision(0, 0, 150),
    neutralEnvironment(),
    seed(seeds[0] ?? 1),
    neutralMarketMemory(),
  );

  return Object.freeze({
    level,
    audiencePerSeed: baseline.market.summary.audience,
    points,
  });
};

const aggregatePricePoint = (
  state: GameState,
  environment: DayEnvironment,
  seeds: readonly number[],
  priceCents: number,
): V4PricePoint => {
  const scale = operatingScaleForState(state);
  let aware = 0;
  let willing = 0;
  let purchased = 0;
  let revenueCents = 0;
  let netCents = 0;

  for (const seedValue of seeds) {
    const result = simulateDayV4(
      state,
      decision(scale.maxGlasses, Math.min(1, scale.maxSigns), priceCents),
      environment,
      seed(seedValue),
      neutralMarketMemory(),
    );
    certifyResolution(result);
    aware += result.market.summary.aware;
    willing += result.market.summary.willing;
    purchased += result.market.summary.purchased;
    revenueCents += Number(result.entry.revenue);
    netCents += Number(result.entry.net);
  }

  return Object.freeze({ priceCents, aware, willing, purchased, revenueCents, netCents });
};

const bestPoint = (
  points: readonly V4PricePoint[],
  selector: (point: V4PricePoint) => number,
): V4PricePoint => {
  const first = points[0];
  if (first === undefined) {
    return fail("price probe is empty");
  }
  return points.slice(1).reduce(
    (best, point) =>
      selector(point) > selector(best) ||
      (selector(point) === selector(best) && point.priceCents < best.priceCents)
        ? point
        : best,
    first,
  );
};

const priceProbe = (
  weather: Weather["kind"],
  seeds: readonly number[],
): V4PriceWeatherProbe => {
  const state = stateAtScale(1);
  const environment = environmentForWeather(weather);
  const points = Object.freeze(
    PRICE_POINTS_CENTS.map((priceCents) =>
      aggregatePricePoint(state, environment, seeds, priceCents),
    ),
  );
  return Object.freeze({
    weather,
    points,
    bestRevenuePriceCents: bestPoint(points, (point) => point.revenueCents).priceCents,
    bestNetPriceCents: bestPoint(points, (point) => point.netCents).priceCents,
  });
};

const memoryProbe = (runSeed: Seed): V4MemoryProbe => {
  let state = stateAtScale(1);
  let memory: MarketMemory = neutralMarketMemory();
  const fatigueBps: number[] = [];
  const recoveryBps: number[] = [];
  const stockoutPressureBps: number[] = [];
  const satisfactionBps: number[] = [];

  for (let index = 0; index < 6; index += 1) {
    const result = simulateDayV4(
      state,
      decision(0, 3, 100),
      neutralEnvironment(),
      runSeed,
      memory,
    );
    certifyResolution(result);
    state = result.nextState;
    memory = result.market.memoryAfter;
    fatigueBps.push(Number(memory.advertisingFatigue));
    stockoutPressureBps.push(Number(memory.stockoutPressure));
    satisfactionBps.push(Number(memory.satisfaction));
  }

  for (let index = 0; index < 8; index += 1) {
    const result = simulateDayV4(
      state,
      decision(15, 0, 150),
      neutralEnvironment(),
      runSeed,
      memory,
    );
    certifyResolution(result);
    state = result.nextState;
    memory = result.market.memoryAfter;
    recoveryBps.push(Number(memory.advertisingFatigue));
    stockoutPressureBps.push(Number(memory.stockoutPressure));
    satisfactionBps.push(Number(memory.satisfaction));
  }

  return Object.freeze({
    fatigueBps: Object.freeze(fatigueBps),
    recoveryBps: Object.freeze(recoveryBps),
    stockoutPressureBps: Object.freeze(stockoutPressureBps),
    satisfactionBps: Object.freeze(satisfactionBps),
  });
};

export const runV4BalanceCertification = (
  seedValues: readonly number[] = V4_CERTIFICATION_SEEDS,
): V4BalanceCertificationReport => {
  requireInvariant(seedValues.length > 0, "certification requires deterministic seeds");
  const advertising = Object.freeze(
    ([1, 2, 3, 4] as const).map((level) => advertisingProbe(level, seedValues)),
  );
  const price = Object.freeze(
    WEATHER_KINDS.map((weather) => priceProbe(weather, seedValues)),
  );

  return Object.freeze({
    rulesetVersion: SIMULATION_RULESET_VERSION,
    seeds: Object.freeze([...seedValues]),
    advertising,
    price,
    memory: memoryProbe(seed(seedValues[0] ?? 1)),
  });
};

export const assertV4BalanceCertification = (report: V4BalanceCertificationReport): void => {
  requireInvariant(
    report.rulesetVersion === SIMULATION_RULESET_VERSION,
    "report ruleset does not match the running v4 engine",
  );
  requireInvariant(report.advertising.length === 4, "advertising probes must cover L1-L4");

  for (const level of report.advertising) {
    const zero = level.points[0] ?? fail(`missing L${String(level.level)} zero-sign probe`);
    requireInvariant(zero.signs === 0, "advertising curve must begin at zero signs");
    requireInvariant(zero.advertisingAwareBps === 0, "zero signs invented advertising awareness");

    const baseMarginals: number[] = [];
    for (let index = 1; index < level.points.length; index += 1) {
      const previous = level.points[index - 1] ?? fail("advertising point missing");
      const current = level.points[index] ?? fail("advertising point missing");
      requireInvariant(
        current.baseReachBps >= previous.baseReachBps,
        `L${String(level.level)} base advertising reach decreased`,
      );
      requireInvariant(
        current.advertisingAwareBps >= previous.advertisingAwareBps,
        `L${String(level.level)} seeded advertising awareness decreased`,
      );
      baseMarginals.push(current.baseReachBps - previous.baseReachBps);
    }

    if (baseMarginals.length > 1) {
      const midpoint = Math.ceil(baseMarginals.length / 2);
      const firstHalf = baseMarginals.slice(0, midpoint);
      const secondHalf = baseMarginals.slice(midpoint);
      const firstAverage =
        firstHalf.reduce((total, value) => total + value, 0) / firstHalf.length;
      const secondAverage =
        secondHalf.reduce((total, value) => total + value, 0) /
        Math.max(1, secondHalf.length);
      requireInvariant(
        firstAverage >= secondAverage,
        `L${String(level.level)} advertising reach is not generally saturating`,
      );
    }
  }

  for (const weather of report.price) {
    for (let index = 1; index < weather.points.length; index += 1) {
      const previous = weather.points[index - 1] ?? fail("price point missing");
      const current = weather.points[index] ?? fail("price point missing");
      requireInvariant(
        current.willing <= previous.willing,
        `${weather.weather} price conversion increased as price rose`,
      );
    }
    const first = weather.points[0] ?? fail("price probe missing low price");
    const last = weather.points.at(-1) ?? fail("price probe missing high price");
    requireInvariant(
      first.willing > last.willing,
      `${weather.weather} price algebraically cancelled out of conversion`,
    );
  }

  const fatigue = report.memory.fatigueBps;
  const recovery = report.memory.recoveryBps;
  requireInvariant(fatigue.length > 1 && recovery.length > 1, "memory probe is incomplete");
  requireInvariant(
    (fatigue.at(-1) ?? 0) > (fatigue[0] ?? 0),
    "repeated maximum advertising did not accumulate fatigue",
  );
  requireInvariant(
    (recovery.at(-1) ?? 10_000) < (recovery[0] ?? 0),
    "advertising fatigue did not recover after reduced advertising",
  );
  for (const value of [
    ...report.memory.fatigueBps,
    ...report.memory.recoveryBps,
    ...report.memory.stockoutPressureBps,
    ...report.memory.satisfactionBps,
  ]) {
    requireInvariant(value >= 0 && value <= 10_000, "market memory escaped bounded basis points");
  }
};

const percent = (bps: number): string => `${(bps / 100).toFixed(1)}%`;

export const formatV4BalanceCertification = (report: V4BalanceCertificationReport): string => {
  const lines = [
    "# Lemonade ruleset-v4 balance certification",
    "",
    `Ruleset: ${String(report.rulesetVersion)}`,
    `Deterministic seeds: ${String(report.seeds.length)}`,
    "",
    "## Advertising saturation",
    "",
    "| Level | Signs | Base reach | Seeded ad awareness | Organic awareness |",
    "| ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const level of report.advertising) {
    for (const point of level.points) {
      lines.push(
        `| ${String(level.level)} | ${String(point.signs)} | ${percent(point.baseReachBps)} | ${percent(point.advertisingAwareBps)} | ${percent(point.organicAwareBps)} |`,
      );
    }
  }

  lines.push(
    "",
    "## Price / weather probes",
    "",
    "| Weather | Price | Aware | Willing | Purchased | Revenue | Net |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const weather of report.price) {
    for (const point of weather.points) {
      lines.push(
        `| ${weather.weather} | $${(point.priceCents / 100).toFixed(2)} | ${String(point.aware)} | ${String(point.willing)} | ${String(point.purchased)} | $${(point.revenueCents / 100).toFixed(2)} | $${(point.netCents / 100).toFixed(2)} |`,
      );
    }
    lines.push(
      `| ${weather.weather} optimum | — | — | — | — | revenue @ $${(weather.bestRevenuePriceCents / 100).toFixed(2)} | net @ $${(weather.bestNetPriceCents / 100).toFixed(2)} |`,
    );
  }

  lines.push(
    "",
    "## Market-memory recovery",
    "",
    `Max-ad fatigue sequence: ${report.memory.fatigueBps.join(", ")} bps`,
    `Zero-ad recovery sequence: ${report.memory.recoveryBps.join(", ")} bps`,
    `Stockout-pressure sequence: ${report.memory.stockoutPressureBps.join(", ")} bps`,
    "",
    "Integrated accounting + v4 funnel invariants: PASS",
  );
  return lines.join("\n");
};
