import { type Object3D, Scene } from "three";
import { describe, expect, it } from "vitest";

import { createAmbientLife } from "../src/ambient-life.js";

const DYNAMIC_ROLES = new Set([
  "ambient-bicycle",
  "ambient-bird",
  "ambient-gardener",
  "ambient-mail-carrier",
  "ambient-pet",
  "ambient-resident",
  "ambient-vehicle",
]);

const roleOf = (object: Object3D): string | null => {
  const role: unknown = object.userData.sceneRole;
  return typeof role === "string" ? role : null;
};

const visibleByRole = (scene: Scene, role: string): number =>
  scene.children.filter(
    (object) => object.visible && roleOf(object) === role,
  ).length;

const exerciseDay = (
  scene: Scene,
  ambient: ReturnType<typeof createAmbientLife>,
  dayNumber: number,
): void => {
  const weather =
    dayNumber % 4 === 0
      ? "thunderstorm"
      : dayNumber % 3 === 0
        ? "cloudy"
        : dayNumber % 2 === 0
          ? "hot-and-dry"
          : "sunny";

  const focuses = [
    { x: -110, z: 0 },
    { x: -55, z: 0 },
    { x: 0, z: 0 },
    { x: 55, z: 0 },
    { x: 110, z: 0 },
  ] as const;

  for (let elapsedMs = 0; elapsedMs <= 14_000; elapsedMs += 1_000) {
    for (const focus of focuses) {
      ambient.update(
        weather,
        "simulation",
        elapsedMs,
        14_000,
        dayNumber,
        focus,
      );

      expect(visibleByRole(scene, "ambient-vehicle")).toBeLessThanOrEqual(8);
      expect(visibleByRole(scene, "ambient-bicycle")).toBeLessThanOrEqual(3);
      expect(visibleByRole(scene, "ambient-bird")).toBeLessThanOrEqual(4);
      expect(visibleByRole(scene, "ambient-resident")).toBeLessThanOrEqual(4);
    }
  }
};

describe("long-session ambient actor lifecycle certification", () => {
  it("reaches a stable renderer-object plateau across repeated days", () => {
    const scene = new Scene();
    const ambient = createAmbientLife(scene, 0x5eed_1234, []);

    for (let day = 1; day <= 7; day += 1) {
      exerciseDay(scene, ambient, day);
    }
    const plateauChildCount = scene.children.length;

    for (let day = 8; day <= 35; day += 1) {
      exerciseDay(scene, ambient, day);
      expect(scene.children.length).toBe(plateauChildCount);
    }
  });

  it("reclaims all ambient actor visibility when the scene becomes idle", () => {
    const scene = new Scene();
    const ambient = createAmbientLife(scene, 0x1ead_2026, []);

    exerciseDay(scene, ambient, 3);
    ambient.update("sunny", "idle", 0, 14_000, 3, { x: 0, z: 0 });

    const staleVisibleActors = scene.children.filter(
      (object) => object.visible && DYNAMIC_ROLES.has(roleOf(object) ?? ""),
    );
    expect(staleVisibleActors).toHaveLength(0);
  });
});
