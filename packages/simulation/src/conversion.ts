import type {
  ConversionOutcome,
  CustomerTraits,
  MarketMemory,
} from "./audience.js";
import { createMarketRandom } from "./audience.js";
import type { LegacyConfidence } from "./legacy.js";
import type { Weather } from "./model.js";
import {
  basisPoints,
  moneyCents,
  type BasisPoints,
  type DayNumber,
  type MoneyCents,
  type Seed,
} from "./primitives.js";

const TYPE_TOLERANCE_BPS: Readonly<Record<CustomerTraits["type"], number>> =
  Object.freeze({
    impulse: 10_000,
    "price-sensitive": 8_300,
    regular: 10_800,
    destination: 11_800,
  });

const FAIR_WEATHER_TOLERANCE_BPS: Readonly<
  Record<Exclude<Weather["kind"], "thunderstorm">, number>
> = Object.freeze({
  sunny: 11_200,
  cloudy: 10_000,
  "hot-and-dry": 11_500,
});

const STORM_FLOOR_BPS: Readonly<Record<CustomerTraits["type"], number>> =
  Object.freeze({
    impulse: 8_200,
    "price-sensitive": 8_500,
    regular: 9_200,
    destination: 9_500,
  });

const boundedBasisPoints = (
  value: number,
  minimum = 0,
  maximum = 20_000,
): BasisPoints =>
  basisPoints(Math.min(maximum, Math.max(minimum, Math.round(value))));

export const customerTypeToleranceMultiplier = (
  type: CustomerTraits["type"],
): BasisPoints => basisPoints(TYPE_TOLERANCE_BPS[type]);

export const weatherToleranceMultiplier = (
  weather: Weather["kind"],
  traits: CustomerTraits,
): BasisPoints => {
  if (weather !== "thunderstorm") {
    return basisPoints(FAIR_WEATHER_TOLERANCE_BPS[weather]);
  }

  const floor = STORM_FLOOR_BPS[traits.type];
  const commitment = Math.min(
    1,
    Math.max(0, Number(traits.weatherCommitment) / 10_000),
  );

  return boundedBasisPoints(floor + (10_000 - floor) * commitment);
};

export const confidenceToleranceMultiplier = (
  confidence: LegacyConfidence,
): BasisPoints => basisPoints(9_600 + confidence * 160);

export type MarketMemoryToleranceComponents = Readonly<{
  priceExpectation: BasisPoints;
  satisfaction: BasisPoints;
  stockout: BasisPoints;
  excess: BasisPoints;
  combined: BasisPoints;
}>;

export const marketMemoryToleranceComponents = (
  traits: CustomerTraits,
  memory: MarketMemory,
): MarketMemoryToleranceComponents => {
  const intrinsic = Number(traits.intrinsicPriceTolerance);
  if (intrinsic <= 0) {
    throw new RangeError("intrinsic price tolerance must be greater than zero");
  }

  const expected = Number(memory.expectedPrice);
  const priceExpectation = boundedBasisPoints(
    (expected === 0
      ? 1
      : Math.min(1.05, Math.max(0.95, expected / intrinsic))) * 10_000,
    9_500,
    10_500,
  );

  const satisfactionValue = Math.min(
    10_000,
    Math.max(0, Number(memory.satisfaction)),
  );
  const satisfaction = boundedBasisPoints(
    10_000 + ((satisfactionValue - 5_000) / 5_000) * 300,
    9_700,
    10_300,
  );

  const stockout = boundedBasisPoints(
    10_000 -
      (Math.min(10_000, Number(memory.stockoutPressure)) / 10_000) * 650,
    9_350,
    10_000,
  );
  const excess = boundedBasisPoints(
    10_000 -
      (Math.min(10_000, Number(memory.excessPressure)) / 10_000) * 100,
    9_900,
    10_000,
  );

  const combined =
    (Number(priceExpectation) / 10_000) *
    (Number(satisfaction) / 10_000) *
    (Number(stockout) / 10_000) *
    (Number(excess) / 10_000);

  return Object.freeze({
    priceExpectation,
    satisfaction,
    stockout,
    excess,
    combined: boundedBasisPoints(combined * 10_000, 9_000, 10_800),
  });
};

export const marketMemoryToleranceMultiplier = (
  traits: CustomerTraits,
  memory: MarketMemory,
): BasisPoints => marketMemoryToleranceComponents(traits, memory).combined;

export type EffectivePriceToleranceInput = Readonly<{
  traits: CustomerTraits;
  weather: Weather["kind"];
  confidence: LegacyConfidence;
  memory: MarketMemory;
}>;

export const effectivePriceTolerance = (
  input: EffectivePriceToleranceInput,
): MoneyCents => {
  const intrinsic = Number(input.traits.intrinsicPriceTolerance);
  if (intrinsic <= 0) {
    throw new RangeError("intrinsic price tolerance must be greater than zero");
  }

  const type =
    Number(customerTypeToleranceMultiplier(input.traits.type)) / 10_000;
  const weather =
    Number(weatherToleranceMultiplier(input.weather, input.traits)) / 10_000;
  const confidence =
    Number(confidenceToleranceMultiplier(input.confidence)) / 10_000;
  const memory =
    Number(marketMemoryToleranceMultiplier(input.traits, input.memory)) /
    10_000;

  return moneyCents(
    Math.max(
      1,
      Math.round(intrinsic * type * weather * confidence * memory),
    ),
  );
};

export const priceAcceptanceProbability = (
  price: MoneyCents,
  tolerance: MoneyCents,
): BasisPoints => {
  const toleranceCents = Number(tolerance);
  if (toleranceCents <= 0) {
    throw new RangeError("price tolerance must be greater than zero");
  }

  const priceCents = Number(price);
  if (priceCents === 0) return basisPoints(10_000);

  const relativePrice = priceCents / toleranceCents;
  const probability = 1 / (1 + Math.exp(4 * (relativePrice - 1)));

  return boundedBasisPoints(probability * 10_000, 0, 10_000);
};

export type ConversionDecisionInput = Readonly<{
  runSeed: Seed;
  day: DayNumber;
  price: MoneyCents;
  traits: CustomerTraits;
  weather: Weather["kind"];
  confidence: LegacyConfidence;
  memory: MarketMemory;
}>;

export const conversionForCustomer = (
  input: ConversionDecisionInput,
): ConversionOutcome => {
  const tolerance = effectivePriceTolerance(input);
  const probability =
    Number(priceAcceptanceProbability(input.price, tolerance)) / 10_000;
  const random = createMarketRandom(input.runSeed, "conversion", {
    day: input.day,
    customerId: input.traits.id,
  });

  return Object.freeze({
    kind: random.nextUnit() < probability ? "willing" : "price-rejected",
  });
};
