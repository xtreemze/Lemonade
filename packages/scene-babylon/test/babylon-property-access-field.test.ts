import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";

import { propertyAccessSurfaceSpecs } from "@lemonade/scene-contracts/property-access-layout";
import { createBabylonPropertyAccessField } from "../src/babylon-property-access-field.js";

describe("Babylon property access projection", () => {
  it("projects deterministic driveways and front paths through shared source meshes", () => {
    const specs = propertyAccessSurfaceSpecs(0x4c_45_4d_4f);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const field = createBabylonPropertyAccessField(scene, specs);

    expect(specs.length).toBeGreaterThan(0);
    expect(field.anchors).toHaveLength(specs.length);
    expect(field.batches.map((batch) => batch.role).sort()).toEqual([
      "driveway",
      "front-path",
    ]);
    expect(
      field.batches.reduce(
        (total, batch) => total + 1 + batch.instances.length,
        0,
      ),
    ).toBe(specs.length);

    scene.dispose();
    engine.dispose();
  });

  it("preserves generated position, rotation and dimensions", () => {
    const specs = propertyAccessSurfaceSpecs(0x4c_45_4d_4f);
    const driveway = specs.find((spec) => spec.role === "driveway");
    expect(driveway).toBeDefined();
    if (driveway === undefined) return;

    const engine = new NullEngine();
    const scene = new Scene(engine);
    const field = createBabylonPropertyAccessField(scene, [driveway]);
    const batch = field.batches[0];

    expect(batch?.source.position.x).toBeCloseTo(driveway.x);
    expect(batch?.source.position.z).toBeCloseTo(driveway.z);
    expect(batch?.source.rotation.y).toBeCloseTo(-driveway.rotationY);
    expect(batch?.source.scaling.x).toBeCloseTo(driveway.length);
    expect(batch?.source.scaling.z).toBeCloseTo(driveway.width);

    scene.dispose();
    engine.dispose();
  });
});
