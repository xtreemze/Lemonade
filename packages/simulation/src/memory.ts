import { nextAdvertisingFatigue } from "./advertising.js";
import type { MarketMemory } from "./audience.js";
import {
  basisPoints,
  type GlassCount,
  type MoneyCents,
  moneyCents,
  type SignCount,
} from "./primitives.js";
import type { OperatingScaleLevel } from "./scale.js";

const EXPECTED_PRICE_RETENTION = 0.72;
const PRESSURE_RETENTION = 0.74;
const SATISFACTION_RETENTION = 0.82;
const NEUTRAL_SATISFACTION_BPS = 5000;
const MIN_SATISFACTION_TARGET_BPS = 3500;
const MAX_SATISFACTION_TARGET_BPS = 6500;

export type MarketMemoryObservation = Readonly<{
  price: MoneyCents;
  signs: SignCount;
  level: OperatingScaleLevel;
  prepared: GlassCount;
  willing: number;
  purchased: number;
}>;

const clampBasisPoints = (value: number) =>
  basisPoints(Math.min(10_000, Math.max(0, Math.round(value))));

const blendBasisPoints = (current: number, target: number, retention: number) =>
  clampBasisPoints(current * retention + target * (1 - retention));

const ratioBasisPoints = (numerator: number, denominator: number): number => {
  if (denominator === 0) {
    return 0;
  }
  return (numerator / denominator) * 10_000;
};

const assertObservation = (observation: MarketMemoryObservation): void => {
  const { willing, purchased } = observation;
  if (!Number.isSafeInteger(willing) || willing < 0) {
    throw new RangeError("willing customers must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(purchased) || purchased < 0) {
    throw new RangeError("purchased customers must be a non-negative safe integer");
  }
  if (purchased > willing) {
    throw new RangeError("purchased customers cannot exceed willing customers");
  }
  if (purchased > Number(observation.prepared)) {
    throw new RangeError("purchased customers cannot exceed prepared glasses");
  }
};

export const neutralMarketMemory = (): MarketMemory =>
  Object.freeze({
    expectedPrice: moneyCents(0),
    advertisingFatigue: basisPoints(0),
    stockoutPressure: basisPoints(0),
    excessPressure: basisPoints(0),
    satisfaction: basisPoints(NEUTRAL_SATISFACTION_BPS),
  });

const nextExpectedPrice = (current: MoneyCents, observed: MoneyCents): MoneyCents => {
  if (Number(current) === 0) {
    return observed;
  }
  return moneyCents(
    Math.round(
      Number(current) * EXPECTED_PRICE_RETENTION +
        Number(observed) * (1 - EXPECTED_PRICE_RETENTION),
    ),
  );
};

const satisfactionTarget = (willing: number, purchased: number): number => {
  if (willing === 0) {
    return NEUTRAL_SATISFACTION_BPS;
  }

  const fulfillment = purchased / willing;
  return (
    MIN_SATISFACTION_TARGET_BPS +
    fulfillment * (MAX_SATISFACTION_TARGET_BPS - MIN_SATISFACTION_TARGET_BPS)
  );
};

export const nextMarketMemory = (
  current: MarketMemory,
  observation: MarketMemoryObservation,
): MarketMemory => {
  assertObservation(observation);

  const prepared = Number(observation.prepared);
  const stockouts = observation.willing - observation.purchased;
  const excess = Math.max(0, prepared - observation.purchased);

  const stockoutSignal = ratioBasisPoints(stockouts, observation.willing);
  const excessSignal = ratioBasisPoints(excess, prepared);

  return Object.freeze({
    expectedPrice: nextExpectedPrice(current.expectedPrice, observation.price),
    advertisingFatigue: nextAdvertisingFatigue(
      current.advertisingFatigue,
      observation.signs,
      observation.level,
    ),
    stockoutPressure: blendBasisPoints(
      Number(current.stockoutPressure),
      stockoutSignal,
      PRESSURE_RETENTION,
    ),
    excessPressure: blendBasisPoints(
      Number(current.excessPressure),
      excessSignal,
      PRESSURE_RETENTION,
    ),
    satisfaction: blendBasisPoints(
      Number(current.satisfaction),
      satisfactionTarget(observation.willing, observation.purchased),
      SATISFACTION_RETENTION,
    ),
  });
};

export const deriveMarketMemory = (history: readonly MarketMemoryObservation[]): MarketMemory => {
  let memory = neutralMarketMemory();
  for (const observation of history) {
    memory = nextMarketMemory(memory, observation);
  }
  return memory;
};
