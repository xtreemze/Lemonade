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
  HOT_DRY_CLOUD_LAYOUT,
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
  it("stages cloud-bearing weather just behind the kiosk house", () => {
    const sunny = WEATHER_BACKDROP_LAYOUT.sunny;
    const hotAndDry = WEATHER_BACKDROP_LAYOUT["hot-and-dry"];
    expect(sunny.position[2]).toBeLessThan(-90);
    expect(hotAndDry.position[2]).toBeLessThan(-90);

    for (const kind of ["cloudy", "thunderstorm"] as const) {
      const layout = WEATHER_BACKDROP_LAYOUT[kind];
      expect(layout.position[1]).toBeGreaterThanOrEqual(14);
      expect(layout.position[2]).toBeGreaterThan(-24);
      expect(layout.position[2]).toBeLessThan(-12);
      expect(layout.scale).toBeGreaterThanOrEqual(3);
      expect(layout.scale).toBeLessThanOrEqual(3.4);
    }
  });

  it("uses depth instead of large scale changes across visible clouds", () => {
    const cloudy = WEATHER_BACKDROP_LAYOUT.cloudy;
    const hotAndDry = WEATHER_BACKDROP_LAYOUT["hot-and-dry"];
    const storm = WEATHER_BACKDROP_LAYOUT.thunderstorm;
    const cloudScales = [
      cloudy.scale,
      storm.scale,
      hotAndDry.scale * HOT_DRY_CLOUD_LAYOUT.scale,
      ...CLOUDY_TOWN_CLOUD_LAYOUT.map((cloud) => cloudy.scale * cloud.scale),
    ];
    const cloudDepths = [
      cloudy.position[2],
      storm.position[2],
      hotAndDry.position[2] +
        HOT_DRY_CLOUD_LAYOUT.position[2] * hotAndDry.scale,
      ...CLOUDY_TOWN_CLOUD_LAYOUT.map(
        (cloud) => cloudy.position[2] + cloud.position[2] * cloudy.scale,
      ),
    ];
    const cloudHeights = [
      cloudy.position[1],
      storm.position[1],
      hotAndDry.position[1] +
        HOT_DRY_CLOUD_LAYOUT.position[1] * hotAndDry.scale,
      ...CLOUDY_TOWN_CLOUD_LAYOUT.map(
        (cloud) => cloudy.position[1] + cloud.position[1] * cloudy.scale,
      ),
    ];

    expect(CLOUDY_TOWN_CLOUD_LAYOUT.length).toBeGreaterThanOrEqual(6);
    for (const depth of cloudDepths) {
      expect(depth).toBeGreaterThan(-24);
      expect(depth).toBeLessThan(-12);
    }
    for (const height of cloudHeights) {
      expect(height).toBeGreaterThanOrEqual(14);
    }
    expect(Math.min(...cloudScales)).toBeGreaterThanOrEqual(2.8);
    expect(Math.max(...cloudScales)).toBeLessThanOrEqual(3.6);
    expect(Math.max(...cloudScales) - Math.min(...cloudScales)).toBeLessThan(0.6);
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
