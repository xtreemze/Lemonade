import {
  createInitialState,
  createSeededRandom,
  generateEnvironment,
  seed,
} from "@lemonade/simulation";
import { describe, expect, it } from "vitest";

import { createLemonsvilleSceneState } from "../src/scene.js";

const environment = generateEnvironment(
  createInitialState().day,
  createSeededRandom(seed(0x1e_ad_20_26)),
);

const input = {
  environment,
  confidence: 3,
  nextConfidence: 4,
  visibleSigns: 2,
  sold: 7,
  prepared: 20,
  priceCents: 150,
  characterSeed: 12_345,
  dayNumber: 1,
  durationMs: 14_000,
} as const;

describe("Lemonsville scene state", () => {
  it("retains resolved sales while idle so unsold end-of-day cups remain authoritative", () => {
    const state = createLemonsvilleSceneState({ ...input, phase: "idle" }, false);

    expect(state.storyboard.prepared).toBe(20);
    expect(state.storyboard.sold).toBe(7);
    expect(state.storyboard.prepared - state.storyboard.sold).toBe(13);
  });

  it("uses authoritative outcomes instead of deriving customers from sold and signs", () => {
    const state = createLemonsvilleSceneState(
      {
        ...input,
        phase: "simulation",
        sold: 99,
        customerOutcomes: Object.freeze([
          Object.freeze({
            id: 11,
            visualSeed: 201,
            awareness: Object.freeze({ kind: "advertising" as const, signIndex: 1 }),
            conversion: Object.freeze({ kind: "price-rejected" as const }),
            fulfillment: Object.freeze({ kind: "none" as const }),
          }),
          Object.freeze({
            id: 12,
            visualSeed: 202,
            awareness: Object.freeze({ kind: "organic" as const }),
            conversion: Object.freeze({ kind: "willing" as const }),
            fulfillment: Object.freeze({ kind: "purchased" as const, saleIndex: 0 }),
          }),
          Object.freeze({
            id: 13,
            visualSeed: 203,
            awareness: Object.freeze({ kind: "organic" as const }),
            conversion: Object.freeze({ kind: "willing" as const }),
            fulfillment: Object.freeze({ kind: "stockout" as const }),
          }),
        ]),
      },
      false,
    );

    expect(state.storyboard.sold).toBe(1);
    expect(state.storyboard.sales[0]?.customerId).toBe(12);
    expect(state.storyboard.passersBy.map((beat) => beat.customerId)).toEqual([11, 13]);
    expect(state.storyboard.passersBy.map((beat) => beat.intentKind)).toEqual([
      "price-reject",
      "stockout",
    ]);
    expect(state.storyboard.adViewerCount).toBe(1);
  });

  it("keeps the forecast stand empty without replaying completed sales", () => {
    const state = createLemonsvilleSceneState({ ...input, phase: "forecast" }, false);

    expect(state.storyboard.sold).toBe(0);
  });
});
