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
  it("keeps ordinary weather distant while staging thunderclouds in front of hills", () => {
    for (const kind of ["sunny", "cloudy", "hot-and-dry"] as const) {
      const layout = WEATHER_BACKDROP_LAYOUT[kind];
      expect(layout.position[2]).toBeLessThan(-90);
      expect(layout.scale).toBeGreaterThanOrEqual(10);
    }

    const storm = WEATHER_BACKDROP_LAYOUT.thunderstorm;
    expect(storm.position[2]).toBeGreaterThan(-76);
    expect(storm.position[2]).toBeLessThan(-30);
    expect(storm.scale).toBeGreaterThanOrEqual(7);
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
