import { describe, expect, it } from "vitest";

import {
  neighborhoodSeedForCharacterSeed,
  neighborhoodSemanticLayoutForCharacterSeed,
  type SceneNeighborhoodOccurrence,
  type SceneNeighborhoodOccurrenceKind,
} from "../src/neighborhood-occurrences.js";
import {
  createNeighborhoodMobilitySystem,
  type NeighborhoodMobilitySample,
} from "../src/neighborhood-mobility.js";
import {
  generateResidentialLayout,
  residentialAccessLayout,
} from "../src/residential-layout.js";

const CHARACTER_SEED = 0x1020_3040;
const NEIGHBORHOOD_SEED = neighborhoodSeedForCharacterSeed(CHARACTER_SEED);
const DURATION_MS = 10_000;

const occurrence = (
  id: string,
  kind: SceneNeighborhoodOccurrenceKind,
  startMinute: number,
  endMinute: number,
  overrides: Partial<SceneNeighborhoodOccurrence> = {},
): SceneNeighborhoodOccurrence =>
  Object.freeze({
    id,
    kind,
    actorKind: kind.includes("vehicle") ? "vehicle" : "resident",
    actorId: id,
    household: null,
    startMinute,
    endMinute,
    anchors: Object.freeze([
      Object.freeze({ role: "street" as const, household: null }),
    ]),
    visualSeed: 7,
    motion: "normal" as const,
    economicEffect: "none" as const,
    ...overrides,
  });

const sampleAtMinute = (
  minute: number,
  occurrences: readonly SceneNeighborhoodOccurrence[],
  focus = { x: 0, z: 0 },
  pedestrianObstacles: readonly Readonly<{ x: number; z: number }>[] = [],
): NeighborhoodMobilitySample =>
  createNeighborhoodMobilitySystem(NEIGHBORHOOD_SEED).sample({
    weather: "sunny",
    phase: "simulation",
    elapsedMs: ((minute - 570) / 510) * DURATION_MS,
    durationMs: DURATION_MS,
    dayNumber: 3,
    occurrences,
    focus,
    pedestrianObstacles,
  });

