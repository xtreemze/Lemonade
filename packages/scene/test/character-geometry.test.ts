import { describe, expect, it } from "vitest";

import { createCharacterGeometrySet } from "../src/character-geometry.js";

describe("character geometry set", () => {
  it("creates one reusable geometry per core body part for a scene", () => {
    const geometries = createCharacterGeometrySet();

    expect(new Set(Object.values(geometries)).size).toBe(10);
    expect(geometries.armUpper).not.toBe(geometries.legUpper);
    expect(geometries.hand).not.toBe(geometries.foot);
  });

  it("does not share GPU resources across separate scene lifetimes", () => {
    const first = createCharacterGeometrySet();
    const second = createCharacterGeometrySet();

    expect(first.torso).not.toBe(second.torso);
    expect(first.head).not.toBe(second.head);
  });
});
