import { describe, expect, it } from "vitest";

import {
  GARDEN_SIGN_MAX_Z,
  signGardenPosition,
} from "../src/sign-placement.js";

describe("garden advertising sign placement", () => {
  it("keeps every sign behind the sidewalk edge and distributes larger campaigns into the yard", () => {
    const positions = Array.from({ length: 40 }, (_, index) =>
      signGardenPosition(index),
    );

    expect(positions.every((position) => position.z <= GARDEN_SIGN_MAX_Z)).toBe(true);
    expect(Math.max(...positions.map((position) => position.z))).toBeLessThan(0.4);
    expect(Math.min(...positions.map((position) => position.z))).toBeLessThan(-1.5);
    expect(new Set(positions.map((position) => position.z)).size).toBeGreaterThan(3);
  });

  it("keeps signs split across both sides of the stand", () => {
    const positions = Array.from({ length: 12 }, (_, index) =>
      signGardenPosition(index),
    );
    expect(positions.some((position) => position.x < 0)).toBe(true);
    expect(positions.some((position) => position.x > 0)).toBe(true);
  });
});
