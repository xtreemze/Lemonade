import type { DayEnvironment } from "./model.js";
import { glassCount, type GlassCount, type MoneyCents, type SignCount } from "./primitives.js";

const REFERENCE_PRICE_CENTS = 10;
const BASELINE_DEMAND = 30;
const BELOW_REFERENCE_GAIN = 0.8;
const ADVERTISING_RESPONSE = 0.5;
const BASIS_POINTS_SCALE = 10_000;

export const classicPriceDemand = (price: MoneyCents): number => {
  const priceCents = Number(price);
  if (priceCents <= 0) {
    throw new RangeError("price must be greater than zero");
  }

  if (priceCents < REFERENCE_PRICE_CENTS) {
    return (
      ((REFERENCE_PRICE_CENTS - priceCents) / REFERENCE_PRICE_CENTS) *
        BELOW_REFERENCE_GAIN *
        BASELINE_DEMAND +
      BASELINE_DEMAND
    );
  }

  return (
    (REFERENCE_PRICE_CENTS * REFERENCE_PRICE_CENTS * BASELINE_DEMAND) /
    (priceCents * priceCents)
  );
};

export const classicAdvertisingMultiplier = (signs: SignCount): number =>
  2 - Math.exp(-ADVERTISING_RESPONSE * Number(signs));

const multiplier = (value: number): number => value / BASIS_POINTS_SCALE;

export const potentialDemand = (
  price: MoneyCents,
  signs: SignCount,
  environment: DayEnvironment,
): GlassCount => {
  const demand =
    classicPriceDemand(price) *
    classicAdvertisingMultiplier(signs) *
    multiplier(environment.weather.demandMultiplier) *
    multiplier(environment.sentiment.demandMultiplier) *
    multiplier(environment.event.demandMultiplier);

  return glassCount(Math.max(0, Math.floor(demand)));
};
