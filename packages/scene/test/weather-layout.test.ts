import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { sceneCameraComposition } from "../src/storyboard.js";
import { WEATHER_BACKDROP_LAYOUT } from "../src/weather-layout.js";

const projectedBackdrop = (
  width: number,
  height: number,
  position: readonly [number, number, number],
): Vector3 => {
  const composition = sceneCameraComposition(width, height, "forecast");
  const camera = new PerspectiveCamera(
    composition.fov,
    width / height,
    0.1,
    180,
  );
  camera.position.set(...composition.position);
  camera.lookAt(...composition.lookAt);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return new Vector3(...position).project(camera);
};

describe("weather backdrop staging", () => {
  it("places all weather behind the distant hill band", () => {
    for (const layout of Object.values(WEATHER_BACKDROP_LAYOUT)) {
      expect(layout.position[2]).toBeLessThan(-90);
      expect(layout.scale).toBeGreaterThanOrEqual(10);
    }
  });

  it("keeps backdrop centers inside portrait and landscape forecast framing", () => {
    for (const [width, height] of [
      [360, 740],
      [844, 390],
    ] as const) {
      for (const layout of Object.values(WEATHER_BACKDROP_LAYOUT)) {
        const projected = projectedBackdrop(width, height, layout.position);
        expect(Math.abs(projected.x)).toBeLessThanOrEqual(1);
        expect(projected.y).toBeGreaterThanOrEqual(-1);
        expect(projected.y).toBeLessThanOrEqual(1);
        expect(projected.z).toBeLessThanOrEqual(1);
      }
    }
  });
});
