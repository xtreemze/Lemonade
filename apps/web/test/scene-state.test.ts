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

  it("keeps the forecast stand empty without replaying completed sales", () => {
    const state = createLemonsvilleSceneState({ ...input, phase: "forecast" }, false);

    expect(state.storyboard.sold).toBe(0);
  });
});
