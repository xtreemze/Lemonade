import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import type { NeighborhoodPropertyTopology } from "@lemonade/scene/neighborhood-topology";
import { describe, expect, it } from "vitest";

import { createBabylonPropertyAccessField } from "../src/babylon-property-access-field.js";

const point = (x: number, z: number): Readonly<{ x: number; z: number }> =>
  Object.freeze({ x, z });

const property = (
  role: string,
  offset: number,
  withDriveway: boolean,
): NeighborhoodPropertyTopology =>
  Object.freeze({
    id: `property:${role}`,
    role,
    group: "front",
    house: Object.freeze({
      center: point(offset, -8),
      scale: 1,
      rotationY: 0,
    }),
    frontDirection: 1,
    door: point(offset, -5),
    entry: point(offset, -4.5),
    path: Object.freeze({
      center: point(offset + 1, -3),
      length: 4,
      width: 1.1,
      rotationY: 0.2,
      sidewalkEdge: point(offset + 1.4, -1.1),
      sidewalkSegmentId: "sidewalk:main:0",
      sidewalkSegmentGap: 0,
    }),
    driveway: withDriveway
      ? Object.freeze({
          center: point(offset + 3, -2.5),
          length: 5.5,
          width: 2.7,
          rotationY: -0.3,
          parking: point(offset + 3, -4),
          roadEdge: point(offset + 3, 0),
          roadSegmentId: "road:main:0",
          roadSegmentGap: 0,
        })
      : null,
  });

describe("Babylon property access projection", () => {
  it("shares access geometry while keeping one semantic anchor per projected surface", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const field = createBabylonPropertyAccessField(scene, [
      property("featured", 0, true),
      property("neighbor", 10, false),
    ]);

    expect(field.anchors).toHaveLength(3);
    expect(field.batches).toHaveLength(2);

    const paths = field.batches.find((batch) => batch.role === "front-path");
    expect(paths).toBeDefined();
    expect(1 + (paths?.instances.length ?? 0)).toBe(2);

    const driveways = field.batches.find((batch) => batch.role === "driveway");
    expect(driveways).toBeDefined();
    expect(1 + (driveways?.instances.length ?? 0)).toBe(1);

    scene.dispose();
    engine.dispose();
  });

  it("preserves topology dimensions, orientation, and connectivity metadata", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const field = createBabylonPropertyAccessField(scene, [property("featured", 0, true)]);

    const path = field.batches.find((batch) => batch.role === "front-path");
    expect(path?.source.position.x).toBeCloseTo(1);
    expect(path?.source.position.z).toBeCloseTo(-3);
    expect(path?.source.scaling.x).toBeCloseTo(4);
    expect(path?.source.scaling.z).toBeCloseTo(1.1);
    expect(path?.source.rotation.y).toBeCloseTo(-0.2);

    const driveway = field.batches.find((batch) => batch.role === "driveway");
    expect(driveway?.source.scaling.x).toBeCloseTo(5.5);
    expect(driveway?.source.scaling.z).toBeCloseTo(2.7);
    expect(driveway?.source.rotation.y).toBeCloseTo(0.3);

    const drivewayAnchor = field.anchors.find(
      (anchor) => anchor.metadata?.["sceneRole"] === "driveway",
    );
    expect(drivewayAnchor?.metadata?.["propertyId"]).toBe("property:featured");
    expect(drivewayAnchor?.metadata?.["connectedSegmentId"]).toBe("road:main:0");

    scene.dispose();
    engine.dispose();
  });
});
