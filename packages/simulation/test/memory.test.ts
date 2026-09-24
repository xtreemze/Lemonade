import { describe, expect, it } from "vitest";

import {
  basisPoints,
  type CustomerTraits,
  customerId,
  deriveMarketMemory,
  glassCount,
  type MarketMemoryObservation,
  marketMemoryToleranceMultiplier,
  moneyCents,
  neutralMarketMemory,
  nextMarketMemory,
  seed,
  signCount,
} from "../src/index.js";

const observation = (overrides: Partial<MarketMemoryObservation> = {}): MarketMemoryObservation =>
  Object.freeze({
    price: moneyCents(300),
    signs: signCount(1),
    level: 1,
    prepared: glassCount(10),
    willing: 8,
    purchased: 8,
    ...overrides,
  });

const traits: CustomerTraits = Object.freeze({
  id: customerId(4),
  type: "regular",
  visualSeed: seed(0x12_34_ab_cd),
  intrinsicPriceTolerance: moneyCents(300),
  advertisingResponsiveness: basisPoints(8000),
  familiarity: basisPoints(5000),
  loyalty: basisPoints(5000),
  weatherCommitment: basisPoints(5000),
});

describe("market memory", () => {
  it("starts from an inspectable neutral state", () => {
    expect(neutralMarketMemory()).toEqual({
      expectedPrice: moneyCents(0),
      advertisingFatigue: basisPoints(0),
      stockoutPressure: basisPoints(0),
      excessPressure: basisPoints(0),
      satisfaction: basisPoints(5000),
    });
  });

  it("derives the same compact memory from the same history", () => {
    const history = Object.freeze([
      observation(),
      observation({
        price: moneyCents(350),
        signs: signCount(3),
        willing: 10,
        purchased: 8,
      }),
      observation({
        price: moneyCents(325),
        signs: signCount(0),
        prepared: glassCount(8),
        willing: 7,
        purchased: 7,
      }),
    ]);

    expect(deriveMarketMemory(history)).toEqual(deriveMarketMemory(history));
  });

  it("makes repeated stockouts worse than one isolated stockout and then recovers", () => {
    const stockoutDay = observation({
      prepared: glassCount(4),
      willing: 10,
      purchased: 4,
    });
    const healthyDay = observation({
      prepared: glassCount(10),
      willing: 10,
      purchased: 10,
    });

    const isolated = nextMarketMemory(neutralMarketMemory(), stockoutDay);
    let repeated = isolated;
    for (let day = 0; day < 5; day += 1) {
      repeated = nextMarketMemory(repeated, stockoutDay);
    }

    expect(Number(repeated.stockoutPressure)).toBeGreaterThan(Number(isolated.stockoutPressure));
    expect(Number(repeated.satisfaction)).toBeLessThan(Number(isolated.satisfaction));

    let recovered = repeated;
    for (let day = 0; day < 10; day += 1) {
      recovered = nextMarketMemory(recovered, healthyDay);
    }

    expect(Number(recovered.stockoutPressure)).toBeLessThan(Number(repeated.stockoutPressure));
    expect(Number(recovered.satisfaction)).toBeGreaterThan(Number(repeated.satisfaction));
  });

  it("distinguishes sudden price spikes from a gradual path to the same price", () => {
    const stablePrefix = [
      observation({ price: moneyCents(300) }),
      observation({ price: moneyCents(300) }),
      observation({ price: moneyCents(300) }),
    ];

    const sudden = deriveMarketMemory([...stablePrefix, observation({ price: moneyCents(600) })]);
    const gradual = deriveMarketMemory([
      observation({ price: moneyCents(300) }),
      observation({ price: moneyCents(400) }),
      observation({ price: moneyCents(500) }),
      observation({ price: moneyCents(600) }),
    ]);

    expect(Number(sudden.expectedPrice)).toBeGreaterThan(300);
    expect(Number(sudden.expectedPrice)).toBeLessThan(600);
    expect(Number(gradual.expectedPrice)).toBeGreaterThan(Number(sudden.expectedPrice));
  });

  it("keeps excess-production effects materially smaller than stockout effects", () => {
    let excess = neutralMarketMemory();
    let stockout = neutralMarketMemory();
    for (let day = 0; day < 8; day += 1) {
      excess = nextMarketMemory(
        excess,
        observation({
          prepared: glassCount(10),
          willing: 2,
          purchased: 2,
        }),
      );
      stockout = nextMarketMemory(
        stockout,
        observation({
          prepared: glassCount(2),
          willing: 10,
          purchased: 2,
        }),
      );
    }

    const excessMultiplier = Number(marketMemoryToleranceMultiplier(traits, excess));
    const stockoutMultiplier = Number(marketMemoryToleranceMultiplier(traits, stockout));

    expect(10_000 - excessMultiplier).toBeLessThanOrEqual(200);
    expect(stockoutMultiplier).toBeLessThan(excessMultiplier);
  });

  it("routes advertising pressure through the existing bounded fatigue model", () => {
    let memory = neutralMarketMemory();

    for (let day = 0; day < 8; day += 1) {
      memory = nextMarketMemory(memory, observation({ signs: signCount(3) }));
    }
    const pressured = Number(memory.advertisingFatigue);

    for (let day = 0; day < 8; day += 1) {
      memory = nextMarketMemory(memory, observation({ signs: signCount(0) }));
    }

    expect(pressured).toBeGreaterThan(0);
    expect(Number(memory.advertisingFatigue)).toBeLessThan(pressured);
  });

  it("rejects impossible fulfillment summaries", () => {
    expect(() =>
      nextMarketMemory(neutralMarketMemory(), observation({ willing: 4, purchased: 5 })),
    ).toThrow(/purchased/i);
  });
});
