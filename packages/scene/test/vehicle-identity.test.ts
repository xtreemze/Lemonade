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

describe("ambient transport visual identity", () => {
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

  it("keeps one visual object bound to each logical bicycle across LOD changes", () => {
    const scene = new Scene();
    const ambient = createAmbientLife(scene, 0x5eed1234, []);
    const visualByActor = new Map<string, string>();
    const actorByVisual = new Map<string, string>();
    const elapsedSamples = [1_000, 3_000, 5_000, 7_000, 9_000, 11_000, 13_000] as const;
    const focusSamples = [
      { x: 0, z: 0 },
      { x: 110, z: 0 },
      { x: -110, z: 0 },
      { x: 0, z: 90 },
      { x: 0, z: -90 },
    ] as const;

    for (const elapsedMs of elapsedSamples) {
      for (const focus of focusSamples) {
        ambient.update(
          "sunny",
          "simulation",
          elapsedMs,
          14_000,
          3,
          focus,
        );

        const visibleBicycles = scene.children.filter(
          (object) =>
            object.visible && sceneRoleOf(object) === "ambient-bicycle",
        );
        expect(visibleBicycles.length).toBeLessThanOrEqual(3);

        for (const bicycle of visibleBicycles) {
          const actorId = mobilityActorIdOf(bicycle);
          expect(actorId).not.toBeNull();
          if (actorId === null) continue;

          const knownVisual = visualByActor.get(actorId);
          if (knownVisual === undefined) {
            visualByActor.set(actorId, bicycle.uuid);
          } else {
            expect(bicycle.uuid).toBe(knownVisual);
          }

          const knownActor = actorByVisual.get(bicycle.uuid);
          if (knownActor === undefined) {
            actorByVisual.set(bicycle.uuid, actorId);
          } else {
            expect(actorId).toBe(knownActor);
          }
        }
      }
    }

    expect(visualByActor.size).toBeGreaterThan(1);
  });

});
