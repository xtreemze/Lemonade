import { describe, expect, it } from "vitest";

import { rendererDiagnostics } from "../src/renderer-diagnostics.js";

describe("renderer diagnostics", () => {
  it("projects stable renderer counters without leaking the renderer object", () => {
    const snapshot = rendererDiagnostics({
      render: {
        calls: 87,
        frame: 42,
        lines: 12,
        points: 3,
        triangles: 45_678,
      },
      memory: {
        geometries: 321,
        textures: 17,
      },
    });

    expect(snapshot).toEqual({
      frame: 42,
      drawCalls: 87,
      triangles: 45_678,
      lines: 12,
      points: 3,
      geometries: 321,
      textures: 17,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
});
