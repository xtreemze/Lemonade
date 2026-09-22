import {
  basisPoints,
  customerId,
  moneyCents,
  type BasisPoints,
  type CustomerId,
  type DayNumber,
  type MoneyCents,
  type Seed,
} from "./primitives.js";
import { createNamedRandom, deriveSeed } from "./rng.js";
import type { OperatingScaleLevel } from "./scale.js";

export type CustomerType =
  | "impulse"
  | "price-sensitive"
  | "regular"
  | "destination";

export type CustomerTraits = Readonly<{
  id: CustomerId;
  type: CustomerType;
  visualSeed: Seed;
  intrinsicPriceTolerance: MoneyCents;
  advertisingResponsiveness: BasisPoints;
  familiarity: BasisPoints;
  loyalty: BasisPoints;
  weatherCommitment: BasisPoints;
}>;

export type MarketMemory = Readonly<{
  expectedPrice: MoneyCents;
  advertisingFatigue: BasisPoints;
  stockoutPressure: BasisPoints;
  excessPressure: BasisPoints;
  satisfaction: BasisPoints;
}>;

export type AwarenessOutcome =
  | Readonly<{ kind: "unaware" }>
  | Readonly<{ kind: "organic" }>
  | Readonly<{ kind: "advertising"; signIndex: number }>;

export type ConversionOutcome =
  | Readonly<{ kind: "not-evaluated" }>
  | Readonly<{ kind: "price-rejected" }>
  | Readonly<{ kind: "willing" }>;

export type FulfillmentOutcome =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "purchased"; saleIndex: number }>
  | Readonly<{ kind: "stockout" }>;

export type CustomerOutcome = Readonly<{
  id: CustomerId;
  type: CustomerType;
  visualSeed: Seed;
  awareness: AwarenessOutcome;
  conversion: ConversionOutcome;
  fulfillment: FulfillmentOutcome;
}>;

export type DayAudience = Readonly<{
  neighborhoodSize: number;
  customerIds: readonly CustomerId[];
}>;

export type AudienceSummary = Readonly<{
  audience: number;
  unaware: number;
  organicAware: number;
  advertisingAware: number;
  aware: number;
  priceRejected: number;
  willing: number;
  purchased: number;
  stockout: number;
}>;

export type AudienceScaleRules = Readonly<{
  neighborhoodSize: number;
  dailyAudience: number;
}>;

const CUSTOMER_TYPES = Object.freeze([
  "impulse",
  "price-sensitive",
  "regular",
  "destination",
] as const);

const AUDIENCE_SCALE_RULES: Readonly<
  Record<OperatingScaleLevel, AudienceScaleRules>
> = Object.freeze({
  1: Object.freeze({ neighborhoodSize: 48, dailyAudience: 24 }),
  2: Object.freeze({ neighborhoodSize: 144, dailyAudience: 72 }),
  3: Object.freeze({ neighborhoodSize: 384, dailyAudience: 200 }),
  4: Object.freeze({ neighborhoodSize: 900, dailyAudience: 480 }),
});

export const audienceRulesForScale = (
  level: OperatingScaleLevel,
): AudienceScaleRules => AUDIENCE_SCALE_RULES[level];

export const deriveCustomerTraits = (
  neighborhoodSeed: Seed,
  id: CustomerId,
): CustomerTraits => {
  const random = createNamedRandom(
    neighborhoodSeed,
    "customer-traits",
    Number(id),
  );
  const type = CUSTOMER_TYPES[
    random.nextInt(0, CUSTOMER_TYPES.length)
  ] as CustomerType;

  return Object.freeze({
    id,
    type,
    visualSeed: deriveSeed(
      neighborhoodSeed,
      "customer-visual-identity",
      Number(id),
    ),
    intrinsicPriceTolerance: moneyCents(random.nextInt(125, 501)),
    advertisingResponsiveness: basisPoints(random.nextInt(3_500, 9_501)),
    familiarity: basisPoints(random.nextInt(1_000, 9_001)),
    loyalty: basisPoints(random.nextInt(1_000, 9_001)),
    weatherCommitment: basisPoints(random.nextInt(2_500, 10_001)),
  });
};

