import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { sceneCameraComposition } from "../src/storyboard.js";
import {
  businessDayFrameAt,
  businessDayProgressAt,
  lightningFlashAt,
} from "../src/weather-detail.js";
import {
  CLOUDY_TOWN_CLOUD_LAYOUT,
  WEATHER_BACKDROP_LAYOUT,
} from "../src/weather-layout.js";

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
  it("keeps ordinary weather behind the hills but brings storms forward", () => {
    for (const kind of ["sunny", "cloudy", "hot-and-dry"] as const) {
      const layout = WEATHER_BACKDROP_LAYOUT[kind];
      expect(layout.position[2]).toBeLessThan(-90);
      expect(layout.scale).toBeGreaterThanOrEqual(10);
    }

    const storm = WEATHER_BACKDROP_LAYOUT.thunderstorm;
    expect(storm.position[2]).toBeGreaterThan(-76);
    expect(storm.position[2]).toBeLessThan(-45);
    expect(storm.scale).toBeGreaterThan(6);
  });

  it("adds multiple local cloudy-day layers above the town", () => {
    expect(CLOUDY_TOWN_CLOUD_LAYOUT.length).toBeGreaterThanOrEqual(3);
    const cloudy = WEATHER_BACKDROP_LAYOUT.cloudy;
    for (const cloud of CLOUDY_TOWN_CLOUD_LAYOUT) {
      const worldY = cloudy.position[1] + cloud.position[1] * cloudy.scale;
      const worldZ = cloudy.position[2] + cloud.position[2] * cloudy.scale;
      expect(worldY).toBeGreaterThan(9);
      expect(worldZ).toBeGreaterThan(-70);
      expect(worldZ).toBeLessThan(-25);
      expect(cloud.scale).toBeLessThan(0.4);
    }
    expect(new Set(CLOUDY_TOWN_CLOUD_LAYOUT.map((cloud) => cloud.driftPhase)).size)
      .toBe(CLOUDY_TOWN_CLOUD_LAYOUT.length);
  });

  it("moves the business simulation from dawn through daylight into night", () => {
    const duration = 10_000;
    const dawn = businessDayFrameAt("sunny", "simulation", 0, duration);
    const noon = businessDayFrameAt("sunny", "simulation", 5_000, duration);
    const night = businessDayFrameAt("sunny", "simulation", duration, duration);

    expect(businessDayProgressAt("simulation", 0, duration))
      .toBeLessThan(businessDayProgressAt("simulation", 5_000, duration));
    expect(businessDayProgressAt("simulation", 5_000, duration))
      .toBeLessThan(businessDayProgressAt("simulation", duration, duration));
    expect(noon.sunlightIntensity).toBeGreaterThan(dawn.sunlightIntensity);
    expect(noon.sunlightIntensity).toBeGreaterThan(night.sunlightIntensity);
    expect(dawn.skyColor).not.toBe(noon.skyColor);
    expect(night.skyColor).not.toBe(noon.skyColor);
    expect(dawn.sunPosition[0]).toBeLessThan(night.sunPosition[0]);
  });

  it("flashes lightning in deterministic short pulses instead of leaving a static bolt", () => {
    const duration = 10_000;
    expect(lightningFlashAt(2_000, duration)).toBeGreaterThan(0.9);
    expect(lightningFlashAt(3_500, duration)).toBe(0);
    expect(lightningFlashAt(5_700, duration)).toBeGreaterThan(0.9);
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
        const screenY = (1 - projected.y) / 2;
        expect(screenY).toBeGreaterThanOrEqual(0.08);
        expect(screenY).toBeLessThanOrEqual(0.43);
      }
    }
  });
});
