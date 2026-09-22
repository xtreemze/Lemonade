import { Group, PointLight } from "three";
import { describe, expect, it } from "vitest";

import {
  lightningFlashAt,
  populateWeatherObjects,
} from "../src/weather-detail.js";

describe("storm weather detail", () => {
  it("creates brief lightning flashes instead of a continuously visible bolt", () => {
    expect(lightningFlashAt(1_800, 10_000)).toBeGreaterThan(0.95);
    expect(lightningFlashAt(3_200, 10_000)).toBeLessThan(0.05);
    expect(lightningFlashAt(4_700, 10_000)).toBeGreaterThan(0.95);
  });

  it("drives bolt visibility and flash-light intensity from storm timing", () => {
    const weather = {
      sunny: new Group(),
      cloudy: new Group(),
      "hot-and-dry": new Group(),
      thunderstorm: new Group(),
    } as const;
    const controller = populateWeatherObjects(weather);

    controller.update("thunderstorm", 3_200, 10_000);
    const bolt = weather.thunderstorm.children.find(
      (child) => child.userData["sceneRole"] === "lightning-bolt",
    );
    const flash = weather.thunderstorm.children.find(
      (child) => child.userData["sceneRole"] === "lightning-flash",
    );
    expect(bolt?.visible).toBe(false);
    expect(flash).toBeInstanceOf(PointLight);
    expect(flash instanceof PointLight ? flash.intensity : -1).toBe(0);

    controller.update("thunderstorm", 4_700, 10_000);
    expect(bolt?.visible).toBe(true);
    expect(flash instanceof PointLight ? flash.intensity : 0).toBeGreaterThan(5);
  });
});
