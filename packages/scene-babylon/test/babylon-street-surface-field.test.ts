import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import type { StreetStripSpec } from "@lemonade/scene/street-layout";
import { describe, expect, it } from "vitest";

import { createBabylonStreetSurfaceField } from "../src/babylon-street-surface-field.js";

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

describe("Babylon street surface projection", () => {
  it("keeps semantic anchors while sharing one source mesh per surface role", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const field = createBabylonStreetSurfaceField(
      scene,
      [strip("paved-road", "main", 0, 0), strip("paved-road", "cross", 1, 10)],
      [strip("sidewalk", "main", 0, 0)],
    );

    expect(field.anchors).toHaveLength(3);
    expect(field.batches).toHaveLength(3);
    expect(field.batches.reduce((total, batch) => total + 1 + batch.instances.length, 0)).toBe(3);

    scene.dispose();
    engine.dispose();
  });

  it("projects deterministic strip transforms into Babylon nodes", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const field = createBabylonStreetSurfaceField(scene, [strip("paved-road", "main", 0, 12)], []);

    const main = field.batches.find((batch) => batch.role === "main-road");
    expect(main).toBeDefined();
    expect(main?.source.position.x).toBeCloseTo(12);
    expect(main?.source.position.z).toBeCloseTo(5);
    expect(main?.source.scaling.x).toBeCloseTo(8);
    expect(main?.source.scaling.z).toBeCloseTo(6);
    expect(main?.source.rotation.y).toBeCloseTo(-0.2);

    scene.dispose();
    engine.dispose();
  });
});