export const selectDayAudience = (
  neighborhoodSeed: Seed,
  day: DayNumber,
  level: OperatingScaleLevel,
): DayAudience => {
  const rules = audienceRulesForScale(level);
  const ids = Array.from(
    { length: rules.neighborhoodSize },
    (_, index) => customerId(index),
  );
  const random = createNamedRandom(
    neighborhoodSeed,
    "audience-selection",
    Number(day),
    level,
  );

  for (let index = ids.length - 1; index > 0; index -= 1) {
    const targetIndex = random.nextInt(0, index + 1);
    const current = ids[index];
    const target = ids[targetIndex];
    if (current === undefined || target === undefined) {
      throw new Error("audience shuffle invariant failed");
    }
    ids[index] = target;
    ids[targetIndex] = current;
  }

  return Object.freeze({
    neighborhoodSize: rules.neighborhoodSize,
    customerIds: Object.freeze(ids.slice(0, rules.dailyAudience)),
  });
};

const requireNonNegativeIndex = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
};

export const assertCustomerOutcomeConsistency = (
  outcome: CustomerOutcome,
): void => {
  if (outcome.awareness.kind === "advertising") {
    requireNonNegativeIndex(outcome.awareness.signIndex, "sign index");
  }
  if (outcome.fulfillment.kind === "purchased") {
    requireNonNegativeIndex(outcome.fulfillment.saleIndex, "sale index");
  }

  if (outcome.awareness.kind === "unaware") {
    if (
      outcome.conversion.kind !== "not-evaluated" ||
      outcome.fulfillment.kind !== "none"
    ) {
      throw new RangeError(
        "unaware customers cannot evaluate price or receive fulfillment",
      );
    }
    return;
  }

  if (outcome.conversion.kind === "not-evaluated") {
    throw new RangeError("aware customers must evaluate price");
  }

  if (outcome.conversion.kind === "price-rejected") {
    if (outcome.fulfillment.kind !== "none") {
      throw new RangeError("price-rejected customers cannot be fulfilled");
    }
    return;
  }

  if (outcome.fulfillment.kind === "none") {
    throw new RangeError("willing customers must purchase or encounter stockout");
  }
};

export const summarizeAudience = (
  outcomes: readonly CustomerOutcome[],
): AudienceSummary => {
  let unaware = 0;
  let organicAware = 0;
  let advertisingAware = 0;
  let priceRejected = 0;
  let willing = 0;
  let purchased = 0;
  let stockout = 0;

  for (const outcome of outcomes) {
    assertCustomerOutcomeConsistency(outcome);

    switch (outcome.awareness.kind) {
      case "unaware":
        unaware += 1;
        break;
      case "organic":
        organicAware += 1;
        break;
      case "advertising":
        advertisingAware += 1;
        break;
    }

    if (outcome.conversion.kind === "price-rejected") {
      priceRejected += 1;
    } else if (outcome.conversion.kind === "willing") {
      willing += 1;
    }

    if (outcome.fulfillment.kind === "purchased") {
      purchased += 1;
    } else if (outcome.fulfillment.kind === "stockout") {
      stockout += 1;
    }
  }

  const aware = organicAware + advertisingAware;
  if (aware + unaware !== outcomes.length) {
    throw new Error("audience partition invariant failed");
  }
  if (willing !== purchased + stockout) {
    throw new Error("willing-customer fulfillment invariant failed");
  }
  if (aware !== priceRejected + willing) {
    throw new Error("aware-customer conversion invariant failed");
  }

  return Object.freeze({
    audience: outcomes.length,
    unaware,
    organicAware,
    advertisingAware,
    aware,
    priceRejected,
    willing,
    purchased,
    stockout,
  });
};
