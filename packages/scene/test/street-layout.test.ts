import { describe, expect, it } from "vitest";

import {
  gardenSignPosition,
  STREET_LAYOUT,
  sidewalkLaneZ,
} from "../src/street-layout.js";

describe("street zoning", () => {
  it("maps pedestrian lanes onto both sidewalks without entering the road", () => {
    const lanes = Array.from({ length: 4 }, (_, lane) => sidewalkLaneZ(lane));
    const near = lanes.filter((z) => z < STREET_LAYOUT.road.minZ);
    const far = lanes.filter((z) => z > STREET_LAYOUT.road.maxZ);

    expect(near).toHaveLength(2);
    expect(far).toHaveLength(2);
    for (const z of near) {
      expect(z).toBeGreaterThan(STREET_LAYOUT.nearSidewalk.minZ);
      expect(z).toBeLessThan(STREET_LAYOUT.nearSidewalk.maxZ);
    }
    for (const z of far) {
      expect(z).toBeGreaterThan(STREET_LAYOUT.farSidewalk.minZ);
      expect(z).toBeLessThan(STREET_LAYOUT.farSidewalk.maxZ);
    }
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
