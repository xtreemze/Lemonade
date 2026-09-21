import type { DayEnvironment } from "./model.js";
import {
  legacyConfidenceRoll,
  legacyWeatherEffect,
  type LegacyConfidence,
} from "./legacy.js";
import { glassCount, type GlassCount, type MoneyCents, type SignCount } from "./primitives.js";

export const legacyMarketingEffect = (signs: SignCount): number => {
  const signCount = Number(signs);
  const result = signCount ** 2 / Math.log1p(signCount);
  return Number.isNaN(result) || result < 1 ? 0 : result;
};

export const potentialDemand = (
  price: MoneyCents,
  signs: SignCount,
  confidence: LegacyConfidence,
  environment: DayEnvironment,
): GlassCount => {
  const priceDollars = Number(price) / 100;
  if (priceDollars <= 0) {
    throw new RangeError("price must be greater than zero");
  }

  const signsEffect = legacyMarketingEffect(signs);
  const confidenceContribution =
    legacyConfidenceRoll(environment.sentiment) * confidence;
  const weatherEffect = legacyWeatherEffect(environment.weather);
  const demand =
    ((signsEffect + confidenceContribution) / priceDollars) * weatherEffect;

  return glassCount(Math.max(0, Math.round(demand)));
};
