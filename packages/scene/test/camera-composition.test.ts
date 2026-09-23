import { describe, expect, it } from "vitest";

import {
  SIMULATION_CAMERA_ZOOM,
  sceneCameraComposition,
} from "../src/storyboard.js";

const projectionScale = (fovDegrees: number): number =>
  1 / Math.tan((fovDegrees * Math.PI) / 360);

describe("simulation camera composition", () => {
  it("applies an exact 20% optical zoom to the active simulation shot only", () => {
    const profiles = [
      { width: 360, height: 740, standFov: 58, forecastFov: 60, remainingFov: 46 },
      { width: 844, height: 390, standFov: 42, forecastFov: 45, remainingFov: 33 },
      { width: 1024, height: 768, standFov: 49, forecastFov: 52, remainingFov: 36 },
      { width: 1440, height: 900, standFov: 47, forecastFov: 50, remainingFov: 34 },
    ] as const;

    expect(SIMULATION_CAMERA_ZOOM).toBe(1.2);

    for (const profile of profiles) {
      const stand = sceneCameraComposition(profile.width, profile.height, "stand");
      const forecast = sceneCameraComposition(profile.width, profile.height, "forecast");
      const remaining = sceneCameraComposition(profile.width, profile.height, "remaining");

      expect(projectionScale(stand.fov) / projectionScale(profile.standFov)).toBeCloseTo(
        SIMULATION_CAMERA_ZOOM,
        10,
      );
      expect(forecast.fov).toBe(profile.forecastFov);
      expect(remaining.fov).toBe(profile.remainingFov);
    }
  });
});
