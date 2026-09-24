import { describe, expect, it } from "vitest";

import {
  basisPoints,
  type CustomerTraits,
  confidenceToleranceMultiplier,
  conversionForCustomer,
  customerId,
  customerTypeToleranceMultiplier,
  dayNumber,
  effectivePriceTolerance,
  type MarketMemory,
  marketMemoryToleranceMultiplier,
  moneyCents,
  priceAcceptanceProbability,
  seed,
  weatherToleranceMultiplier,
} from "../src/index.js";

const traits = (type: CustomerTraits["type"], weatherCommitment = 5000): CustomerTraits =>
  Object.freeze({
    id: customerId(7),
    type,
    visualSeed: seed(91),
    intrinsicPriceTolerance: moneyCents(300),
    advertisingResponsiveness: basisPoints(8000),
    familiarity: basisPoints(2000),
    loyalty: basisPoints(2000),
    weatherCommitment: basisPoints(weatherCommitment),
  });

const memory = (expectedPrice = 300, satisfaction = 5000): MarketMemory =>
  Object.freeze({
    expectedPrice: moneyCents(expectedPrice),
    advertisingFatigue: basisPoints(0),
    stockoutPressure: basisPoints(0),
    excessPressure: basisPoints(0),
    satisfaction: basisPoints(satisfaction),
  });

describe("customer price conversion", () => {
  it("uses a smooth monotonically decreasing price acceptance curve", () => {
    const tolerance = moneyCents(300);
    const prices = [100, 200, 300, 400, 500].map(moneyCents);
    const probabilities = prices.map((price) =>
      Number(priceAcceptanceProbability(price, tolerance)),
    );

    expect(probabilities[0]).toBeGreaterThan(probabilities[1] ?? 0);
    expect(probabilities[1]).toBeGreaterThan(probabilities[2] ?? 0);
    expect(probabilities[2]).toBe(5000);
    expect(probabilities[2]).toBeGreaterThan(probabilities[3] ?? 0);
    expect(probabilities[3]).toBeGreaterThan(probabilities[4] ?? 0);
  });

  it("gives sunny and hot weather a modest premium without changing audience size", () => {
    const customer = traits("impulse");

    expect(Number(weatherToleranceMultiplier("cloudy", customer))).toBe(10_000);
    expect(Number(weatherToleranceMultiplier("sunny", customer))).toBe(11_200);
    expect(Number(weatherToleranceMultiplier("hot-and-dry", customer))).toBe(11_500);
  });

  it("lets weather-committed regulars and destination customers retain more storm tolerance", () => {
    const impulse = traits("impulse", 2000);
    const regular = traits("regular", 8000);
    const destination = traits("destination", 9000);

    const impulseStorm = Number(weatherToleranceMultiplier("thunderstorm", impulse));
    const regularStorm = Number(weatherToleranceMultiplier("thunderstorm", regular));
    const destinationStorm = Number(weatherToleranceMultiplier("thunderstorm", destination));

    expect(regularStorm).toBeGreaterThan(impulseStorm);
    expect(destinationStorm).toBeGreaterThan(regularStorm);
    expect(destinationStorm).toBeLessThanOrEqual(10_000);
  });

  it("makes price-sensitive customers less tolerant than regular and destination customers", () => {
    expect(Number(customerTypeToleranceMultiplier("price-sensitive"))).toBeLessThan(
      Number(customerTypeToleranceMultiplier("impulse")),
    );
    expect(Number(customerTypeToleranceMultiplier("impulse"))).toBeLessThan(
      Number(customerTypeToleranceMultiplier("regular")),
    );
    expect(Number(customerTypeToleranceMultiplier("regular"))).toBeLessThan(
      Number(customerTypeToleranceMultiplier("destination")),
    );
  });

  it("keeps confidence and price-memory effects bounded", () => {
    const customer = traits("regular");

    expect(Number(confidenceToleranceMultiplier(0))).toBe(9600);
    expect(Number(confidenceToleranceMultiplier(5))).toBe(10_400);

    const lowMemory = Number(marketMemoryToleranceMultiplier(customer, memory(100, 0)));
    const highMemory = Number(marketMemoryToleranceMultiplier(customer, memory(900, 10_000)));

    expect(lowMemory).toBeGreaterThanOrEqual(9200);
    expect(highMemory).toBeLessThanOrEqual(10_800);
    expect(highMemory).toBeGreaterThan(lowMemory);
  });

  it("produces deterministic customer-level conversion outcomes", () => {
    const input = Object.freeze({
      runSeed: seed(0xab_cd_12_34),
      day: dayNumber(6),
      price: moneyCents(325),
      traits: traits("regular", 8000),
      weather: "sunny" as const,
      confidence: 3 as const,
      memory: memory(300, 5500),
    });

    const tolerance = effectivePriceTolerance(input);
    expect(Number(tolerance)).toBeGreaterThan(0);

    const first = conversionForCustomer(input);
    const repeated = conversionForCustomer(input);

    expect(repeated).toEqual(first);
    expect(["willing", "price-rejected"]).toContain(first.kind);
  });

  it("changes conversion probability with price rather than algebraically cancelling it", () => {
    const customer = traits("regular");
    const tolerance = effectivePriceTolerance({
      traits: customer,
      weather: "cloudy",
      confidence: 3,
      memory: memory(),
    });

    const low = Number(priceAcceptanceProbability(moneyCents(150), tolerance));
    const middle = Number(priceAcceptanceProbability(moneyCents(300), tolerance));
    const high = Number(priceAcceptanceProbability(moneyCents(600), tolerance));

    expect(low).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(high);
  });
});
