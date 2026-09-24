import type { AwarenessOutcome, CustomerTraits } from "./audience.js";
import { createMarketRandom } from "./audience.js";
import type { Weather } from "./model.js";
import {
  type BasisPoints,
  basisPoints,
  type DayNumber,
  type Seed,
  type SignCount,
} from "./primitives.js";
import type { OperatingScaleLevel } from "./scale.js";

const BASE_REACH_RATE = 0.11;
const FATIGUE_DECAY = 0.78;
const MAX_FATIGUE_REACH_PENALTY_BPS = 1800;

const MAX_SIGNS_BY_LEVEL: Readonly<Record<OperatingScaleLevel, number>> = Object.freeze({
  1: 3,
  2: 10,
  3: 25,
  4: 40,
});

const WEATHER_ATTENTION_BPS: Readonly<Record<Weather["kind"], number>> = Object.freeze({
  sunny: 10_000,
  cloudy: 9500,
  "hot-and-dry": 10_200,
  thunderstorm: 6500,
});

const boundedBasisPoints = (value: number): BasisPoints =>
  basisPoints(Math.min(10_000, Math.max(0, Math.round(value))));

export const advertisingBaseReach = (signs: SignCount): BasisPoints => {
  const count = Number(signs);
  if (count === 0) {
    return basisPoints(0);
  }

  return boundedBasisPoints((1 - Math.exp(-BASE_REACH_RATE * count)) * 10_000);
};

export const normalizedAdvertisingPressure = (
  signs: SignCount,
  level: OperatingScaleLevel,
): BasisPoints => {
  const maximum = MAX_SIGNS_BY_LEVEL[level];
  return boundedBasisPoints((Number(signs) / maximum) * 10_000);
};

export const nextAdvertisingFatigue = (
  current: BasisPoints,
  signs: SignCount,
  level: OperatingScaleLevel,
): BasisPoints => {
  const pressure = Number(normalizedAdvertisingPressure(signs, level));
  return boundedBasisPoints(Number(current) * FATIGUE_DECAY + pressure * (1 - FATIGUE_DECAY));
};

export const advertisingFatigueReachPenalty = (fatigue: BasisPoints): BasisPoints =>
  boundedBasisPoints((Number(fatigue) * MAX_FATIGUE_REACH_PENALTY_BPS) / 10_000);

export const weatherAdvertisingAttention = (weather: Weather["kind"]): BasisPoints =>
  basisPoints(WEATHER_ATTENTION_BPS[weather]);

export const organicAwarenessProbability = (traits: CustomerTraits): BasisPoints =>
  boundedBasisPoints(800 + Number(traits.familiarity) * 0.32 + Number(traits.loyalty) * 0.12);

export const effectiveAdvertisingReach = (
  signs: SignCount,
  traits: CustomerTraits,
  weather: Weather["kind"],
  fatigue: BasisPoints,
): BasisPoints => {
  const baseReach = Number(advertisingBaseReach(signs)) / 10_000;
  const responsiveness = Number(traits.advertisingResponsiveness) / 10_000;
  const weatherAttention = Number(weatherAdvertisingAttention(weather)) / 10_000;
  const fatiguePenalty = Number(advertisingFatigueReachPenalty(fatigue)) / 10_000;

  return boundedBasisPoints(
    baseReach * responsiveness * weatherAttention * (1 - fatiguePenalty) * 10_000,
  );
};

export type AwarenessDecisionInput = Readonly<{
  runSeed: Seed;
  day: DayNumber;
  traits: CustomerTraits;
  signs: SignCount;
  weather: Weather["kind"];
  advertisingFatigue: BasisPoints;
}>;

export const awarenessForCustomer = (input: AwarenessDecisionInput): AwarenessOutcome => {
  const random = createMarketRandom(input.runSeed, "awareness", {
    day: input.day,
    customerId: input.traits.id,
  });

  if (random.nextUnit() < Number(organicAwarenessProbability(input.traits)) / 10_000) {
    return Object.freeze({ kind: "organic" });
  }

  const signCount = Number(input.signs);
  if (signCount === 0) {
    return Object.freeze({ kind: "unaware" });
  }

  if (
    random.nextUnit() <
    Number(
      effectiveAdvertisingReach(input.signs, input.traits, input.weather, input.advertisingFatigue),
    ) /
      10_000
  ) {
    return Object.freeze({
      kind: "advertising",
      signIndex: random.nextInt(0, signCount),
    });
  }

  return Object.freeze({ kind: "unaware" });
};
