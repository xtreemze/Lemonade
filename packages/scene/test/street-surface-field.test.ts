import { Matrix4 } from "three";
import { describe, expect, it } from "vitest";
import type { StreetStripSpec } from "../src/street-layout.js";
import { createStreetSurfaceField } from "../src/street-surface-field.js";

const strip = (
  role: StreetStripSpec["role"],
  streetId: string,
  segmentIndex: number,
  x: number,
): StreetStripSpec =>
  Object.freeze({
    role,
    streetId,
    segmentIndex,
    x,
    z: 5,
    length: 8,
    width: role === "sidewalk" ? 1.6 : 6,
    rotationY: 0.2,
  });

describe("street surface field", () => {
  it("retains semantic anchors while batching rendered surfaces", () => {
    const roads = [strip("paved-road", "main", 0, 0), strip("paved-road", "cross", 1, 10)];
    const sidewalks = [strip("sidewalk", "main-near", 0, 0)];
    const field = createStreetSurfaceField(roads, sidewalks);

    expect(field.anchors).toHaveLength(3);
    expect(
      field.anchors.filter((anchor) => anchor.userData.sceneRole === "paved-road"),
    ).toHaveLength(2);
    expect(field.meshes).toHaveLength(3);
    expect(field.meshes.reduce((total, mesh) => total + mesh.count, 0)).toBe(3);
  });

  it("encodes strip position and scale in instance transforms", () => {
    const field = createStreetSurfaceField([strip("paved-road", "main", 0, 12)], []);
    const matrix = new Matrix4();
    field.meshes[0]?.getMatrixAt(0, matrix);

    expect(matrix.elements[12]).toBeCloseTo(12);
    expect(matrix.elements[14]).toBeCloseTo(5);
    expect(Math.abs(matrix.determinant())).toBeGreaterThan(0);
  });
});
