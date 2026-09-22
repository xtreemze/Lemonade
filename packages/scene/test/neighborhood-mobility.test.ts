import { describe, expect, it } from "vitest";

import {
  createNeighborhoodMobilitySystem,
  mobilityDetailForDistance,
  type NeighborhoodMobilitySample,
} from "../src/neighborhood-mobility.js";
import {
  generateResidentialLayout,
  residentialAccessLayout,
} from "../src/residential-layout.js";

const MOBILITY_SEED = 0x5eed1234;

const sampleDay = (
  dayNumber: number,
  elapsedMs: number,
  phase: "forecast" | "simulation" = "simulation",
  weather: "sunny" | "cloudy" = "sunny",
): NeighborhoodMobilitySample =>
  createNeighborhoodMobilitySystem(MOBILITY_SEED).sample({
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

  it("routes through-traffic across every generated neighborhood street", () => {
    const sample = sampleDay(3, 5_000);
    const trafficVehicles = sample.actors.filter(
      (actor) => actor.id.startsWith("traffic-vehicle:"),
    );
    expect(trafficVehicles).toHaveLength(7);
    expect(new Set(trafficVehicles.map((actor) => actor.id))).toEqual(
      new Set([
        "traffic-vehicle:main",
        "traffic-vehicle:front-grid",
        "traffic-vehicle:deep-grid",
        "traffic-vehicle:middle-curve",
        "traffic-vehicle:back-curve",
        "traffic-vehicle:west-curve",
        "traffic-vehicle:east-curve",
      ]),
    );
  });

  it("gives pedestrians crossing priority over nearby vehicles and bicycles", () => {
    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
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
    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
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
    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
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
    const parkedVehicle = parked.actors.find(
      (actor) => actor.id === "resident-vehicle",
    );
    expect(parkedVehicle?.interaction).toBe("parking");
    expect(parkedVehicle?.speed).toBe(0);

    const layout = generateResidentialLayout(MOBILITY_SEED);
    const drivewayProperty =
      layout.frontProperties.find(
        (property) =>
          property.role === "east-mid" && property.drivewayX !== null,
      ) ??
      layout.frontProperties.find(
        (property) => property.drivewayX !== null,
      );
    expect(drivewayProperty).toBeDefined();
    if (drivewayProperty !== undefined && drivewayProperty.drivewayX !== null) {
      const access = residentialAccessLayout(
        drivewayProperty,
        MOBILITY_SEED,
      );
      expect(parkedVehicle?.x).toBeCloseTo(drivewayProperty.drivewayX);
      expect(parkedVehicle?.z).toBeCloseTo(access.parkingZ);
      expect(
        layout.exclusions.some(
          (rect) =>
            rect.role === "sidewalk" &&
            parkedVehicle !== undefined &&
            parkedVehicle.x >= rect.minX &&
            parkedVehicle.x <= rect.maxX &&
            parkedVehicle.z >= rect.minZ &&
            parkedVehicle.z <= rect.maxZ,
        ),
      ).toBe(false);
    }

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

  it("makes driveway traffic yield to pedestrians and pets crossing the sidewalk", () => {
    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
    const layout = generateResidentialLayout(MOBILITY_SEED);
    const property =
      layout.frontProperties.find(
        (candidate) =>
          candidate.role === "east-mid" && candidate.drivewayX !== null,
      ) ??
      layout.frontProperties.find((candidate) => candidate.drivewayX !== null);
    expect(property).toBeDefined();
    const drivewayX = property?.drivewayX;
    if (typeof drivewayX !== "number" || property === undefined) return;

    const access = residentialAccessLayout(property, MOBILITY_SEED);
    const crossingObstacle = {
      x: access.drivewaySidewalkX,
      z: access.drivewaySidewalkZ,
    };
    const crossingSamples = Array.from({ length: 17 }, (_, index) => {
      const t = 0.28 + (index / 16) * 0.139;
      return system.sample({
        weather: "sunny",
        phase: "simulation",
        elapsedMs: t * 14_000,
        durationMs: 14_000,
        dayNumber: 2,
        focus: { x: 0, z: 0 },
        pedestrianObstacles: [crossingObstacle],
      });
    });
    const yielding = crossingSamples
      .flatMap((sample) => sample.actors)
      .find(
        (actor) =>
          actor.id === "resident-vehicle" &&
          actor.waiting &&
          actor.interaction === "crossing",
      );
    expect(yielding).toBeDefined();
    expect(yielding?.speed).toBe(0);

    if (yielding !== undefined) {
      const sameTimeClear = system.sample({
        weather: "sunny",
        phase: "simulation",
        elapsedMs:
          crossingSamples.findIndex((sample) =>
            sample.actors.some(
              (actor) =>
                actor.id === yielding.id &&
                actor.waiting &&
                actor.interaction === "crossing",
            ),
          ) /
            16 *
            0.139 *
            14_000 +
          0.28 * 14_000,
        durationMs: 14_000,
        dayNumber: 2,
        focus: { x: 0, z: 0 },
        pedestrianObstacles: [],
      });
      expect(
        sameTimeClear.actors.find((actor) => actor.id === "resident-vehicle")
          ?.waiting,
      ).toBe(false);
    }
  });

  it("runs the mail route every forecast and a gardener on exactly one weekday", () => {
    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
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
      mailDays
        .flatMap((sample) => sample.actors)
        .filter(
          (actor) =>
            actor.kind === "mail-carrier" && actor.interaction !== "mailbox",
        )
        .every((actor) => actor.speed === 1.42),
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

    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
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
