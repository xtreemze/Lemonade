import { Group, Scene } from "three";
import { describe, expect, it } from "vitest";

import {
  ambientPopulationFor,
  createAmbientLife,
} from "../src/ambient-life.js";

describe("scene editor ambient population overrides", () => {
  it("keeps production weather defaults unchanged without an override", () => {
    expect(ambientPopulationFor("sunny", "simulation")).toEqual({
      pets: 2,
      wildlife: 4,
      bicycles: 3,
      vehicles: 8,
    });
    expect(ambientPopulationFor("thunderstorm", "simulation")).toEqual({
      pets: 0,
      wildlife: 0,
      bicycles: 0,
      vehicles: 4,
    });
  });

  it("can suppress each ambient actor class without mutating normal scene rules", () => {
    const scene = new Scene();
    const owner = new Group();
    owner.visible = true;
    owner.position.set(0, 0, 1.2);
    owner.rotation.y = Math.PI / 2;
    scene.add(owner);

    const ambient = createAmbientLife(scene, 0x1ead2026, [owner]);
    ambient.update(
      "sunny",
      "simulation",
      2_000,
      10_000,
      1,
      undefined,
      { pets: 0, wildlife: 0, bicycles: 0, vehicles: 0 },
    );

    for (const role of [
      "ambient-pet",
      "ambient-bird",
      "ambient-bicycle",
      "ambient-vehicle",
    ] as const) {
      expect(
        scene.children.filter(
          (object) => object.userData["sceneRole"] === role && object.visible,
        ),
      ).toHaveLength(0);
    }

    expect(ambientPopulationFor("sunny", "simulation")).toEqual({
      pets: 2,
      wildlife: 4,
      bicycles: 3,
      vehicles: 8,
    });
  });

  it("clamps editor counts to the available actor pools", () => {
    const scene = new Scene();
    const owner = new Group();
    owner.visible = true;
    owner.position.set(0, 0, 1.2);
    owner.rotation.y = Math.PI / 2;
    scene.add(owner);

    const ambient = createAmbientLife(scene, 17, [owner]);
    ambient.update(
      "sunny",
      "simulation",
      2_000,
      10_000,
      1,
      undefined,
      { pets: 999, wildlife: 999, bicycles: 999, vehicles: 999 },
    );

    expect(
      scene.children.filter(
        (object) =>
          object.userData["sceneRole"] === "ambient-bird" && object.visible,
      ).length,
    ).toBeLessThanOrEqual(4);
    expect(
      scene.children.filter(
        (object) =>
          object.userData["sceneRole"] === "ambient-bicycle" && object.visible,
      ).length,
    ).toBeLessThanOrEqual(3);
    expect(
      scene.children.filter(
        (object) =>
          object.userData["sceneRole"] === "ambient-vehicle" && object.visible,
      ).length,
    ).toBeLessThanOrEqual(8);
  });
});
