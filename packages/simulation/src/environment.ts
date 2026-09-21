import type { DayEnvironment, DayEvent, MarketSentiment, Weather } from "./model.js";
import { basisPoints, type DayNumber } from "./primitives.js";
import type { RandomSource } from "./rng.js";

const SUNNY = Object.freeze({
  kind: "sunny",
  demandMultiplier: basisPoints(10_000),
}) satisfies Weather;
const CLOUDY = Object.freeze({
  kind: "cloudy",
  demandMultiplier: basisPoints(10_000),
}) satisfies Weather;
const PARTLY_CLOUDY = Object.freeze({
  kind: "hot-and-dry",
  demandMultiplier: basisPoints(10_000),
}) satisfies Weather;
const THUNDERSTORM = Object.freeze({
  kind: "thunderstorm",
  demandMultiplier: basisPoints(10_000),
}) satisfies Weather;

const CONFIDENCE_ROLL_ONE = Object.freeze({
  kind: "cold",
  demandMultiplier: basisPoints(10_000),
}) satisfies MarketSentiment;
const CONFIDENCE_ROLL_TWO = Object.freeze({
  kind: "neutral",
  demandMultiplier: basisPoints(10_000),
}) satisfies MarketSentiment;
const CONFIDENCE_ROLL_THREE = Object.freeze({
  kind: "warm",
  demandMultiplier: basisPoints(10_000),
}) satisfies MarketSentiment;

const NO_EVENT = Object.freeze({
  kind: "none",
  demandMultiplier: basisPoints(10_000),
}) satisfies DayEvent;

const weatherForVariant = (variant: number): Weather => {
  switch (variant) {
    case 0:
      return THUNDERSTORM;
    case 1:
      return CLOUDY;
    case 2:
      return PARTLY_CLOUDY;
    case 3:
      return SUNNY;
    default:
      throw new RangeError("weather variant must be 0 through 3");
  }
};

const chooseWeather = (day: DayNumber, random: RandomSource): Weather =>
  Number(day) === 1 ? SUNNY : weatherForVariant(random.nextInt(0, 4));

const chooseConfidenceRoll = (random: RandomSource): MarketSentiment => {
  // Exact seeded equivalent of the 2017:
  // Math.floor(Math.random() * (3.5 - 1)) + 1
  const roll = Math.floor(random.nextUnit() * 2.5) + 1;
  switch (roll) {
    case 1:
      return CONFIDENCE_ROLL_ONE;
    case 2:
      return CONFIDENCE_ROLL_TWO;
    case 3:
      return CONFIDENCE_ROLL_THREE;
    default:
      throw new RangeError("confidence roll must be 1 through 3");
  }
};

export const generateEnvironment = (
  day: DayNumber,
  random: RandomSource,
): DayEnvironment =>
  Object.freeze({
    weather: chooseWeather(day, random),
    sentiment: chooseConfidenceRoll(random),
    event: NO_EVENT,
  });

export const neutralEnvironment = (): DayEnvironment =>
  Object.freeze({
    weather: SUNNY,
    sentiment: CONFIDENCE_ROLL_TWO,
    event: NO_EVENT,
  });
