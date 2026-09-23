import { type Object3D, Scene } from "three";
import { describe, expect, it } from "vitest";

import { createAmbientLife } from "../src/ambient-life.js";

const sceneRoleOf = (object: Object3D): string | null => {
  const role: unknown = object.userData["sceneRole"];
  return typeof role === "string" ? role : null;
};

const mobilityActorIdOf = (object: Object3D): string | null => {
  const actorId: unknown = object.userData["mobilityActorId"];
  return typeof actorId === "string" ? actorId : null;
};

const vehicleVariantOf = (object: Object3D): string | null => {
  const variant: unknown = object.userData["vehicleVariant"];
  return typeof variant === "string" ? variant : null;
};

describe("ambient vehicle visual identity", () => {
  it("keeps one visual profile bound to each logical vehicle across traversal and LOD changes", () => {
    const scene = new Scene();
    const ambient = createAmbientLife(scene, 0x5eed1234, []);
    const firstVisualByActor = new Map<
      string,
      Readonly<{ uuid: string; variant: string }>
    >();
    const repeatedActors = new Set<string>();

    const samples = [
      { elapsedMs: 1_500, focus: { x: -48, z: 0 } },
      { elapsedMs: 3_500, focus: { x: 0, z: 0 } },
      { elapsedMs: 5_500, focus: { x: 48, z: 0 } },
      { elapsedMs: 7_500, focus: { x: -24, z: 0 } },
      { elapsedMs: 9_500, focus: { x: 24, z: 0 } },
      { elapsedMs: 11_500, focus: { x: 0, z: 0 } },
      { elapsedMs: 13_500, focus: { x: -48, z: 0 } },
    ] as const;

    for (const sample of samples) {
      ambient.update(
        "sunny",
        "simulation",
        sample.elapsedMs,
        14_000,
        3,
        sample.focus,
      );

      const visibleVehicles = scene.children.filter(
        (object) =>
          object.visible && sceneRoleOf(object) === "ambient-vehicle",
      );
      expect(visibleVehicles.length).toBeLessThanOrEqual(8);

      for (const vehicle of visibleVehicles) {
        const actorId = mobilityActorIdOf(vehicle);
        const variant = vehicleVariantOf(vehicle);
        expect(actorId).not.toBeNull();
        expect(variant).not.toBeNull();
        if (actorId === null || variant === null) continue;

        const first = firstVisualByActor.get(actorId);
        if (first === undefined) {
          firstVisualByActor.set(
            actorId,
            Object.freeze({ uuid: vehicle.uuid, variant }),
          );
          continue;
        }

        repeatedActors.add(actorId);
        expect(vehicle.uuid).toBe(first.uuid);
        expect(variant).toBe(first.variant);
      }
    }

    expect(firstVisualByActor.size).toBeGreaterThan(8);
    expect(repeatedActors.size).toBeGreaterThan(0);
  });
});
