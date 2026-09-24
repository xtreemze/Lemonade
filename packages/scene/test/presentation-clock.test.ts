import { describe, expect, it } from "vitest";

import {
  animationElapsedAt,
  resumedAnimationEpoch,
  stateUpdateElapsed,
} from "../src/presentation-clock.js";

describe("scene presentation clock", () => {
  it("preserves the last rendered elapsed time for state-only updates", () => {
    expect(stateUpdateElapsed(false, 6200, 14_000)).toBe(6200);
    expect(stateUpdateElapsed(false, 18_000, 14_000)).toBe(14_000);
  });

  it("restarts genuine presentation changes at zero", () => {
    expect(stateUpdateElapsed(true, 6200, 14_000)).toBe(0);
  });

  it("resumes animation without advancing while rendering was paused", () => {
    const timestamp = 20_000;
    const lastElapsed = 6200;
    const epoch = resumedAnimationEpoch(timestamp, lastElapsed);

    expect(animationElapsedAt(timestamp, epoch, 14_000)).toBe(lastElapsed);
  });

  it("clamps elapsed presentation time to the active duration", () => {
    expect(animationElapsedAt(3000, 5000, 14_000)).toBe(0);
    expect(animationElapsedAt(25_000, 5000, 14_000)).toBe(14_000);
  });
});
