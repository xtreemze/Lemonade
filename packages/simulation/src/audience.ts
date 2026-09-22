import type {
  BasisPoints,
  CustomerId,
  DayNumber,
  MoneyCents,
  Seed,
} from "./primitives.js";
import {
  basisPoints,
  customerId,
  moneyCents,
  seed,
} from "./primitives.js";
import {
  createSeededRandom,
  type RandomSource,
} from "./rng.js";
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

export type MarketRandomStream =
  | "audience-selection"
  | "awareness"
  | "conversion"
  | "customer-traits"
  | "customer-visual"
  | "market-memory";

export type MarketRandomScope = Readonly<{
  day?: DayNumber;
  customerId?: CustomerId;
}>;

export type AudienceScaleTargets = Readonly<{
  neighborhoodSize: number;
  dailyAudience: number;
}>;

export const AUDIENCE_MODEL_VERSION = 4 as const;

const AUDIENCE_SCALE_TARGETS: Readonly<
  Record<OperatingScaleLevel, AudienceScaleTargets>
> = Object.freeze({
  1: Object.freeze({ neighborhoodSize: 48, dailyAudience: 24 }),
  2: Object.freeze({ neighborhoodSize: 144, dailyAudience: 72 }),
  3: Object.freeze({ neighborhoodSize: 384, dailyAudience: 200 }),
  4: Object.freeze({ neighborhoodSize: 900, dailyAudience: 480 }),
});

const hashText = (initial: number, value: string): number => {
  let hash = initial >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x0100_0193);
  }
  hash ^= 0xff;
  return hash >>> 0;
};

export const deriveMarketSeed = (
  runSeed: Seed,
  stream: MarketRandomStream,
  scope: MarketRandomScope = Object.freeze({}),
): Seed => {
  let hash = 0x811c_9dc5;
  hash = hashText(hash, `audience-model-${String(AUDIENCE_MODEL_VERSION)}`);
  hash = hashText(hash, String(Number(runSeed)));
  hash = hashText(hash, stream);
  hash = hashText(
    hash,
    scope.day === undefined ? "-" : String(Number(scope.day)),
  );
  hash = hashText(
    hash,
    scope.customerId === undefined ? "-" : String(Number(scope.customerId)),
  );
  return seed(hash);
};

export const createMarketRandom = (
  runSeed: Seed,
  stream: MarketRandomStream,
  scope: MarketRandomScope = Object.freeze({}),
): RandomSource => createSeededRandom(deriveMarketSeed(runSeed, stream, scope));

export const audienceTargetsForLevel = (
  level: OperatingScaleLevel,
): AudienceScaleTargets => AUDIENCE_SCALE_TARGETS[level];

const customerTypeFor = (random: RandomSource): CustomerType => {
  const roll = random.nextInt(0, 100);
  if (roll < 35) return "impulse";
  if (roll < 65) return "price-sensitive";
  if (roll < 85) return "regular";
  return "destination";
};

export const customerTraitsFor = (
  runSeed: Seed,
  id: CustomerId,
): CustomerTraits => {
  const random = createMarketRandom(runSeed, "customer-traits", {
    customerId: id,
  });

  return Object.freeze({
    id,
    type: customerTypeFor(random),
    visualSeed: deriveMarketSeed(runSeed, "customer-visual", {
      customerId: id,
    }),
    intrinsicPriceTolerance: moneyCents(random.nextInt(125, 701)),
    advertisingResponsiveness: basisPoints(random.nextInt(3_500, 9_501)),
    familiarity: basisPoints(random.nextInt(1_000, 9_001)),
    loyalty: basisPoints(random.nextInt(1_500, 9_501)),
    weatherCommitment: basisPoints(random.nextInt(2_500, 10_001)),
  });
};

export const dayAudienceFor = (
  runSeed: Seed,
  day: DayNumber,
  level: OperatingScaleLevel,
): DayAudience => {
  const targets = audienceTargetsForLevel(level);
  const ranked = Array.from(
    { length: targets.neighborhoodSize },
    (_, index) => {
      const id = customerId(index);
      const random = createMarketRandom(runSeed, "audience-selection", {
        day,
        customerId: id,
      });
      return Object.freeze({ id, score: random.nextUnit() });
    },
  );

  ranked.sort(
    (left, right) =>
      left.score - right.score || Number(left.id) - Number(right.id),
  );

  return Object.freeze({
    neighborhoodSize: targets.neighborhoodSize,
    customerIds: Object.freeze(
      ranked.slice(0, targets.dailyAudience).map(({ id }) => id),
    ),
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
