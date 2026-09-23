import { describe, expect, it, vi } from "vitest";

import { createCharacterGeometryPool } from "../src/character-geometry-pool.js";

describe("character geometry pool", () => {
  it("reuses identical geometry definitions and keeps distinct shapes separate", () => {
    const pool = createCharacterGeometryPool();
    const first = pool.cylinder(0.25, 0.34, 0.9, 10);
    const repeated = pool.cylinder(0.25, 0.34, 0.9, 10);
    const other = pool.cylinder(0.25, 0.34, 0.8, 10);

    expect(repeated).toBe(first);
    expect(other).not.toBe(first);
    expect(pool.owns(first)).toBe(true);
    expect(pool.owns(other)).toBe(true);
  });

  it("disposes each pooled geometry once", () => {
    const pool = createCharacterGeometryPool();
    const box = pool.box(1, 2, 3);
    const sphere = pool.sphere(1, 8, 6);
    const boxDispose = vi.spyOn(box, "dispose");
    const sphereDispose = vi.spyOn(sphere, "dispose");

    pool.dispose();

    expect(boxDispose).toHaveBeenCalledTimes(1);
    expect(sphereDispose).toHaveBeenCalledTimes(1);
    expect(pool.owns(box)).toBe(false);
  });
});
