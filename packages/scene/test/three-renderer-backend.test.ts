import { describe, expect, it } from "vitest";

import { rendererPixelRatio } from "../src/three-renderer-backend.js";

describe("Three renderer backend", () => {
  it("bounds renderer pixel density for mobile GPU cost", () => {
    expect(rendererPixelRatio(0)).toBe(1);
    expect(rendererPixelRatio(Number.NaN)).toBe(1);
    expect(rendererPixelRatio(1)).toBe(1);
    expect(rendererPixelRatio(1.5)).toBe(1.5);
    expect(rendererPixelRatio(3)).toBe(2);
  });
});
