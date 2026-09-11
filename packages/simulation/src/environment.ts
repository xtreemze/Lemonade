import type { DayEnvironment, DayEvent, MarketSentiment, Weather } from "./model.js";
import { basisPoints, type DayNumber } from "./primitives.js";
import type { RandomSource } from "./rng.js";

const SUNNY = Object.freeze({
  kind: "sunny",
  demandMultiplier: basisPoints(10_000),
}) satisfies Weather;
const CLOUDY = Object.freeze({
  kind: "cloudy",
  demandMultiplier: basisPoints(7_000),
}) satisfies Weather;
const HOT_AND_DRY = Object.freeze({
  kind: "hot-and-dry",
  demandMultiplier: basisPoints(20_000),
}) satisfies Weather;
const THUNDERSTORM = Object.freeze({
  kind: "thunderstorm",
  demandMultiplier: basisPoints(0),
}) satisfies Weather;

const VERY_COLD = Object.freeze({
  kind: "very-cold",
  demandMultiplier: basisPoints(8_500),
}) satisfies MarketSentiment;
const COLD = Object.freeze({
  kind: "cold",
  demandMultiplier: basisPoints(9_250),
}) satisfies MarketSentiment;
const NEUTRAL = Object.freeze({
  kind: "neutral",
  demandMultiplier: basisPoints(10_000),
}) satisfies MarketSentiment;
const WARM = Object.freeze({
  kind: "warm",
  demandMultiplier: basisPoints(10_750),
}) satisfies MarketSentiment;
const HOT = Object.freeze({
  kind: "hot",
  demandMultiplier: basisPoints(11_500),
}) satisfies MarketSentiment;

const NO_EVENT = Object.freeze({
  kind: "none",
  demandMultiplier: basisPoints(10_000),
}) satisfies DayEvent;
const STREET_WORK = Object.freeze({
  kind: "street-work",
  demandMultiplier: basisPoints(4_000),
}) satisfies DayEvent;
const WORKERS_BUY_OUT = Object.freeze({
  kind: "workers-buy-out",
  demandMultiplier: basisPoints(10_000),
}) satisfies DayEvent;

const chooseWeather = (day: DayNumber, random: RandomSource): Weather => {
  if (Number(day) <= 2) {
    return SUNNY;
  }

  const roll = random.nextInt(0, 100);
  if (roll < 60) {
    return SUNNY;
  }
  if (roll < 80) {
    return random.nextInt(0, 20) === 0 ? THUNDERSTORM : CLOUDY;
  }
  return HOT_AND_DRY;
};

const chooseSentiment = (random: RandomSource): MarketSentiment => {
  const roll = random.nextInt(0, 100);
  if (roll < 10) return VERY_COLD;
  if (roll < 30) return COLD;
  if (roll < 70) return NEUTRAL;
  if (roll < 90) return WARM;
  return HOT;
};

const chooseEvent = (weather: Weather, random: RandomSource): DayEvent => {
  if (weather.kind === "thunderstorm") {
    return NO_EVENT;
  }

  if (random.nextInt(0, 100) >= 3) {
    return NO_EVENT;
  }

  return random.nextInt(0, 2) === 0 ? STREET_WORK : WORKERS_BUY_OUT;
};

export const generateEnvironment = (
  day: DayNumber,
  random: RandomSource,
): DayEnvironment => {
  const weather = chooseWeather(day, random);
  return Object.freeze({
    weather,
    sentiment: chooseSentiment(random),
    event: chooseEvent(weather, random),
  });
};

export const neutralEnvironment = (): DayEnvironment =>
  Object.freeze({ weather: SUNNY, sentiment: NEUTRAL, event: NO_EVENT });
