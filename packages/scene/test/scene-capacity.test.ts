import { describe, expect, it } from "vitest";

import {
  BUYER_PROFILE_INDEX_OFFSET,
  BUYER_VISUAL_POOL_SIZE,
  PASSERBY_ACTIVE_LIMIT,
  PASSERBY_BASE_ACTIVE_COUNT,
  PASSERBY_FOREGROUND_TARGET,
  PASSERBY_VISUAL_POOL_SIZE,
} from "../src/scene-capacity.js";

describe("scene visual capacity", () => {
  it("reserves a sustained foreground cohort while keeping passerby rendering bounded", () => {
    expect(PASSERBY_FOREGROUND_TARGET).toBe(20);
    expect(PASSERBY_BASE_ACTIVE_COUNT).toBeGreaterThan(PASSERBY_FOREGROUND_TARGET);
    expect(PASSERBY_ACTIVE_LIMIT).toBe(36);
    expect(PASSERBY_BASE_ACTIVE_COUNT).toBeLessThanOrEqual(PASSERBY_ACTIVE_LIMIT);
    expect(PASSERBY_VISUAL_POOL_SIZE).toBeGreaterThan(PASSERBY_ACTIVE_LIMIT);
    expect(PASSERBY_VISUAL_POOL_SIZE).toBeLessThan(128);
  });

  it("preserves buyer seeded profile indexing while keeping the existing buyer lifecycle capacity", () => {
    expect(BUYER_PROFILE_INDEX_OFFSET).toBe(128);
    expect(BUYER_VISUAL_POOL_SIZE).toBe(192);
  });
});
