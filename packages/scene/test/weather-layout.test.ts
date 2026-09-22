import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { sceneCameraComposition } from "../src/storyboard.js";
import {
  businessDayFrameAt,
  businessDayProgressAt,
  lightningFlashAt,
  sunBackdropPositionAt,
} from "../src/weather-detail.js";
import {
  CLOUDY_TOWN_CLOUD_LAYOUT,
  PARTLY_CLOUD_TOWN_LAYOUT,
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
    const cloudEntries = [
      ...PARTLY_CLOUD_TOWN_LAYOUT.map((cloud) => ({ parent: hotAndDry, cloud })),
      ...CLOUDY_TOWN_CLOUD_LAYOUT.map((cloud) => ({ parent: cloudy, cloud })),
      ...THUNDERSTORM_TOWN_CLOUD_LAYOUT.map((cloud) => ({ parent: storm, cloud })),
    ];
    const cloudScales = cloudEntries.map(({ parent, cloud }) => parent.scale * cloud.scale);
    const cloudDepths = cloudEntries.map(
      ({ parent, cloud }) => parent.position[2] + cloud.position[2] * parent.scale,
    );
    const cloudHeights = cloudEntries.map(
      ({ parent, cloud }) => parent.position[1] + cloud.position[1] * parent.scale,
    );

    expect(CLOUDY_TOWN_CLOUD_LAYOUT.length).toBeGreaterThanOrEqual(6);
    expect(THUNDERSTORM_TOWN_CLOUD_LAYOUT.length).toBeGreaterThanOrEqual(5);
    expect(PARTLY_CLOUD_TOWN_LAYOUT.length).toBeGreaterThanOrEqual(3);
    for (const depth of cloudDepths) {
      expect(depth).toBeGreaterThan(-24);
      expect(depth).toBeLessThan(-12);
    }
    for (const height of cloudHeights) {
      expect(height).toBeGreaterThanOrEqual(13.5);
    }
    expect(Math.min(...cloudScales)).toBeGreaterThanOrEqual(2.8);
    expect(Math.max(...cloudScales)).toBeLessThanOrEqual(3.6);
    expect(Math.max(...cloudScales) - Math.min(...cloudScales)).toBeLessThan(0.7);
  });

  it("distributes each cloud field across town width and depth instead of clumping", () => {
    for (const [kind, clouds] of [
      ["hot-and-dry", PARTLY_CLOUD_TOWN_LAYOUT],
      ["cloudy", CLOUDY_TOWN_CLOUD_LAYOUT],
      ["thunderstorm", THUNDERSTORM_TOWN_CLOUD_LAYOUT],
    ] as const) {
      const parent = WEATHER_BACKDROP_LAYOUT[kind];
      const xs = clouds.map((cloud) => parent.position[0] + cloud.position[0] * parent.scale);
      const zs = clouds.map((cloud) => parent.position[2] + cloud.position[2] * parent.scale);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(20);
      expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(4);
      expect(new Set(clouds.map((cloud) => cloud.driftPhase)).size).toBe(clouds.length);
    }
  });

  it("moves the sunny backdrop sun across the horizon and keeps it behind the hills", () => {
    const sunny = WEATHER_BACKDROP_LAYOUT.sunny;
    const dawn = sunBackdropPositionAt(0.06);
    const noon = sunBackdropPositionAt(0.5);
    const sunset = sunBackdropPositionAt(0.96);
    const world = (position: readonly [number, number, number]) => [
      sunny.position[0] + position[0] * sunny.scale,
      sunny.position[1] + position[1] * sunny.scale,
      sunny.position[2] + position[2] * sunny.scale,
    ] as const;

    expect(dawn[0]).toBeLessThan(noon[0]);
    expect(noon[0]).toBeLessThan(sunset[0]);
    expect(noon[1]).toBeGreaterThan(dawn[1] + 1);
    expect(noon[1]).toBeGreaterThan(sunset[1] + 1);
    expect(world(noon)[1]).toBeGreaterThan(20);
    expect(world(dawn)[1]).toBeLessThan(5);
    expect(world(sunset)[1]).toBeLessThan(5);
    for (const position of [world(dawn), world(noon), world(sunset)]) {
      expect(position[2]).toBeLessThan(-118);
      expect(position[2]).toBeGreaterThan(-126);
    }
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
