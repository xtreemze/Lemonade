import { describe, expect, it } from "vitest";

import {
  createNeighborhoodMobilitySystem,
  mobilityDetailForDistance,
  type NeighborhoodMobilitySample,
} from "../src/neighborhood-mobility.js";
import { generateResidentialLayout, residentialAccessLayout } from "../src/residential-layout.js";

const MOBILITY_SEED = 0x5e_ed_12_34;

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
    durationMs: phase === "forecast" ? 6000 : 14_000,
    dayNumber,
    focus: { x: 0, z: 0 },
  });

describe("unified neighborhood mobility", () => {
  it("is deterministic for the same seed, day, phase, and presentation time", () => {
    const first = sampleDay(4, 5200);
    const repeated = sampleDay(4, 5200);
    expect(repeated).toEqual(first);
  });

  it("coordinates road traffic, bicycles, pedestrians, and pets in one sample", () => {
    const sample = sampleDay(3, 5000);
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
    const sample = sampleDay(3, 5000);
    const trafficVehicles = sample.actors.filter((actor) =>
      actor.id.startsWith("traffic-vehicle:"),
    );
    expect(trafficVehicles).toHaveLength(14);
    expect(new Set(trafficVehicles.map((actor) => actor.id))).toEqual(
      new Set(
        [
          "main",
          "front-grid",
          "deep-grid",
          "middle-curve",
          "back-curve",
          "west-curve",
          "east-curve",
        ].flatMap((streetId) => [
          `traffic-vehicle:${streetId}:v0`,
          `traffic-vehicle:${streetId}:v1`,
        ]),
      ),
    );
  });

  it("routes bicycles across multiple neighborhood street groups", () => {
    const sample = sampleDay(3, 5000);
    const bicycleIds = sample.actors
      .filter((actor) => actor.kind === "bicycle")
      .map((actor) => actor.id);

    expect(bicycleIds).toHaveLength(3);
    expect(new Set(bicycleIds)).toEqual(
      new Set(["traffic-bicycle:main", "traffic-bicycle:front-grid", "traffic-bicycle:deep-grid"]),
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

  it("coordinates deterministic right-of-way between cars and bicycles", () => {
    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
    const samples = Array.from({ length: 96 }, (_, index) =>
      system.sample({
        weather: "sunny",
        phase: "simulation",
        elapsedMs: index * 125,
        durationMs: 12_000,
        dayNumber: 3,
        focus: { x: 0, z: 0 },
      }),
    );

    const yielding = samples
      .flatMap((sample) => sample.actors)
      .filter(
        (actor) =>
          (actor.kind === "vehicle" || actor.kind === "bicycle") &&
          actor.waiting &&
          actor.interaction === "traffic",
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

    expect(samples.some((sample) => sample.properties.some((property) => property.doorOpen))).toBe(
      true,
    );
    expect(
      samples.some((sample) => sample.properties.some((property) => property.windowActivity)),
    ).toBe(true);
    expect(
      samples.some((sample) =>
        sample.actors.some((actor) => actor.kind === "pet" && actor.interaction === "door"),
      ),
    ).toBe(true);
  });

  it("advances residents and pets with bounded physical movement from residence doors", () => {
    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
    const layout = generateResidentialLayout(MOBILITY_SEED);
    const property = layout.frontProperties[1];
    expect(property).toBeDefined();
    if (property === undefined) {
      return;
    }

    const access = residentialAccessLayout(property, MOBILITY_SEED);
    const door = { x: access.doorX, z: access.doorZ };
    const previous = new Map<string, { x: number; z: number; visible: boolean }>();
    const entered = new Set<string>();
    const moved = new Set<string>();

    for (let elapsedMs = 0; elapsedMs <= 14_000; elapsedMs += 50) {
      const sample = system.sample({
        weather: "cloudy",
        phase: "simulation",
        elapsedMs,
        durationMs: 14_000,
        dayNumber: 5,
        focus: door,
      });

      for (const id of ["resident:0", "resident-pet"] as const) {
        const actor = sample.actors.find((candidate) => candidate.id === id);
        expect(actor).toBeDefined();
        if (actor === undefined) {
          continue;
        }

        const prior = previous.get(id);
        if (actor.visible && (prior === undefined || !prior.visible)) {
          expect(Math.hypot(actor.x - door.x, actor.z - door.z)).toBeLessThan(0.15);
          entered.add(id);
        }

        if (prior?.visible === true && actor.visible) {
          const displacement = Math.hypot(actor.x - prior.x, actor.z - prior.z);
          expect(displacement).toBeLessThanOrEqual(0.09);
          if (displacement > 0.005) {
            moved.add(id);
          }
        }

        previous.set(id, {
          x: actor.x,
          z: actor.z,
          visible: actor.visible,
        });
      }
    }

    expect(entered).toEqual(new Set(["resident:0", "resident-pet"]));
    expect(moved).toEqual(new Set(["resident:0", "resident-pet"]));
  });

  it("projects accumulated locomotion distance only from actor-owned clocks", () => {
    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
    const sample = system.sample({
      weather: "cloudy",
      phase: "simulation",
      elapsedMs: 5000,
      durationMs: 14_000,
      dayNumber: 5,
      focus: { x: 0, z: 0 },
    });

    const clockDriven = sample.actors.filter(
      (actor) =>
        actor.id.startsWith("traffic-") ||
        actor.id === "resident:0" ||
        actor.id === "resident:1" ||
        actor.id === "resident-pet" ||
        actor.id === "resident-vehicle" ||
        actor.id === "resident-driver",
    );
    expect(clockDriven.length).toBeGreaterThan(0);
    expect(
      clockDriven.every(
        (actor) =>
          actor.travelDistance !== null &&
          Number.isFinite(actor.travelDistance) &&
          actor.travelDistance >= 0,
      ),
    ).toBe(true);
  });

  it("drives a resident vehicle into a driveway, parks, transfers its driver, and later departs", () => {
    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
    const layout = generateResidentialLayout(MOBILITY_SEED);
    const drivewayProperty =
      layout.frontProperties.find(
        (property) => property.role === "east-mid" && property.drivewayX !== null,
      ) ?? layout.frontProperties.find((property) => property.drivewayX !== null);
    expect(drivewayProperty).toBeDefined();
    if (drivewayProperty === undefined || drivewayProperty.drivewayX === null) {
      return;
    }

    const access = residentialAccessLayout(drivewayProperty, MOBILITY_SEED);
    let parkedVehicle: NeighborhoodMobilitySample["actors"][number] | undefined;
    let sawDriverTransfer = false;
    let sawDepartureAfterParking = false;
    let hasParked = false;

    for (let elapsedMs = 0; elapsedMs <= 24_000; elapsedMs += 50) {
      const sample = system.sample({
        weather: "cloudy",
        phase: "simulation",
        elapsedMs,
        durationMs: 14_000,
        dayNumber: 2,
        focus: { x: 0, z: 0 },
      });
      const vehicle = sample.actors.find((actor) => actor.id === "resident-vehicle");
      const driver = sample.actors.find((actor) => actor.id === "resident-driver");
      const vehicleIsParked = sample.properties.some(
        (property) => property.propertyRole === drivewayProperty.role && property.vehicleParked,
      );

      if (vehicleIsParked && vehicle?.interaction === "parking") {
        hasParked = true;
        parkedVehicle ??= vehicle;
        expect(vehicle.speed).toBe(0);
      }
      if (driver?.visible === true && driver.interaction === "door") {
        sawDriverTransfer = true;
      }
      if (
        hasParked &&
        !vehicleIsParked &&
        vehicle !== undefined &&
        vehicle.interaction !== "parking"
      ) {
        sawDepartureAfterParking = true;
      }
    }

    expect(hasParked).toBe(true);
    expect(sawDriverTransfer).toBe(true);
    expect(sawDepartureAfterParking).toBe(true);
    expect(parkedVehicle).toBeDefined();
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
  });

  it("makes driveway traffic yield to pedestrians and pets crossing the sidewalk", () => {
    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
    const layout = generateResidentialLayout(MOBILITY_SEED);
    const property =
      layout.frontProperties.find(
        (candidate) => candidate.role === "east-mid" && candidate.drivewayX !== null,
      ) ?? layout.frontProperties.find((candidate) => candidate.drivewayX !== null);
    expect(property).toBeDefined();
    const drivewayX = property?.drivewayX;
    if (typeof drivewayX !== "number" || property === undefined) {
      return;
    }

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
          actor.id === "resident-vehicle" && actor.waiting && actor.interaction === "crossing",
      );
    expect(yielding).toBeDefined();
    expect(yielding?.speed).toBe(0);

    if (yielding !== undefined) {
      const sameTimeClear = system.sample({
        weather: "sunny",
        phase: "simulation",
        elapsedMs:
          (crossingSamples.findIndex((sample) =>
            sample.actors.some(
              (actor) =>
                actor.id === yielding.id && actor.waiting && actor.interaction === "crossing",
            ),
          ) /
            16) *
            0.139 *
            14_000 +
          0.28 * 14_000,
        durationMs: 14_000,
        dayNumber: 2,
        focus: { x: 0, z: 0 },
        pedestrianObstacles: [],
      });
      expect(sameTimeClear.actors.find((actor) => actor.id === "resident-vehicle")?.waiting).toBe(
        false,
      );
    }
  });

  it("runs the mail route every forecast and a gardener on exactly one weekday", () => {
    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
    const mailDays = Array.from({ length: 7 }, (_, index) =>
      system.sample({
        weather: "cloudy",
        phase: "forecast",
        elapsedMs: 4500,
        durationMs: 6000,
        dayNumber: index + 1,
        focus: { x: 0, z: 0 },
      }),
    );

    expect(
      mailDays.every((sample) => sample.actors.some((actor) => actor.kind === "mail-carrier")),
    ).toBe(true);
    expect(
      mailDays
        .flatMap((sample) => sample.actors)
        .filter((actor) => actor.kind === "mail-carrier" && actor.interaction !== "mailbox")
        .every((actor) => actor.speed === 1.42),
    ).toBe(true);
    const gardenerDays = mailDays.filter((sample) =>
      sample.actors.some((actor) => actor.kind === "gardener"),
    );
    expect(gardenerDays).toHaveLength(1);
    expect(
      gardenerDays
        .flatMap((sample) => sample.actors)
        .filter((actor) => actor.kind === "gardener" && actor.interaction !== "gardening")
        .every((actor) => actor.speed === 1.42),
    ).toBe(true);
    expect(
      mailDays.some((sample) => sample.properties.some((property) => property.mailServiced)),
    ).toBe(true);
  });

  it("runs sprinklers only during a sunny morning forecast", () => {
    const sunny = sampleDay(3, 2500, "forecast", "sunny");
    const cloudy = sampleDay(3, 2500, "forecast", "cloudy");
    const simulation = sampleDay(3, 2500, "simulation", "sunny");

    expect(sunny.properties.some((property) => property.sprinklerOn)).toBe(true);
    expect(cloudy.properties.some((property) => property.sprinklerOn)).toBe(false);
    expect(simulation.properties.some((property) => property.sprinklerOn)).toBe(false);
  });

  it("keeps mobility decisions invariant when only render LOD focus changes", () => {
    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
    const baseInput = {
      weather: "sunny" as const,
      phase: "simulation" as const,
      elapsedMs: 6300,
      durationMs: 12_000,
      dayNumber: 3,
    };
    const near = system.sample({
      ...baseInput,
      focus: { x: 0, z: 0 },
    });
    const far = system.sample({
      ...baseInput,
      focus: { x: 10_000, z: 10_000 },
    });
    const behavior = (sample: NeighborhoodMobilitySample) =>
      sample.actors.map((actor) => ({
        id: actor.id,
        kind: actor.kind,
        x: actor.x,
        z: actor.z,
        yaw: actor.yaw,
        speed: actor.speed,
        waiting: actor.waiting,
        interaction: actor.interaction,
        propertyRole: actor.propertyRole,
      }));

    expect(behavior(far)).toEqual(behavior(near));
    expect(far.actors.every((actor) => actor.detail === "statistical")).toBe(true);
  });

  it("uses independent simulation LOD and collapses distant actors statistically", () => {
    expect(mobilityDetailForDistance(12)).toBe("full");
    expect(mobilityDetailForDistance(50)).toBe("reduced");
    expect(mobilityDetailForDistance(120)).toBe("statistical");
    expect(mobilityDetailForDistance(Number.POSITIVE_INFINITY)).toBe("statistical");

    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
    const distant = system.sample({
      weather: "sunny",
      phase: "simulation",
      elapsedMs: 5000,
      durationMs: 14_000,
      dayNumber: 1,
      focus: { x: 1000, z: 1000 },
    });
    expect(distant.actors.every((actor) => !actor.visible)).toBe(true);
    expect(
      Object.values(distant.statisticalCounts).reduce((total, value) => total + value, 0),
    ).toBeGreaterThan(0);
  });

  it("keeps through-traffic displacement bounded through yields and releases", () => {
    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
    const previous = new Map<string, { x: number; z: number; speed: number }>();
    let sawYield = false;

    for (let elapsedMs = 0; elapsedMs <= 14_000; elapsedMs += 100) {
      const sample = system.sample({
        weather: "sunny",
        phase: "simulation",
        elapsedMs,
        durationMs: 14_000,
        dayNumber: 2,
        focus: { x: 0, z: 0 },
      });

      for (const actor of sample.actors) {
        if (
          !actor.id.startsWith("traffic-") ||
          (actor.kind !== "vehicle" && actor.kind !== "bicycle")
        ) {
          continue;
        }
        if (actor.waiting) {
          sawYield = true;
        }

        const prior = previous.get(actor.id);
        if (prior !== undefined) {
          const displacement = Math.hypot(actor.x - prior.x, actor.z - prior.z);
          const maxObservedSpeed = Math.max(prior.speed, actor.speed);
          expect(displacement).toBeLessThanOrEqual(maxObservedSpeed * 0.1 + 0.55);
        }
        previous.set(actor.id, {
          x: actor.x,
          z: actor.z,
          speed: actor.speed,
        });
      }
    }

    expect(sawYield).toBe(true);
  });

  it("drives the resident vehicle and driver from actor-owned physical clocks", () => {
    const system = createNeighborhoodMobilitySystem(MOBILITY_SEED);
    const layout = generateResidentialLayout(MOBILITY_SEED);
    const property =
      layout.frontProperties.find(
        (candidate) => candidate.role === "east-mid" && candidate.drivewayX !== null,
      ) ?? layout.frontProperties.find((candidate) => candidate.drivewayX !== null);
    expect(property).toBeDefined();
    if (property === undefined || property.drivewayX === null) {
      return;
    }

    const access = residentialAccessLayout(property, MOBILITY_SEED);
    const crossingObstacle = {
      x: access.drivewaySidewalkX,
      z: access.drivewaySidewalkZ,
    };
    const previous = new Map<
      string,
      { x: number; z: number; speed: number; travelDistance: number }
    >();
    let sawVehicleYield = false;
    let sawDriver = false;

    for (let elapsedMs = 0; elapsedMs <= 20_000; elapsedMs += 50) {
      const sample = system.sample({
        weather: "sunny",
        phase: "simulation",
        elapsedMs,
        durationMs: 14_000,
        dayNumber: 2,
        focus: { x: 0, z: 0 },
        pedestrianObstacles: elapsedMs <= 6000 ? [crossingObstacle] : [],
      });

      for (const actorId of ["resident-vehicle", "resident-driver"] as const) {
        const actor = sample.actors.find((candidate) => candidate.id === actorId);
        expect(actor).toBeDefined();
        if (actor === undefined) {
          continue;
        }

        if (actorId === "resident-vehicle" && actor.waiting) {
          sawVehicleYield = true;
        }
        if (actorId === "resident-driver" && actor.visible) {
          sawDriver = true;
        }

        if (!actor.visible && actorId === "resident-driver") {
          continue;
        }

        expect(actor.travelDistance).not.toBeNull();
        if (actor.travelDistance === null) {
          continue;
        }
        expect(Number.isFinite(actor.travelDistance)).toBe(true);

        const prior = previous.get(actorId);
        if (prior !== undefined) {
          const displacement = Math.hypot(actor.x - prior.x, actor.z - prior.z);
          const maxObservedSpeed = Math.max(prior.speed, actor.speed);
          const allowance = actorId === "resident-vehicle" ? 0.08 : 0.03;
          expect(displacement).toBeLessThanOrEqual(maxObservedSpeed * 0.05 + allowance);
          expect(actor.travelDistance).toBeGreaterThanOrEqual(prior.travelDistance);
        }

        previous.set(actorId, {
          x: actor.x,
          z: actor.z,
          speed: actor.speed,
          travelDistance: actor.travelDistance,
        });
      }
    }

    expect(sawVehicleYield).toBe(true);
    expect(sawDriver).toBe(true);
  });
});
