import { Group } from "three";
import { describe, expect, it } from "vitest";

import {
  characterWeatherPresentationFor,
  syncCharacterWeatherPresentation,
} from "../src/character-weather.js";

describe("deterministic customer weather presentation", () => {
  it("is deterministic for the same visual identity and weather", () => {
    expect(characterWeatherPresentationFor(0x12_34_ab_cd, "thunderstorm")).toEqual(
      characterWeatherPresentationFor(0x12_34_ab_cd, "thunderstorm"),
    );
  });

  it("keeps cloudy neutral while sunny/hot and storms add bounded presentation", () => {
    const seed = 0x51_a7_20_26;
    const cloudy = characterWeatherPresentationFor(seed, "cloudy");
    const sunny = characterWeatherPresentationFor(seed, "sunny");
    const hot = characterWeatherPresentationFor(seed, "hot-and-dry");
    const storm = characterWeatherPresentationFor(seed, "thunderstorm");

    expect(cloudy).toEqual({
      headAccessory: "none",
      bodyLayer: "none",
      carriedAccessory: "none",
      gaitRate: 1,
      hunch: 0,
    });
    expect(["none", "sunglasses", "sun-hat"]).toContain(sunny.headAccessory);
    expect(["sunglasses", "sun-hat"]).toContain(hot.headAccessory);
    expect(storm.bodyLayer).toBe("raincoat");
    expect(["umbrella", "newspaper"]).toContain(storm.carriedAccessory);
    expect(storm.gaitRate).toBeGreaterThan(1);
    expect(storm.hunch).toBeGreaterThan(0);
  });

  it("replaces temporary weather geometry without mutating core identity roots", () => {
    const head = new Group();
    const body = new Group();
    const carry = new Group();
    const coreHeadChild = new Group();
    const coreBodyChild = new Group();
    head.add(coreHeadChild);
    body.add(coreBodyChild);

    const roots = Object.freeze({
      head: new Group(),
      body: new Group(),
      carry,
    });
    head.add(roots.head);
    body.add(roots.body);

    syncCharacterWeatherPresentation(roots, 101, "thunderstorm");
    expect(roots.body.children.length).toBeGreaterThan(0);
    expect(roots.carry.children.length).toBeGreaterThan(0);

    const stormCounts = [
      roots.head.children.length,
      roots.body.children.length,
      roots.carry.children.length,
    ];
    syncCharacterWeatherPresentation(roots, 101, "thunderstorm");
    expect([
      roots.head.children.length,
      roots.body.children.length,
      roots.carry.children.length,
    ]).toEqual(stormCounts);

    syncCharacterWeatherPresentation(roots, 101, "cloudy");
    expect(roots.head.children).toHaveLength(0);
    expect(roots.body.children).toHaveLength(0);
    expect(roots.carry.children).toHaveLength(0);
    expect(head.children).toContain(coreHeadChild);
    expect(body.children).toContain(coreBodyChild);
  });

  it("can vary temporary accessories across identities without changing weather semantics", () => {
    const storm = Array.from({ length: 16 }, (_, visualSeed) =>
      characterWeatherPresentationFor(visualSeed, "thunderstorm"),
    );
    const hot = Array.from({ length: 16 }, (_, visualSeed) =>
      characterWeatherPresentationFor(visualSeed, "hot-and-dry"),
    );

    expect(new Set(storm.map((entry) => entry.carriedAccessory)).size).toBeGreaterThan(1);
    expect(new Set(hot.map((entry) => entry.headAccessory)).size).toBeGreaterThan(1);
    expect(storm.every((entry) => entry.bodyLayer === "raincoat")).toBe(true);
  });
});
