import { Matrix4 } from "three";
import { describe, expect, it } from "vitest";

import { createAdvertisingSignField } from "../src/sign-field.js";

describe("advertising sign field", () => {
  it("renders all sign geometry through three instanced meshes", () => {
    const field = createAdvertisingSignField(40);

    expect(field.signs).toHaveLength(40);
    expect(field.meshes).toHaveLength(3);
    expect(field.meshes.every((mesh) => mesh.count === 40)).toBe(true);
  });

  it("keeps logical sign transforms while hiding inactive instances", () => {
    const field = createAdvertisingSignField(2);
    field.signs[0]?.root.position.set(4, 0, -3);
    if (field.signs[0]) {
      field.signs[0].root.visible = true;
    }
    field.sync();

    const visible = new Matrix4();
    const hidden = new Matrix4();
    field.meshes[0]?.getMatrixAt(0, visible);
    field.meshes[0]?.getMatrixAt(1, hidden);

    expect(Math.abs(visible.determinant())).toBeGreaterThan(0);
    expect(hidden.determinant()).toBe(0);
    expect(visible.elements[12]).toBeCloseTo(4);
    expect(visible.elements[14]).toBeCloseTo(-3);
  });
});
