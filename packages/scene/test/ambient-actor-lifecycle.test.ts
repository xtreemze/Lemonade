import { describe, expect, it } from "vitest";

import { birdRouteProgressAt } from "../src/ambient-life.js";

describe("ambient actor lifecycle motion", () => {
  it("inserts a hidden recycle interval before birds restart a route", () => {
    expect(birdRouteProgressAt(0, 1000, 0, 1)).toBe(0);

    const beforeRecycle = birdRouteProgressAt(870, 1000, 0, 1);
    expect(beforeRecycle).not.toBeNull();
    expect(beforeRecycle ?? 0).toBeGreaterThan(0.98);

    expect(birdRouteProgressAt(900, 1000, 0, 1)).toBeNull();
    expect(birdRouteProgressAt(999, 1000, 0, 1)).toBeNull();
    expect(birdRouteProgressAt(1000, 1000, 0, 1)).toBe(0);
  });

});
