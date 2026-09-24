import { Group, Scene } from "three";
import { describe, expect, it } from "vitest";

import { updateNeighborhoodWind } from "../src/neighborhood.js";

const windObject = (phase: number): Group => {
  const object = new Group();
  object.userData["windResponsive"] = true;
  object.userData["windPhase"] = phase;
  object.userData["windBaseRotationX"] = 0;
  object.userData["windBaseRotationZ"] = 0;
  return object;
};

describe("neighborhood wind registry", () => {
  it("animates cached wind objects and refreshes when top-level scene membership changes", () => {
    const scene = new Scene();
    const first = windObject(0.4);
    scene.add(first);

    updateNeighborhoodWind(scene, 1.25, "thunderstorm");
    expect(Math.abs(first.rotation.z)).toBeGreaterThan(0);

    const second = windObject(1.1);
    scene.add(second);
    updateNeighborhoodWind(scene, 1.75, "thunderstorm");

    expect(Math.abs(second.rotation.z)).toBeGreaterThan(0);
  });

  it("ignores ordinary scene objects", () => {
    const scene = new Scene();
    const ordinary = new Group();
    ordinary.rotation.z = 0.25;
    scene.add(ordinary);

    updateNeighborhoodWind(scene, 2, "thunderstorm");

    expect(ordinary.rotation.z).toBe(0.25);
  });
});
