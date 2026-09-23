import { describe, expect, it } from "vitest";

import {
  basisPoints,
  type DayEnvironment,
} from "@lemonade/simulation";

import {
  createLemonsvilleSceneState,
  type LemonsvilleSceneInput,
} from "../src/scene.js";

const environment: DayEnvironment = Object.freeze({
  weather: Object.freeze({
    kind: "sunny",
    demandMultiplier: basisPoints(10_000),
  }),
  sentiment: Object.freeze({
    kind: "neutral",
    demandMultiplier: basisPoints(10_000),
  }),
  event: Object.freeze({
    kind: "none",
    demandMultiplier: basisPoints(10_000),
  }),
});

const input = (dayNumber: number): LemonsvilleSceneInput =>
  Object.freeze({
    environment,
    confidence: 3,
    nextConfidence: 3,
    visibleSigns: 2,
    phase: "forecast",
    sold: 0,
    prepared: 10,
    priceCents: 250,
    characterSeed: 0x1020_3040,
    dayNumber,
    durationMs: 6_000,
  });

describe("scene state occurrence composition", () => {
  it("projects a deterministic day-specific occurrence ledger into scene state", () => {
    const first = createLemonsvilleSceneState(input(3), false);
    const repeated = createLemonsvilleSceneState(input(3), false);
    const nextDay = createLemonsvilleSceneState(input(4), false);

    expect(first.dayNumber).toBe(3);
    expect(first.neighborhoodOccurrences.length).toBeGreaterThan(0);
    expect(repeated.neighborhoodOccurrences).toEqual(
      first.neighborhoodOccurrences,
    );
    expect(nextDay.neighborhoodOccurrences).not.toEqual(
      first.neighborhoodOccurrences,
    );
  });

  it("keeps scene occurrences presentation-only", () => {
    const state = createLemonsvilleSceneState(input(2), false);

    expect(
      state.neighborhoodOccurrences.map(
        (occurrence) => occurrence.economicEffect,
      ),
    ).toEqual(state.neighborhoodOccurrences.map(() => "none"));
  });
});
