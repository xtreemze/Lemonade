import { describe, expect, it } from "vitest";

import {
  neighborhoodSeedForCharacterSeed,
  neighborhoodSemanticLayoutForCharacterSeed,
} from "../src/neighborhood-occurrences.js";
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
