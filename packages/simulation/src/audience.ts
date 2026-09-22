import type {
  BasisPoints,
  CustomerId,
  MoneyCents,
  Seed,
} from "./primitives.js";

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
