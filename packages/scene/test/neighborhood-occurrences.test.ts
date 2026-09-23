import { describe, expect, it } from "vitest";

import {
  neighborhoodSeedForCharacterSeed,
  neighborhoodSemanticLayoutForCharacterSeed,
  type SceneNeighborhoodOccurrence,
} from "../src/neighborhood-occurrences.js";
import { createNeighborhoodMobilitySystem } from "../src/neighborhood-mobility.js";
import { generateResidentialLayout } from "../src/residential-layout.js";

describe("neighborhood occurrence scene semantics", () => {
  it("uses the same salted seed for visible geometry and occurrence anchors", () => {
    const characterSeed = 0x1234_abcd;
    const neighborhoodSeed = neighborhoodSeedForCharacterSeed(characterSeed);
    const layout = generateResidentialLayout(neighborhoodSeed);
    const semantics =
      neighborhoodSemanticLayoutForCharacterSeed(characterSeed);

    const properties = [
      ...layout.frontProperties,
      ...layout.middleProperties,
      ...layout.backProperties,
      ...layout.outerProperties,
    ];

    expect(neighborhoodSeed).not.toBe(characterSeed >>> 0);
    expect(semantics.householdCount).toBe(properties.length);
    expect(semantics.drivewayHouseholds).toEqual(
      properties.flatMap((property, index) =>
        property.drivewayX === null ? [] : [index],
      ),
    );
    expect(semantics.mailboxHouseholds).toEqual(
      properties.flatMap((property, index) =>
        property.mailboxX === null ? [] : [index],
      ),
    );
    expect(semantics.frontYardHouseholds).toEqual(
      properties.map((_, index) => index),
    );
  });

  it("is stable for identical character seeds", () => {
    const seed = 0x4c45_4d4f;
    expect(neighborhoodSemanticLayoutForCharacterSeed(seed)).toEqual(
      neighborhoodSemanticLayoutForCharacterSeed(seed),
    );
  });
});


describe("neighborhood occurrence mobility projection", () => {
  const characterSeed = 0x1020_3040;
  const neighborhoodSeed = neighborhoodSeedForCharacterSeed(characterSeed);
  const layout = generateResidentialLayout(neighborhoodSeed);
  const properties = [
    ...layout.frontProperties,
    ...layout.middleProperties,
    ...layout.backProperties,
    ...layout.outerProperties,
  ];

  const event = (
    overrides: Partial<SceneNeighborhoodOccurrence>,
  ): SceneNeighborhoodOccurrence =>
    Object.freeze({
      id: "test-occurrence",
      kind: "mail-delivery",
      actorKind: "mail-carrier",
      actorId: "mail-carrier",
      household: 0,
      startMinute: 480,
      endMinute: 500,
      anchors: Object.freeze([
        Object.freeze({ role: "mailbox", household: 0 }),
      ]),
      visualSeed: 1,
      motion: "normal",
      economicEffect: "none",
      ...overrides,
    });

  it("shows mail only inside the authoritative delivery window and retains serviced state", () => {
    const semantics =
      neighborhoodSemanticLayoutForCharacterSeed(characterSeed);
    const household = semantics.mailboxHouseholds[0];
    expect(household).toBeDefined();
    if (household === undefined) return;

    const occurrence = event({ household });
    const mobility = createNeighborhoodMobilitySystem(neighborhoodSeed);
    const sampleAtMinute = (minute: number) =>
      mobility.sample({
        weather: "sunny",
        phase: "forecast",
        elapsedMs: ((minute - 390) / 180) * 6_000,
        durationMs: 6_000,
        dayNumber: 1,
        occurrences: [occurrence],
      });

    expect(
      sampleAtMinute(450).actors.some(
        (actor) => actor.kind === "mail-carrier",
      ),
    ).toBe(false);
    expect(
      sampleAtMinute(490).actors.some(
        (actor) =>
          actor.kind === "mail-carrier" &&
          actor.interaction === "mailbox",
      ),
    ).toBe(true);

    const property = properties[household];
    expect(property).toBeDefined();
    if (property === undefined) return;
    expect(
      sampleAtMinute(510).properties.find(
        (activity) => activity.propertyRole === property.role,
      )?.mailServiced,
    ).toBe(true);
  });

  it("activates sprinklers only on the scheduled household", () => {
    const semantics =
      neighborhoodSemanticLayoutForCharacterSeed(characterSeed);
    const household = semantics.frontYardHouseholds[0];
    expect(household).toBeDefined();
    if (household === undefined) return;

    const occurrence = event({
      id: "sprinkler:test",
      kind: "sprinkler",
      actorKind: "sprinkler",
      actorId: `sprinkler:${String(household)}`,
      household,
      startMinute: 420,
      endMinute: 450,
      anchors: Object.freeze([
        Object.freeze({ role: "front-yard", household }),
      ]),
      motion: "stationary",
    });
    const sample = createNeighborhoodMobilitySystem(neighborhoodSeed).sample({
      weather: "sunny",
      phase: "forecast",
      elapsedMs: ((435 - 390) / 180) * 6_000,
      durationMs: 6_000,
      dayNumber: 1,
      occurrences: [occurrence],
    });

    const property = properties[household];
    expect(property).toBeDefined();
    if (property === undefined) return;
    expect(
      sample.properties.find(
        (activity) => activity.propertyRole === property.role,
      )?.sprinklerOn,
    ).toBe(true);
    expect(
      sample.properties.filter((activity) => activity.sprinklerOn),
    ).toHaveLength(1);
  });
});
