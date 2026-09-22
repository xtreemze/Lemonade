import { describe, expect, it } from "vitest";

import { characterProfileFor } from "../src/characters.js";

describe("seeded scene characters", () => {
  it("keeps each actor's appearance and gait stable for a seed", () => {
    const first = characterProfileFor(0x1ead2026, 17);
    const replay = characterProfileFor(0x1ead2026, 17);

    expect(replay).toEqual(first);
  });

  it("creates visible variety across neighboring actors without ambient randomness", () => {
    const profiles = Array.from({ length: 16 }, (_, index) =>
      characterProfileFor(0x1ead2026, index),
    );

    expect(new Set(profiles.map((profile) => profile.clothingColor)).size).toBeGreaterThan(3);
    expect(new Set(profiles.map((profile) => profile.skinColor)).size).toBeGreaterThan(2);
    expect(new Set(profiles.map((profile) => profile.hairStyle)).size).toBeGreaterThan(2);
    expect(new Set(profiles.map((profile) => profile.heightScale.toFixed(3))).size).toBeGreaterThan(8);
    expect(new Set(profiles.map((profile) => profile.walkPace.toFixed(3))).size).toBeGreaterThan(8);
    expect(new Set(profiles.map((profile) => profile.eyeSpacing.toFixed(3))).size).toBeGreaterThan(4);
    expect(new Set(profiles.map((profile) => profile.headWidthScale.toFixed(3))).size).toBeGreaterThan(4);
  });

  it("changes character identity when the run seed changes", () => {
    expect(characterProfileFor(1, 4)).not.toEqual(characterProfileFor(2, 4));
  });
});
