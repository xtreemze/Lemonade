import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import type {
  NeighborhoodRoadSegment,
  NeighborhoodSidewalkSegment,
} from "@lemonade/scene/neighborhood-topology";
import { describe, expect, it } from "vitest";

import { createBabylonStreetSurfaceField } from "../src/babylon-street-surface-field.js";

const point = (x: number, z: number): Readonly<{ x: number; z: number }> =>
  Object.freeze({ x, z });

const road = (
  streetId: string,
  segmentIndex: number,
  x: number,
): NeighborhoodRoadSegment =>
  Object.freeze({
    id: `road:${streetId}:${String(segmentIndex)}`,
    streetId,
    segmentIndex,
    center: point(x, 5),
    start: point(x - 4, 5),
    end: point(x + 4, 5),
    length: 8,
    width: 6,
    rotationY: 0.2,
  });

const sidewalk = (
  streetId: string,
  segmentIndex: number,
  x: number,
): NeighborhoodSidewalkSegment =>
  Object.freeze({
    id: `sidewalk:${streetId}:${String(segmentIndex)}`,
    streetId,
    segmentIndex,
    parentRoadId: `road:${streetId}:0`,
    side: -1,
    center: point(x, 5),
    start: point(x - 4, 5),
    end: point(x + 4, 5),
    length: 8,
    width: 1.6,
    rotationY: 0.2,
  });

describe("Babylon street surface projection", () => {
  it("keeps semantic anchors while sharing one source mesh per surface role", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const field = createBabylonStreetSurfaceField(
      scene,
      [road("main", 0, 0), road("cross", 1, 10)],
      [sidewalk("main", 0, 0)],
    );

    expect(field.anchors).toHaveLength(3);
    expect(field.batches).toHaveLength(3);
    expect(field.batches.reduce((total, batch) => total + 1 + batch.instances.length, 0)).toBe(3);

    scene.dispose();
    engine.dispose();
  });

  it("projects deterministic topology transforms into Babylon nodes", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const field = createBabylonStreetSurfaceField(scene, [road("main", 0, 12)], []);

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
