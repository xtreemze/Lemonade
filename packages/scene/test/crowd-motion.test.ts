import { describe, expect, it } from "vitest";

import { ambientPopulationFor } from "../src/ambient-life.js";
import { crowdGroundClearance, crowdPosesAt, walkingBodyLift } from "../src/crowd-motion.js";
import type { PasserbyBeat } from "../src/storyboard.js";

const beats: readonly PasserbyBeat[] = Object.freeze(
  Array.from({ length: 12 }, (_, index) =>
    Object.freeze({
      pedestrianIndex: index,
      startAtMs: 0,
      endAtMs: 6_000,
      direction: index % 2 === 0 ? -1 as const : 1 as const,
      lane: index % 4,
      seesAdvertisement: index < 3,
      signIndex: index < 3 ? index : -1,
    }),
  ),
);

describe("crowd motion", () => {
  it("keeps deterministic sidewalk paths separated and bounded", () => {
    const first = crowdPosesAt(beats, 12, 2_750, 6_000);
    const repeated = crowdPosesAt(beats, 12, 2_750, 6_000);
    expect(repeated).toEqual(first);
    expect(first).toHaveLength(12);

    for (const pose of first) {
      expect(Math.abs(pose.x)).toBeLessThanOrEqual(12.8);
      expect(pose.z).toBeGreaterThan(2.4);
      expect(pose.z).toBeLessThan(5.1);
    }

    for (let left = 0; left < first.length; left += 1) {
      const a = first[left];
      if (a === undefined) continue;
      for (let right = left + 1; right < first.length; right += 1) {
        const b = first[right];
        if (b === undefined) continue;
        const distance = Math.hypot(a.x - b.x, a.z - b.z);
        expect(distance).toBeGreaterThan(0.24);
      }
    }
  });

  it("provides enough ground clearance for the full seeded height range", () => {
    expect(crowdGroundClearance(0.9)).toBeGreaterThan(0.2);
    expect(crowdGroundClearance(1.2)).toBeGreaterThan(0.26);
    expect(walkingBodyLift(0.5, 1, 0)).toBeGreaterThan(0);
  });

  it("reduces exposed street life in storms without changing simulation population math", () => {
    expect(ambientPopulationFor("sunny", "simulation")).toEqual({
      pets: 2,
      wildlife: 2,
      bicycles: 2,
      vehicles: 1,
    });
    expect(ambientPopulationFor("thunderstorm", "simulation")).toEqual({
      pets: 0,
      wildlife: 0,
      bicycles: 0,
      vehicles: 2,
    });
    expect(ambientPopulationFor("sunny", "forecast")).toEqual({
      pets: 0,
      wildlife: 0,
      bicycles: 0,
      vehicles: 0,
    });
  });
});
