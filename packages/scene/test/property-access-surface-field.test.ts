import { describe, expect, it } from "vitest";

import {
  createPropertyAccessSurfaceField,
  type PropertyAccessSurfaceSpec,
} from "../src/property-access-surface-field.js";

const specs: readonly PropertyAccessSurfaceSpec[] = Object.freeze([
  Object.freeze({
    role: "driveway",
    length: 8,
    width: 2.7,
    x: 2,
    z: -2,
    rotationY: 0.15,
  }),
  Object.freeze({
    role: "front-path",
    length: 5,
    width: 1.1,
    x: -1,
    z: -3,
    rotationY: -0.2,
  }),
  Object.freeze({
    role: "driveway",
    length: 7,
    width: 2.7,
    x: 9,
    z: 4,
    rotationY: 0,
  }),
]);

describe("property access surface field", () => {
  it("keeps one semantic anchor per access strip while batching by role", () => {
    const field = createPropertyAccessSurfaceField(specs);

    expect(field.anchors).toHaveLength(3);
    expect(
      field.anchors.map((anchor) => anchor.userData["sceneRole"]),
    ).toEqual(["driveway", "front-path", "driveway"]);
    expect(field.meshes).toHaveLength(2);
    expect(
      field.meshes.reduce((total, mesh) => total + mesh.count, 0),
    ).toBe(3);
  });

  it("uses independent batches for driveways and front paths", () => {
    const field = createPropertyAccessSurfaceField(specs);
    const counts = field.meshes.map((mesh) => mesh.count).sort((a, b) => a - b);

    expect(counts).toEqual([1, 2]);
  });
});
