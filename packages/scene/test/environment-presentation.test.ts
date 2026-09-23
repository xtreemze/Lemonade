import { describe, expect, it } from "vitest";

import {
  environmentOccurrenceSchedule,
  environmentOccurrencesBetween,
  environmentPresentationFrameAt,
} from "../src/environment-presentation.js";

describe("environment presentation contract", () => {
  it("produces the same semantic frame for the same weather and elapsed time", () => {
    const first = environmentPresentationFrameAt(
      "thunderstorm",
      "simulation",
      5_600,
      14_000,
      false,
    );
    const second = environmentPresentationFrameAt(
      "thunderstorm",
      "simulation",
      5_600,
      14_000,
      false,
    );

    expect(first).toEqual(second);
  });

  it("uses one thunder occurrence schedule for visual, audio and haptic consumers", () => {
    const schedule = environmentOccurrenceSchedule(
      "thunderstorm",
      "simulation",
      14_000,
    );
    const thunder = schedule.filter((occurrence) => occurrence.kind === "thunder");

    expect(thunder.map((occurrence) => occurrence.atMs)).toEqual([
      2_800,
      7_980,
      10_920,
    ]);
    expect(new Set(thunder.map((occurrence) => occurrence.id)).size).toBe(thunder.length);
  });

  it("only schedules birdsong for sunny simulation presentation", () => {
    expect(
      environmentOccurrenceSchedule("sunny", "simulation", 10_000)
        .filter((occurrence) => occurrence.kind === "birdsong")
        .map((occurrence) => occurrence.atMs),
    ).toEqual([1_400, 4_300, 7_200]);

    expect(
      environmentOccurrenceSchedule("sunny", "forecast", 6_000).some(
        (occurrence) => occurrence.kind === "birdsong",
      ),
    ).toBe(false);
  });

  it("keeps semantic occurrence order independent of frame subdivision", () => {
    const whole = environmentOccurrencesBetween(
      "thunderstorm",
      "simulation",
      14_000,
      0,
      14_000,
    );
    const split = [
      ...environmentOccurrencesBetween(
        "thunderstorm",
        "simulation",
        14_000,
        0,
        5_000,
      ),
      ...environmentOccurrencesBetween(
        "thunderstorm",
        "simulation",
        14_000,
        5_000,
        9_000,
      ),
      ...environmentOccurrencesBetween(
        "thunderstorm",
        "simulation",
        14_000,
        9_000,
        14_000,
      ),
    ];

    expect(split).toEqual(whole);
  });

  it("reduced motion changes motion output without changing semantic weather events", () => {
    const moving = environmentPresentationFrameAt(
      "thunderstorm",
      "simulation",
      8_000,
      14_000,
      false,
    );
    const reduced = environmentPresentationFrameAt(
      "thunderstorm",
      "simulation",
      8_000,
      14_000,
      true,
    );

    expect(reduced.motionScale).toBe(0);
    expect(moving.motionScale).toBe(1);
    expect(reduced.precipitation).toBe(moving.precipitation);
    expect(reduced.businessDayProgress).toBe(moving.businessDayProgress);
    expect(
      environmentOccurrenceSchedule("thunderstorm", "simulation", 14_000),
    ).toEqual(
      environmentOccurrenceSchedule("thunderstorm", "simulation", 14_000),
    );
  });

  it("forecast and simulation use explicit business-day timeline modes", () => {
    const forecast = environmentPresentationFrameAt(
      "sunny",
      "forecast",
      4_000,
      6_000,
      false,
    );
    const simulation = environmentPresentationFrameAt(
      "sunny",
      "simulation",
      4_000,
      14_000,
      false,
    );

    expect(forecast.businessDayProgress).toBe(0.04);
    expect(simulation.businessDayProgress).toBeGreaterThan(forecast.businessDayProgress);
  });
});
