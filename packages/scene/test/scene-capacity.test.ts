import { describe, expect, it } from "vitest";

import {
  BUYER_PROFILE_INDEX_OFFSET,
  BUYER_VISUAL_POOL_SIZE,
  PASSERBY_ACTIVE_LIMIT,
  PASSERBY_VISUAL_POOL_SIZE,
} from "../src/scene-capacity.js";

describe("scene visual capacity", () => {
  it("bounds eager passerby rigs above the visible limit without retaining the old 128-rig allocation", () => {
    expect(PASSERBY_ACTIVE_LIMIT).toBe(36);
    expect(PASSERBY_VISUAL_POOL_SIZE).toBeGreaterThan(PASSERBY_ACTIVE_LIMIT);
    expect(PASSERBY_VISUAL_POOL_SIZE).toBeLessThan(128);
  });

  it("preserves buyer seeded profile indexing while keeping the existing buyer lifecycle capacity", () => {
    expect(BUYER_PROFILE_INDEX_OFFSET).toBe(128);
    expect(BUYER_VISUAL_POOL_SIZE).toBe(192);
  });
});
