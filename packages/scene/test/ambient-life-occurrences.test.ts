import { describe, expect, it } from "vitest";
import { Group, Mesh, MeshStandardMaterial, Scene } from "three";

import { createAmbientLife } from "../src/ambient-life.js";
import type { SceneNeighborhoodOccurrence } from "../src/neighborhood-occurrences.js";
import { populateNeighborhood } from "../src/neighborhood.js";
import { generateResidentialLayout } from "../src/residential-layout.js";

const SEED = 0x5eed_1234;

const event = (
  overrides: Partial<SceneNeighborhoodOccurrence>,
): SceneNeighborhoodOccurrence =>
  Object.freeze({
    id: "event",
    kind: "window-activity",
    actorKind: "household",
    actorId: "household:0",
    household: 0,
    startMinute: 900,
    endMinute: 930,
    anchors: Object.freeze([
      Object.freeze({ role: "residence" as const, household: 0 }),
    ]),
    visualSeed: 1,
    motion: "stationary" as const,
    economicEffect: "none" as const,
    ...overrides,
  });

describe("ambient occurrence rendering", () => {
  it("renders occurrence-backed sprinklers during the morning forecast", () => {
    const scene = new Scene();
    populateNeighborhood(scene, SEED);
    const layout = generateResidentialLayout(SEED);
    const property = layout.frontProperties[0];
    expect(property).toBeDefined();
    if (property === undefined) return;

    const household = 0;
    const occurrences = Object.freeze([
      event({
        id: "sprinkler:0",
        kind: "sprinkler",
        actorKind: "sprinkler",
        actorId: "sprinkler:0",
        household,
        startMinute: 450,
        endMinute: 480,
        anchors: Object.freeze([
          Object.freeze({ role: "front-yard" as const, household }),
        ]),
      }),
    ]);

    const ambient = createAmbientLife(scene, SEED, [], SEED);
    ambient.update(
      "sunny",
      "forecast",
      ((465 - 390) / 180) * 6_000,
      6_000,
      3,
      occurrences,
      { x: 0, z: 0 },
    );

    let visible = false;
    scene.traverse((object) => {
      if (
        object instanceof Group &&
        object.userData["sceneRole"] === "yard-sprinkler" &&
        object.userData["propertyRole"] === property.role &&
        object.visible
      ) {
        visible = true;
      }
    });
    expect(visible).toBe(true);
  });

  it("opens doors and lights windows when residents arrive home", () => {
    const scene = new Scene();
    populateNeighborhood(scene, SEED);
    const layout = generateResidentialLayout(SEED);
    const property = layout.frontProperties[0];
    expect(property).toBeDefined();
    if (property === undefined) return;

    const household = 0;
    const occurrences = Object.freeze([
      event({
        id: "resident:arrival",
        kind: "resident-arrival",
        actorKind: "resident",
        actorId: "resident:0",
        household,
        startMinute: 900,
        endMinute: 930,
        anchors: Object.freeze([
          Object.freeze({ role: "sidewalk" as const, household }),
          Object.freeze({ role: "front-path" as const, household }),
          Object.freeze({ role: "door" as const, household }),
        ]),
      }),
    ]);

    const ambient = createAmbientLife(scene, SEED, [], SEED);
    ambient.update(
      "cloudy",
      "simulation",
      ((927 - 570) / 510) * 10_000,
      10_000,
      4,
      occurrences,
      { x: 0, z: 0 },
    );

    let openDoor = false;
    let litWindow = false;
    scene.traverse((object) => {
      if (object.userData["propertyRole"] !== property.role) return;
      if (
        object instanceof Group &&
        object.userData["sceneRole"] === "house-door" &&
        Math.abs(object.rotation.y) > 0.5
      ) {
        openDoor = true;
      }
      if (
        object instanceof Mesh &&
        object.userData["sceneRole"] === "house-window"
      ) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        litWindow ||= materials.some(
          (material) =>
            material instanceof MeshStandardMaterial &&
            material.emissiveIntensity > 0,
        );
      }
    });

    expect(openDoor).toBe(true);
    expect(litWindow).toBe(true);
  });
});
