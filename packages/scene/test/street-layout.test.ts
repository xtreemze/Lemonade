import { describe, expect, it } from "vitest";

import {
  gardenSignPosition,
  generateStreetNetwork,
  STREET_LAYOUT,
  sidewalkLaneZ,
  sidewalkLaneZForSide,
  sidewalkSideForActor,
  streetStripsOverlap,
} from "../src/street-layout.js";
import { WORLD_SCALE } from "../src/world-scale.js";

describe("street zoning", () => {
  it("keeps all pedestrian lanes inside the near sidewalk and outside the road", () => {
    for (let lane = 0; lane < 4; lane += 1) {
      const z = sidewalkLaneZ(lane);
      expect(z).toBeGreaterThan(STREET_LAYOUT.nearSidewalk.minZ);
      expect(z).toBeLessThan(STREET_LAYOUT.nearSidewalk.maxZ);
      expect(z).toBeLessThan(STREET_LAYOUT.road.minZ);
    }
    expect(STREET_LAYOUT.nearSidewalk.depth).toBeCloseTo(
      WORLD_SCALE.street.sidewalkWidth,
    );
    expect(
      STREET_LAYOUT.road.minZ - STREET_LAYOUT.nearSidewalk.maxZ,
    ).toBeGreaterThanOrEqual(WORLD_SCALE.street.curbGap - 0.001);
  });

  it("provides deterministic lanes on both sidewalks", () => {
    expect(sidewalkSideForActor(0)).toBe("near");
    expect(sidewalkSideForActor(1)).toBe("far");
    for (let lane = 0; lane < 4; lane += 1) {
      const nearZ = sidewalkLaneZForSide("near", lane);
      const farZ = sidewalkLaneZForSide("far", lane);
      expect(nearZ).toBeGreaterThan(STREET_LAYOUT.nearSidewalk.minZ);
      expect(nearZ).toBeLessThan(STREET_LAYOUT.nearSidewalk.maxZ);
      expect(farZ).toBeGreaterThan(STREET_LAYOUT.farSidewalk.minZ);
      expect(farZ).toBeLessThan(STREET_LAYOUT.farSidewalk.maxZ);
    }
  });

  it("generates deterministic curved streets while keeping sidewalks off roadway geometry", () => {
    const first = generateStreetNetwork(0x1234abcd);
    const repeated = generateStreetNetwork(0x1234abcd);
    const alternate = generateStreetNetwork(0x1234abce);

    expect(repeated).toEqual(first);
    expect(alternate.roads).not.toEqual(first.roads);
    expect(first.roads.length).toBeGreaterThan(30);
    expect(first.sidewalks.length).toBeGreaterThan(20);
    expect(
      first.roads.filter((strip) => Math.abs(strip.rotationY) > 0.08).length,
    ).toBeGreaterThan(8);

    for (const road of first.roads) {
      expect(road.width).toBeCloseTo(WORLD_SCALE.street.roadWidth);
    }
    for (const sidewalk of first.sidewalks) {
      expect(sidewalk.width).toBeCloseTo(WORLD_SCALE.street.sidewalkWidth);
      expect(
        first.roads.some((road) => streetStripsOverlap(sidewalk, road)),
      ).toBe(false);
    }

    const mainSidewalks = first.sidewalks.filter(
      (strip) => strip.streetId === "main",
    );
    expect(mainSidewalks.length).toBeGreaterThanOrEqual(12);
  });

  it("places advertising signs in garden bands instead of the sidewalk or road", () => {
    for (let index = 0; index < 40; index += 1) {
      const position = gardenSignPosition(index);
      expect(position.z).toBeLessThan(STREET_LAYOUT.nearSidewalk.minZ);
      expect(position.z).toBeLessThan(STREET_LAYOUT.road.minZ);
      expect(position.x).toBeGreaterThan(-13.3);
      expect(position.x).toBeLessThan(-1.7);
    }
  });
});
