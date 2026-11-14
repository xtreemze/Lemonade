import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import type { NeighborhoodPropertyTopology } from "@lemonade/scene/neighborhood-topology";
import { describe, expect, it } from "vitest";

import { createBabylonResidentialHouseField } from "../src/babylon-residential-house-field.js";

const point = (x: number, z: number): Readonly<{ x: number; z: number }> =>
  Object.freeze({ x, z });

const property = (
  role: string,
  x: number,
  color: number,
  scale: number,
  rotationY: number,
): NeighborhoodPropertyTopology =>
  Object.freeze({
    id: `property:${role}`,
    role,
    group: "front",
    house: Object.freeze({
      center: point(x, -8),
      color,
      scale,
      rotationY,
    }),
    frontDirection: 1,
    door: point(x, -5),
    entry: point(x, -4.5),
    path: Object.freeze({
      center: point(x, -3),
      length: 4,
      width: 1.1,
      rotationY: 0,
      sidewalkEdge: point(x, -1.1),
      sidewalkSegmentId: "sidewalk:main:0",
      sidewalkSegmentGap: 0,
    }),
    driveway: null,
  });

const batchSize = (
  field: ReturnType<typeof createBabylonResidentialHouseField>,
  role: "house-body" | "house-foundation" | "house-roof",
): number =>
  field.batches
    .filter((batch) => batch.role === role)
    .reduce((count, batch) => count + 1 + batch.instances.length, 0);

describe("Babylon residential house projection", () => {
  it("instances repeated house massing while preserving one semantic anchor per property", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const field = createBabylonResidentialHouseField(scene, [
      property("featured", 0, 0xc9_7d_65, 1, 0),
      property("neighbor", 10, 0xc9_7d_65, 0.94, 0.08),
      property("east", 20, 0xd5_6f_52, 1.05, -0.12),
    ]);

    expect(field.anchors).toHaveLength(3);
    expect(field.batches.filter((batch) => batch.role === "house-body")).toHaveLength(2);
    expect(batchSize(field, "house-body")).toBe(3);
    expect(batchSize(field, "house-foundation")).toBe(3);
    expect(batchSize(field, "house-roof")).toBe(3);

    const featured = field.anchors.find(
      (anchor) => anchor.metadata?.["propertyRole"] === "featured",
    );
    expect(featured?.metadata?.["propertyId"]).toBe("property:featured");
    expect(featured?.metadata?.["sceneRole"]).toBe("residential-house");

    scene.dispose();
    engine.dispose();
  });

  it("preserves topology position, scale, rotation, palette and pickable body identity", () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const color = 0x8d_a9_a1;
    const field = createBabylonResidentialHouseField(scene, [
      property("featured", 6, color, 1.2, 0.25),
    ]);

    const body = field.batches.find((batch) => batch.role === "house-body");
    expect(body?.source.position.x).toBeCloseTo(6);
    expect(body?.source.position.y).toBeCloseTo(1.7 * 1.2);
    expect(body?.source.position.z).toBeCloseTo(-8);
    expect(body?.source.scaling.x).toBeCloseTo(1.2);
    expect(body?.source.rotation.y).toBeCloseTo(-0.25);
    expect(body?.source.isPickable).toBe(true);
    expect(body?.source.metadata?.["propertyId"]).toBe("property:featured");
    expect(body?.source.metadata?.["houseColor"]).toBe(color);

    const roof = field.batches.find((batch) => batch.role === "house-roof");
    expect(roof?.source.position.y).toBeCloseTo(4.45 * 1.2);
    expect(roof?.source.rotation.y).toBeCloseTo(Math.PI / 4 - 0.25);
    expect(roof?.source.isPickable).toBe(false);

    scene.dispose();
    engine.dispose();
  });
});