describe("authoritative occurrence mobility integration", () => {
  it("coordinates resident, pet, driveway vehicle, car traffic, and bicycle traffic in one sample", () => {
    const semantics =
      neighborhoodSemanticLayoutForCharacterSeed(CHARACTER_SEED);
    const household = semantics.drivewayHouseholds[0];
    expect(household).toBeDefined();
    if (household === undefined) return;

    const schedule = Object.freeze([
      occurrence("resident:departure", "resident-departure", 720, 744, {
        actorKind: "resident",
        actorId: `resident:${String(household)}`,
        household,
        anchors: Object.freeze([
          Object.freeze({ role: "door" as const, household }),
          Object.freeze({ role: "front-path" as const, household }),
          Object.freeze({ role: "parking" as const, household }),
        ]),
      }),
      occurrence("vehicle:departure", "vehicle-departure", 732, 756, {
        actorKind: "vehicle",
        actorId: `vehicle:${String(household)}`,
        household,
        anchors: Object.freeze([
          Object.freeze({ role: "parking" as const, household }),
          Object.freeze({ role: "driveway" as const, household }),
          Object.freeze({ role: "street" as const, household }),
        ]),
      }),
      occurrence("pet:walk", "pet-walk", 738, 774, {
        actorKind: "pet",
        actorId: `pet:${String(household)}`,
        household,
        anchors: Object.freeze([
          Object.freeze({ role: "door" as const, household }),
          Object.freeze({ role: "front-path" as const, household }),
          Object.freeze({ role: "sidewalk" as const, household }),
        ]),
      }),
      occurrence("traffic:a", "vehicle-pass-through", 720, 780, {
        actorKind: "vehicle",
        actorId: "traffic-vehicle:a",
        visualSeed: 2,
      }),
      occurrence("bike:a", "bicycle-pass-through", 720, 780, {
        actorKind: "bicycle",
        actorId: "bicycle:a",
        visualSeed: 4,
      }),
    ]);

    const sample = sampleAtMinute(744, schedule);
    expect(sample.actors.some((actor) => actor.kind === "resident")).toBe(true);
    expect(sample.actors.some((actor) => actor.kind === "pet")).toBe(true);
    expect(
      sample.actors.some(
        (actor) =>
          actor.kind === "vehicle" && actor.propertyRole !== null,
      ),
    ).toBe(true);
    expect(
      sample.actors.some(
        (actor) =>
          actor.kind === "vehicle" && actor.id === "traffic-vehicle:a",
      ),
    ).toBe(true);
    expect(sample.actors.some((actor) => actor.kind === "bicycle")).toBe(true);
  });

  it("opens residence doors for arrivals/departures and lights windows after entry", () => {
    const semantics =
      neighborhoodSemanticLayoutForCharacterSeed(CHARACTER_SEED);
    const household = semantics.drivewayHouseholds[0] ?? 0;
    const schedule = Object.freeze([
      occurrence("resident:arrival", "resident-arrival", 900, 930, {
        actorKind: "resident",
        actorId: `resident:${String(household)}`,
        household,
        anchors: Object.freeze([
          Object.freeze({ role: "parking" as const, household }),
          Object.freeze({ role: "front-path" as const, household }),
          Object.freeze({ role: "door" as const, household }),
        ]),
      }),
    ]);

    const nearDoor = sampleAtMinute(927, schedule);
    const property = [
      ...generateResidentialLayout(NEIGHBORHOOD_SEED).frontProperties,
      ...generateResidentialLayout(NEIGHBORHOOD_SEED).middleProperties,
      ...generateResidentialLayout(NEIGHBORHOOD_SEED).backProperties,
      ...generateResidentialLayout(NEIGHBORHOOD_SEED).outerProperties,
    ][household];
    expect(property).toBeDefined();
    if (property === undefined) return;

    const activity = nearDoor.properties.find(
      (candidate) => candidate.propertyRole === property.role,
    );
    expect(activity?.doorOpen).toBe(true);
    expect(activity?.windowActivity).toBe(true);
  });

  it("makes driveway traffic yield to pedestrians and pets at the sidewalk crossing", () => {
    const semantics =
      neighborhoodSemanticLayoutForCharacterSeed(CHARACTER_SEED);
    const household = semantics.drivewayHouseholds[0];
    expect(household).toBeDefined();
    if (household === undefined) return;

    const layout = generateResidentialLayout(NEIGHBORHOOD_SEED);
    const properties = [
      ...layout.frontProperties,
      ...layout.middleProperties,
      ...layout.backProperties,
      ...layout.outerProperties,
    ];
    const property = properties[household];
    expect(property).toBeDefined();
    if (property === undefined) return;

    const access = residentialAccessLayout(property, NEIGHBORHOOD_SEED);
    const crossing = Object.freeze({
      x: access.drivewaySidewalkX,
      z: access.drivewaySidewalkZ,
    });
    const schedule = Object.freeze([
      occurrence("vehicle:driveway", "vehicle-departure", 720, 780, {
        actorKind: "vehicle",
        actorId: `vehicle:${String(household)}`,
        household,
        anchors: Object.freeze([
          Object.freeze({ role: "parking" as const, household }),
          Object.freeze({ role: "driveway" as const, household }),
          Object.freeze({ role: "street" as const, household }),
        ]),
      }),
    ]);

    const samples = Array.from({ length: 31 }, (_, index) =>
      sampleAtMinute(
        720 + index * 2,
        schedule,
        { x: 0, z: 0 },
        [crossing],
      ),
    );
    const yielding = samples
      .flatMap((sample) => sample.actors)
      .find(
        (actor) =>
          actor.id === `vehicle:${String(household)}` &&
          actor.waiting &&
          actor.interaction === "crossing",
      );
    expect(yielding).toBeDefined();
    expect(yielding?.speed).toBe(0);
  });

  it("coordinates car/bicycle right-of-way independently from render LOD", () => {
    const schedule = Object.freeze([
      occurrence("traffic:first", "vehicle-pass-through", 720, 780, {
        actorKind: "vehicle",
        actorId: "traffic-vehicle:first",
        visualSeed: 2,
      }),
      occurrence("traffic:second", "vehicle-pass-through", 720, 780, {
        actorKind: "vehicle",
        actorId: "traffic-vehicle:second",
        visualSeed: 2,
      }),
      occurrence("bike:same-route", "bicycle-pass-through", 720, 780, {
        actorKind: "bicycle",
        actorId: "bicycle:same-route",
        visualSeed: 2,
      }),
    ]);

    const near = sampleAtMinute(750, schedule, { x: 0, z: 0 });
    const far = sampleAtMinute(750, schedule, { x: 10_000, z: 10_000 });

    expect(
      near.actors.some(
        (actor) => actor.waiting && actor.interaction === "traffic",
      ),
    ).toBe(true);

    const behavior = (sample: NeighborhoodMobilitySample) =>
      sample.actors.map((actor) => ({
        id: actor.id,
        x: actor.x,
        z: actor.z,
        yaw: actor.yaw,
        speed: actor.speed,
        waiting: actor.waiting,
        interaction: actor.interaction,
      }));

    expect(behavior(far)).toEqual(behavior(near));
    expect(far.actors.every((actor) => actor.detail === "statistical")).toBe(
      true,
    );
    expect(far.actors.every((actor) => !actor.visible)).toBe(true);
  });
});
