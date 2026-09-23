import { describe, expect, it } from "vitest";

import {
  advanceMobilityClock,
  createMobilityClock,
} from "../src/mobility-clock.js";

describe("actor-owned mobility clock", () => {
  it("advances route distance from physical velocity with bounded acceleration", () => {
    const initial = createMobilityClock({
      routeLength: 100,
      maxAcceleration: 2,
    });
    const afterHalfSecond = advanceMobilityClock(initial, {
      deltaMs: 500,
      desiredSpeed: 1.4,
    });

    expect(afterHalfSecond.velocity).toBeCloseTo(1, 6);
    expect(afterHalfSecond.distance).toBeCloseTo(0.25, 6);

    const afterOneSecond = advanceMobilityClock(afterHalfSecond, {
      deltaMs: 500,
      desiredSpeed: 1.4,
    });
    expect(afterOneSecond.velocity).toBeCloseTo(1.4, 6);
    expect(afterOneSecond.distance).toBeCloseTo(0.91, 6);
  });

  it("decelerates while yielding and resumes from the held route distance without catch-up", () => {
    let state = createMobilityClock({
      routeLength: 100,
      maxAcceleration: 2.8,
      initialDistance: 12,
      initialVelocity: 1.4,
    });

    state = advanceMobilityClock(state, {
      deltaMs: 500,
      desiredSpeed: 1.4,
      motion: "yield",
    });
    expect(state.velocity).toBeCloseTo(0, 6);
    const heldDistance = state.distance;

    for (let index = 0; index < 20; index += 1) {
      state = advanceMobilityClock(state, {
        deltaMs: 50,
        desiredSpeed: 1.4,
        motion: "yield",
      });
    }

    expect(state.distance).toBeCloseTo(heldDistance, 6);

    const resumed = advanceMobilityClock(state, {
      deltaMs: 100,
      desiredSpeed: 1.4,
      motion: "move",
    });
    expect(resumed.distance - heldDistance).toBeLessThan(0.03);
    expect(resumed.velocity).toBeCloseTo(0.28, 6);
  });

  it("keeps explicit service dwell stationary regardless of elapsed time", () => {
    const moving = createMobilityClock({
      routeLength: 100,
      maxAcceleration: 2,
      initialDistance: 8.25,
    });
    const dwell = advanceMobilityClock(moving, {
      deltaMs: 4_000,
      desiredSpeed: 1.4,
      motion: "dwell",
    });

    expect(dwell.distance).toBe(8.25);
    expect(dwell.velocity).toBe(0);
    expect(dwell.lifecycle).toBe("active");
  });

  it("completes at the route boundary instead of wrapping or overshooting", () => {
    const nearEnd = createMobilityClock({
      routeLength: 10,
      maxAcceleration: 4,
      initialDistance: 9.8,
      initialVelocity: 1.2,
    });
    const completed = advanceMobilityClock(nearEnd, {
      deltaMs: 500,
      desiredSpeed: 1.2,
    });

    expect(completed.distance).toBe(10);
    expect(completed.velocity).toBe(0);
    expect(completed.lifecycle).toBe("completed");

    expect(
      advanceMobilityClock(completed, {
        deltaMs: 5_000,
        desiredSpeed: 10,
      }),
    ).toBe(completed);
  });

  it("is invariant to frame subdivision while the desired motion is unchanged", () => {
    const initial = createMobilityClock({
      routeLength: 100,
      maxAcceleration: 2,
      initialVelocity: 0.2,
    });

    const coarse = advanceMobilityClock(initial, {
      deltaMs: 1_000,
      desiredSpeed: 1.4,
    });

    let fine = initial;
    for (let index = 0; index < 10; index += 1) {
      fine = advanceMobilityClock(fine, {
        deltaMs: 100,
        desiredSpeed: 1.4,
      });
    }

    expect(fine.velocity).toBeCloseTo(coarse.velocity, 9);
    expect(fine.distance).toBeCloseTo(coarse.distance, 9);
  });
});
