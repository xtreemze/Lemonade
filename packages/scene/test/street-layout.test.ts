import { describe, expect, it } from "vitest";

import {
  gardenSignPosition,
  STREET_LAYOUT,
  sidewalkLaneZ,
} from "../src/street-layout.js";

describe("street zoning", () => {
  it("keeps all pedestrian lanes inside the widened near sidewalk", () => {
    for (let lane = 0; lane < 4; lane += 1) {
      const z = sidewalkLaneZ(lane);
      expect(z).toBeGreaterThan(STREET_LAYOUT.nearSidewalk.minZ);
      expect(z).toBeLessThan(STREET_LAYOUT.nearSidewalk.maxZ);
      expect(z).toBeLessThan(STREET_LAYOUT.road.minZ);
    }
    expect(STREET_LAYOUT.nearSidewalk.maxZ - STREET_LAYOUT.nearSidewalk.minZ)
      .toBeGreaterThanOrEqual(1.8);
  });

  it("places advertising signs in garden bands instead of the sidewalk or road", () => {
    for (let index = 0; index < 40; index += 1) {
      const position = gardenSignPosition(index);
      expect(position.z).toBeLessThan(STREET_LAYOUT.nearSidewalk.minZ);
      expect(position.z).toBeLessThan(STREET_LAYOUT.road.minZ);
      expect(position.x).toBeGreaterThan(-13.3);
      expect(position.x).toBeLessThan(-1.7);
      expect(position.x < -9.55 || position.x > -7.35).toBe(true);
    }
  });
});
