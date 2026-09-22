import { describe, expect, it } from "vitest";

import {
  createNeighborhoodMobilitySystem,
  mobilityDetailForDistance,
  type NeighborhoodMobilitySample,
} from "../src/neighborhood-mobility.js";

const sampleDay = (
  dayNumber: number,
  elapsedMs: number,
  phase: "forecast" | "simulation" = "simulation",
  weather: "sunny" | "cloudy" = "sunny",
): NeighborhoodMobilitySample =>
  createNeighborhoodMobilitySystem(0x5eed1234).sample({
    weather,
    phase,
    elapsedMs,
    durationMs: phase === "forecast" ? 6_000 : 14_000,
    dayNumber,
    focus: { x: 0, z: 0 },
  });

describe("unified neighborhood mobility", () => {
  it("is deterministic for the same seed, day, phase, and presentation time", () => {
    const first = sampleDay(4, 5_200);
    const repeated = sampleDay(4, 5_200);
    expect(repeated).toEqual(first);
  });

  it("coordinates road traffic, bicycles, pedestrians, and pets in one sample", () => {
    const sample = sampleDay(3, 5_000);
    expect(sample.actors.some((actor) => actor.kind === "vehicle")).toBe(true);
    expect(sample.actors.some((actor) => actor.kind === "bicycle")).toBe(true);
    expect(sample.actors.some((actor) => actor.kind === "resident")).toBe(true);
    expect(sample.actors.some((actor) => actor.kind === "pet")).toBe(true);

    const roadZs = sample.actors
      .filter((actor) => actor.kind === "vehicle" || actor.kind === "bicycle")
      .map((actor) => Number(actor.z.toFixed(1)));
    expect(new Set(roadZs).size).toBeGreaterThan(1);
  });

  it("gives pedestrians crossing priority over nearby vehicles and bicycles", () => {
    const system = createNeighborhoodMobilitySystem(0x5eed1234);
    const samples = Array.from({ length: 20 }, (_, index) =>
      system.sample({
        weather: "sunny",
        phase: "simulation",
        elapsedMs: index * 700,
        durationMs: 14_000,
        dayNumber: 2,
        focus: { x: 0, z: 0 },
      }),
    );

    const yielding = samples
      .flatMap((sample) => sample.actors)
      .filter(
        (actor) =>
          (actor.kind === "vehicle" || actor.kind === "bicycle") &&
          actor.waiting &&
          actor.interaction === "crossing",
      );
    expect(yielding.length).toBeGreaterThan(0);
    expect(yielding.every((actor) => actor.speed === 0)).toBe(true);
  });

  it("cycles residents and a pet through residence doors and window activity", () => {
    const system = createNeighborhoodMobilitySystem(0x5eed1234);
    const samples = Array.from({ length: 28 }, (_, index) =>
      system.sample({
        weather: "cloudy",
        phase: "simulation",
        elapsedMs: index * 500,
        durationMs: 14_000,
        dayNumber: 5,
        focus: { x: 0, z: 0 },
      }),
    );

    expect(
      samples.some((sample) =>
        sample.properties.some((property) => property.doorOpen),
      ),
    ).toBe(true);
    expect(
      samples.some((sample) =>
        sample.properties.some((property) => property.windowActivity),
      ),
    ).toBe(true);
    expect(
      samples.some((sample) =>
        sample.actors.some(
          (actor) => actor.kind === "pet" && actor.interaction === "door",
        ),
      ),
    ).toBe(true);
  });

  it("drives a resident vehicle into a driveway, parks, and later departs", () => {
    const system = createNeighborhoodMobilitySystem(0x5eed1234);
    const parked = system.sample({
      weather: "cloudy",
      phase: "simulation",
      elapsedMs: 7_000,
      durationMs: 14_000,
      dayNumber: 2,
      focus: { x: 0, z: 0 },
    });
    const later = system.sample({
      weather: "cloudy",
      phase: "simulation",
      elapsedMs: 12_600,
      durationMs: 14_000,
      dayNumber: 2,
      focus: { x: 0, z: 0 },
    });

    expect(
      parked.properties.some((property) => property.vehicleParked),
    ).toBe(true);
    expect(
      parked.actors.some(
        (actor) =>
          actor.id === "resident-vehicle" &&
          actor.interaction === "parking" &&
          actor.speed === 0,
      ),
    ).toBe(true);
    expect(
      later.properties.some((property) => property.vehicleParked),
    ).toBe(false);

    const exiting = system.sample({
      weather: "cloudy",
      phase: "simulation",
      elapsedMs: 6_500,
      durationMs: 14_000,
      dayNumber: 2,
      focus: { x: 0, z: 0 },
    });
    expect(
      exiting.actors.some(
        (actor) =>
          actor.id === "resident-driver" &&
          actor.visible &&
          actor.interaction === "door",
      ),
    ).toBe(true);
  });

  it("runs the mail route every forecast and a gardener on exactly one weekday", () => {
    const system = createNeighborhoodMobilitySystem(0x5eed1234);
    const mailDays = Array.from({ length: 7 }, (_, index) =>
      system.sample({
        weather: "cloudy",
        phase: "forecast",
        elapsedMs: 4_500,
        durationMs: 6_000,
        dayNumber: index + 1,
        focus: { x: 0, z: 0 },
      }),
    );

    expect(
      mailDays.every((sample) =>
        sample.actors.some((actor) => actor.kind === "mail-carrier"),
      ),
    ).toBe(true);
    expect(
      mailDays.filter((sample) =>
        sample.actors.some((actor) => actor.kind === "gardener"),
      ),
    ).toHaveLength(1);
    expect(
      mailDays.some((sample) =>
        sample.properties.some((property) => property.mailServiced),
      ),
    ).toBe(true);
  });

  it("runs sprinklers only during a sunny morning forecast", () => {
    const sunny = sampleDay(3, 2_500, "forecast", "sunny");
    const cloudy = sampleDay(3, 2_500, "forecast", "cloudy");
    const simulation = sampleDay(3, 2_500, "simulation", "sunny");

    expect(sunny.properties.some((property) => property.sprinklerOn)).toBe(true);
    expect(cloudy.properties.some((property) => property.sprinklerOn)).toBe(false);
    expect(simulation.properties.some((property) => property.sprinklerOn)).toBe(false);
  });

  it("uses independent simulation LOD and collapses distant actors statistically", () => {
    expect(mobilityDetailForDistance(12)).toBe("full");
    expect(mobilityDetailForDistance(50)).toBe("reduced");
    expect(mobilityDetailForDistance(120)).toBe("statistical");

    const system = createNeighborhoodMobilitySystem(0x5eed1234);
    const distant = system.sample({
      weather: "sunny",
      phase: "simulation",
      elapsedMs: 5_000,
      durationMs: 14_000,
      dayNumber: 1,
      focus: { x: 1_000, z: 1_000 },
    });
    expect(distant.actors.every((actor) => !actor.visible)).toBe(true);
    expect(
      Object.values(distant.statisticalCounts).reduce(
        (total, value) => total + value,
        0,
      ),
    ).toBeGreaterThan(0);
  });
});
