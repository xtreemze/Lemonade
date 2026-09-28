import { describe, expect, it } from "vitest";

import {
  advertisingBaseReach,
  advertisingFatigueReachPenalty,
  awarenessForCustomer,
  basisPoints,
  type CustomerTraits,
  customerId,
  dayNumber,
  effectiveAdvertisingReach,
  moneyCents,
  nextAdvertisingFatigue,
  organicAwarenessProbability,
  seed,
  signCount,
  weatherAdvertisingAttention,
} from "../src/index.js";

const traits = Object.freeze({
  id: customerId(7),
  type: "impulse",
  visualSeed: seed(91),
  intrinsicPriceTolerance: moneyCents(250),
  advertisingResponsiveness: basisPoints(8000),
  familiarity: basisPoints(2000),
  loyalty: basisPoints(2000),
  weatherCommitment: basisPoints(5000),
}) satisfies CustomerTraits;

describe("advertising awareness", () => {
  it("uses saturating reach with non-increasing marginal gains", () => {
    let previousReach = Number(advertisingBaseReach(signCount(0)));
    let previousMarginal = Number.POSITIVE_INFINITY;

    for (let signs = 1; signs <= 40; signs += 1) {
      const reach = Number(advertisingBaseReach(signCount(signs)));
      const marginal = reach - previousReach;

      expect(marginal).toBeGreaterThanOrEqual(0);
      expect(marginal).toBeLessThanOrEqual(previousMarginal);
      expect(reach).toBeLessThanOrEqual(10_000);

      previousMarginal = marginal;
      previousReach = reach;
    }

    expect(previousReach).toBeLessThan(10_000);
  });

  it("keeps thunderstorm sign attention materially below ordinary weather", () => {
    expect(Number(weatherAdvertisingAttention("sunny"))).toBe(10_000);
    expect(Number(weatherAdvertisingAttention("thunderstorm"))).toBe(6500);

    const fresh = basisPoints(0);
    const sunnyReach = Number(effectiveAdvertisingReach(signCount(10), traits, "sunny", fresh));
    const stormReach = Number(
      effectiveAdvertisingReach(signCount(10), traits, "thunderstorm", fresh),
    );

    expect(stormReach).toBeLessThan(sunnyReach);
    expect(stormReach / sunnyReach).toBeCloseTo(0.65, 1);
  });

  it("bounds repeated-ad fatigue and recovers when advertising pressure falls", () => {
    let fatigue = basisPoints(0);
    const freshReach = Number(effectiveAdvertisingReach(signCount(40), traits, "sunny", fatigue));

    for (let day = 0; day < 12; day += 1) {
      fatigue = nextAdvertisingFatigue(fatigue, signCount(40), 4);
    }

    const repeatedPenalty = Number(advertisingFatigueReachPenalty(fatigue));
    const repeatedReach = Number(
      effectiveAdvertisingReach(signCount(40), traits, "sunny", fatigue),
    );

    expect(repeatedPenalty).toBeGreaterThan(1000);
    expect(repeatedPenalty).toBeLessThanOrEqual(1800);
    expect(repeatedReach).toBeLessThan(freshReach);

    const fatigued = fatigue;
    for (let day = 0; day < 8; day += 1) {
      fatigue = nextAdvertisingFatigue(fatigue, signCount(0), 4);
    }

    expect(Number(fatigue)).toBeLessThan(Number(fatigued));
    expect(Number(advertisingFatigueReachPenalty(fatigue))).toBeLessThan(repeatedPenalty);
  });


  it("preserves the existing organic-awareness baseline at neutral history", () => {
    expect(
      Number(
        organicAwarenessProbability(traits, {
          confidence: 3,
          satisfaction: basisPoints(5000),
        }),
      ),
    ).toBe(1680);
  });

  it("adds bounded confidence and satisfaction influence to organic awareness", () => {
    const neutral = Number(
      organicAwarenessProbability(traits, {
        confidence: 3,
        satisfaction: basisPoints(5000),
      }),
    );
    const discouraged = Number(
      organicAwarenessProbability(traits, {
        confidence: 0,
        satisfaction: basisPoints(0),
      }),
    );
    const trusted = Number(
      organicAwarenessProbability(traits, {
        confidence: 5,
        satisfaction: basisPoints(10_000),
      }),
    );

    expect(discouraged).toBeLessThan(neutral);
    expect(trusted).toBeGreaterThan(neutral);
    expect(neutral - discouraged).toBeLessThanOrEqual(500);
    expect(trusted - neutral).toBeLessThanOrEqual(500);
  });


  it("applies bounded customer-type semantics to organic and advertising awareness", () => {
    const withType = (type: CustomerTraits["type"]): CustomerTraits =>
      Object.freeze({
        ...traits,
        type,
      });
    const context = Object.freeze({
      confidence: 3 as const,
      satisfaction: basisPoints(5000),
    });

    const impulseOrganic = Number(organicAwarenessProbability(withType("impulse"), context));
    const regularOrganic = Number(organicAwarenessProbability(withType("regular"), context));
    const destinationOrganic = Number(
      organicAwarenessProbability(withType("destination"), context),
    );

    expect(regularOrganic).toBeGreaterThan(impulseOrganic);
    expect(destinationOrganic).toBeGreaterThan(impulseOrganic);
    expect(destinationOrganic).toBeGreaterThan(0);

    const impulseAd = Number(
      effectiveAdvertisingReach(
        signCount(3),
        withType("impulse"),
        "sunny",
        basisPoints(0),
      ),
    );
    const priceSensitiveAd = Number(
      effectiveAdvertisingReach(
        signCount(3),
        withType("price-sensitive"),
        "sunny",
        basisPoints(0),
      ),
    );
    const regularAd = Number(
      effectiveAdvertisingReach(
        signCount(3),
        withType("regular"),
        "sunny",
        basisPoints(0),
      ),
    );
    const destinationAd = Number(
      effectiveAdvertisingReach(
        signCount(3),
        withType("destination"),
        "sunny",
        basisPoints(0),
      ),
    );

    expect(impulseAd).toBeGreaterThan(priceSensitiveAd);
    expect(priceSensitiveAd).toBeGreaterThan(regularAd);
    expect(regularAd).toBeGreaterThan(destinationAd);
    expect(destinationAd).toBeGreaterThan(0);
  });

  it("keeps type-modified awareness probabilities bounded", () => {
    for (const type of ["impulse", "price-sensitive", "regular", "destination"] as const) {
      const customer = Object.freeze({
        ...traits,
        type,
        familiarity: basisPoints(10_000),
        loyalty: basisPoints(10_000),
        advertisingResponsiveness: basisPoints(10_000),
      });

      expect(
        Number(
          organicAwarenessProbability(customer, {
            confidence: 5,
            satisfaction: basisPoints(10_000),
          }),
        ),
      ).toBeLessThanOrEqual(10_000);
      expect(
        Number(
          effectiveAdvertisingReach(
            signCount(40),
            customer,
            "hot-and-dry",
            basisPoints(0),
          ),
        ),
      ).toBeLessThanOrEqual(10_000);
    }
  });

  it("can produce organic awareness with zero advertising", () => {
    let foundOrganic = false;

    for (let day = 1; day <= 80 && !foundOrganic; day += 1) {
      const awareness = awarenessForCustomer({
        runSeed: seed(0x12_34_56_78),
        day: dayNumber(day),
        traits,
        signs: signCount(0),
        weather: "sunny",
        advertisingFatigue: basisPoints(0),
        confidence: 3,
        satisfaction: basisPoints(5000),
      });
      foundOrganic ||= awareness.kind === "organic";
    }

    expect(foundOrganic).toBe(true);
  });

  it("is deterministic and returns only awareness outcomes", () => {
    const input = Object.freeze({
      runSeed: seed(0xab_cd_12_34),
      day: dayNumber(6),
      traits,
      signs: signCount(7),
      weather: "cloudy",
      advertisingFatigue: basisPoints(2500),
      confidence: 4 as const,
      satisfaction: basisPoints(6200),
    });

    const first = awarenessForCustomer(input);
    const repeated = awarenessForCustomer(input);

    expect(repeated).toEqual(first);
    expect(["unaware", "organic", "advertising"]).toContain(first.kind);
    if (first.kind === "advertising") {
      expect(first.signIndex).toBeGreaterThanOrEqual(0);
      expect(first.signIndex).toBeLessThan(Number(input.signs));
    }
  });
});
