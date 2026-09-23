import { describe, expect, it } from "vitest";

import {
  birdRouteProgressAt,
  transportGaitAt,
} from "../src/ambient-life.js";

describe("ambient actor lifecycle motion", () => {
  it("inserts a hidden recycle interval before birds restart a route", () => {
    expect(birdRouteProgressAt(0, 1_000, 0, 1)).toBe(0);

    const beforeRecycle = birdRouteProgressAt(870, 1_000, 0, 1);
    expect(beforeRecycle).not.toBeNull();
    expect(beforeRecycle ?? 0).toBeGreaterThan(0.98);

    expect(birdRouteProgressAt(900, 1_000, 0, 1)).toBeNull();
    expect(birdRouteProgressAt(999, 1_000, 0, 1)).toBeNull();
    expect(birdRouteProgressAt(1_000, 1_000, 0, 1)).toBe(0);
  });

  it("does not animate a walk cycle while an actor is stationary", () => {
    expect(transportGaitAt(2_500, 0)).toEqual({
      stride: 0,
      lift: 0,
    });

    const moving = transportGaitAt(2_500, 1.42);
    expect(Math.abs(moving.stride)).toBeGreaterThan(0);
    expect(moving.lift).toBeGreaterThan(0);
  });
});
