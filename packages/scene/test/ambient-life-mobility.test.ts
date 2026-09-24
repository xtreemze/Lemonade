import { Scene } from "three";
import { describe, expect, it } from "vitest";

import { createAmbientLife } from "../src/ambient-life.js";
import { populateNeighborhood } from "../src/neighborhood.js";

const SEED = 0x5e_ed_12_34;

describe("ambient neighborhood mobility projection", () => {
  it("projects sunny forecast sprinklers into the rendered neighborhood", () => {
    const scene = new Scene();
    populateNeighborhood(scene, SEED);
    const ambient = createAmbientLife(scene, SEED);

    const sample = ambient.update("sunny", "forecast", 2500, 6000, 3, { x: 0, z: 0 });
    const active = sample.properties.find((property) => property.sprinklerOn);
    expect(active).toBeDefined();

    let visibleSprinkler = false;
    scene.traverse((object) => {
      if (
        object.userData["sceneRole"] === "yard-sprinkler" &&
        object.userData["propertyRole"] === active?.propertyRole &&
        object.visible
      ) {
        visibleSprinkler = true;
      }
    });
    expect(visibleSprinkler).toBe(true);
  });

  it("projects residence door activity while residents enter and leave", () => {
    const scene = new Scene();
    populateNeighborhood(scene, SEED);
    const ambient = createAmbientLife(scene, SEED);

    let observedOpenDoor = false;
    for (let index = 0; index < 28; index += 1) {
      const sample = ambient.update("cloudy", "simulation", index * 500, 14_000, 4, { x: 0, z: 0 });
      if (!sample.properties.some((property) => property.doorOpen)) {
        continue;
      }

      scene.traverse((object) => {
        if (object.userData["sceneRole"] === "house-door" && Math.abs(object.rotation.y) > 0.5) {
          observedOpenDoor = true;
        }
      });
    }

    expect(observedOpenDoor).toBe(true);
  });
});
