import { describe, expect, it } from "vitest";

import { tallestAdultRenderedHeight, WORLD_SCALE } from "../src/world-scale.js";

describe("shared world scale", () => {
  it("keeps the tallest seeded adult within a residential doorway", () => {
    const tallestAdult = tallestAdultRenderedHeight();
    expect(tallestAdult).toBeGreaterThan(1.8);
    expect(tallestAdult).toBeLessThan(WORLD_SCALE.house.doorHeight - 0.08);
    expect(WORLD_SCALE.house.doorWidth).toBeGreaterThanOrEqual(0.9);
  });

  it("uses credible neighborhood road and sidewalk dimensions", () => {
    expect(WORLD_SCALE.street.laneWidth).toBeGreaterThanOrEqual(2.9);
    expect(WORLD_SCALE.street.laneWidth).toBeLessThanOrEqual(3.3);
    expect(WORLD_SCALE.street.roadWidth).toBeCloseTo(
      WORLD_SCALE.street.laneWidth * WORLD_SCALE.street.vehicleLanes,
    );
    expect(WORLD_SCALE.street.sidewalkWidth).toBeGreaterThanOrEqual(1.4);
    expect(WORLD_SCALE.street.curbGap).toBeGreaterThan(0);
    expect(WORLD_SCALE.vehicle.width).toBeLessThan(WORLD_SCALE.street.laneWidth * 0.7);
    expect(WORLD_SCALE.vehicle.length).toBeGreaterThan(4);
    expect(WORLD_SCALE.bicycle.length).toBeGreaterThan(1.5);
  });

  it("keeps loose lemons at ordinary fruit scale", () => {
    expect(WORLD_SCALE.produce.lemonDiameter).toBeGreaterThanOrEqual(0.07);
    expect(WORLD_SCALE.produce.lemonDiameter).toBeLessThanOrEqual(0.11);
  });
});
