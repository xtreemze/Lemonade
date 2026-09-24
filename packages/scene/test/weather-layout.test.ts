import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { sceneCameraComposition } from "../src/storyboard.js";
import {
  businessDayFrameAt,
  businessDayProgressAt,
  lightningFlashAt,
  sunVisualPositionAt,
} from "../src/weather-detail.js";
import {
  CLOUDY_TOWN_CLOUD_LAYOUT,
  HOT_DRY_CLOUD_LAYOUT,
  THUNDERSTORM_TOWN_CLOUD_LAYOUT,
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
      ...THUNDERSTORM_TOWN_CLOUD_LAYOUT.map((cloud) => storm.scale * cloud.scale),
    ];
    const cloudDepths = [
      hotAndDry.position[2] +
        HOT_DRY_CLOUD_LAYOUT.position[2] * hotAndDry.scale,
      ...CLOUDY_TOWN_CLOUD_LAYOUT.map(
        (cloud) => cloudy.position[2] + cloud.position[2] * cloudy.scale,
      ),
      ...THUNDERSTORM_TOWN_CLOUD_LAYOUT.map(
        (cloud) => storm.position[2] + cloud.position[2] * storm.scale,
      ),
    ];
    const cloudHeights = [
      hotAndDry.position[1] +
        HOT_DRY_CLOUD_LAYOUT.position[1] * hotAndDry.scale,
      ...CLOUDY_TOWN_CLOUD_LAYOUT.map(
        (cloud) => cloudy.position[1] + cloud.position[1] * cloudy.scale,
      ),
      ...THUNDERSTORM_TOWN_CLOUD_LAYOUT.map(
        (cloud) => storm.position[1] + cloud.position[1] * storm.scale,
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
    expect(
      new Set(THUNDERSTORM_TOWN_CLOUD_LAYOUT.map((cloud) => cloud.driftPhase)).size,
    ).toBe(THUNDERSTORM_TOWN_CLOUD_LAYOUT.length);

    for (const layout of [
      CLOUDY_TOWN_CLOUD_LAYOUT,
      THUNDERSTORM_TOWN_CLOUD_LAYOUT,
    ] as const) {
      const sortedX = layout.map((cloud) => cloud.position[0]).sort((a, b) => a - b);
      expect(Math.max(...sortedX) - Math.min(...sortedX)).toBeGreaterThanOrEqual(12);
      const adjacentGaps = sortedX.slice(1).map(
        (value, index) => value - (sortedX[index] ?? value),
      );
      for (const gap of adjacentGaps) {
        expect(gap).toBeGreaterThanOrEqual(2.7);
      }
    }
  });

  it("moves the visible sunny-day sun across the horizon behind the hills", () => {
    const sunny = WEATHER_BACKDROP_LAYOUT.sunny;
    const dawn = sunVisualPositionAt(0.04);
    const noon = sunVisualPositionAt(0.5);
    const dusk = sunVisualPositionAt(0.96);
    const toWorld = (position: readonly [number, number, number]) =>
      [
        sunny.position[0] + position[0] * sunny.scale,
        sunny.position[1] + position[1] * sunny.scale,
        sunny.position[2] + position[2] * sunny.scale,
      ] as const;

    const dawnWorld = toWorld(dawn);
    const noonWorld = toWorld(noon);
    const duskWorld = toWorld(dusk);
    expect(dawnWorld[0]).toBeLessThan(noonWorld[0]);
    expect(noonWorld[0]).toBeLessThan(duskWorld[0]);
    expect(noonWorld[1]).toBeGreaterThan(dawnWorld[1]);
    expect(noonWorld[1]).toBeGreaterThan(duskWorld[1]);
    expect(dawnWorld[2]).toBeLessThan(-120);
    expect(noonWorld[2]).toBeLessThan(-120);
    expect(duskWorld[2]).toBeLessThan(-120);
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
