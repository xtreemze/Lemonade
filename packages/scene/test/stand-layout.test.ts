import { describe, expect, it } from "vitest";

import { STAND_LAYOUT, standCounterBounds } from "../src/stand-layout.js";

describe("lemonade stand staging", () => {
  it("keeps the vendor behind a deliberately shallow serving surface", () => {
    const bounds = standCounterBounds();
    const sellerFront = STAND_LAYOUT.sellerZ + STAND_LAYOUT.sellerFrontRadius;

    expect(STAND_LAYOUT.counter.size[2]).toBeLessThanOrEqual(0.8);
    expect(sellerFront).toBeLessThan(bounds.minZ);
    expect(STAND_LAYOUT.canopy.size[2]).toBeLessThanOrEqual(0.85);
  });

  it("keeps prepared cups inside the serving-surface footprint", () => {
    const bounds = standCounterBounds();
    const footprint = STAND_LAYOUT.cupFootprint;

    expect(footprint.minX).toBeGreaterThan(bounds.minX);
    expect(footprint.maxX).toBeLessThan(bounds.maxX);
    expect(footprint.minZ).toBeGreaterThan(bounds.minZ);
    expect(footprint.maxZ).toBeLessThan(bounds.maxZ);
    expect(STAND_LAYOUT.cupCenterY).toBeGreaterThan(bounds.topY);
  });

  it("reserves a clear central sightline between cups and stock", () => {
    expect(STAND_LAYOUT.stockFootprint.maxX)
      .toBeLessThan(STAND_LAYOUT.sellerSightline.minX);
    expect(STAND_LAYOUT.cupFootprint.minX - 0.09)
      .toBeGreaterThan(STAND_LAYOUT.sellerSightline.maxX);
    expect(STAND_LAYOUT.stockFootprint.maxX)
      .toBeLessThan(STAND_LAYOUT.cupFootprint.minX);
  });
});
