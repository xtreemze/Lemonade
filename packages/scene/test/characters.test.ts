import { Mesh, MeshBasicMaterial, SphereGeometry } from "three";
import { describe, expect, it } from "vitest";

import { characterIdentityFor, decorateCharacterHead } from "../src/character-detail.js";
import { characterProfileFor } from "../src/characters.js";

describe("seeded scene characters", () => {
  it("keeps each actor's appearance and gait stable for a seed", () => {
    const first = characterProfileFor(0x1e_ad_20_26, 17);
    const replay = characterProfileFor(0x1e_ad_20_26, 17);

    expect(replay).toEqual(first);
  });

  it("creates visible variety across neighboring actors without ambient randomness", () => {
    const profiles = Array.from({ length: 16 }, (_, index) =>
      characterProfileFor(0x1e_ad_20_26, index),
    );

    expect(new Set(profiles.map((profile) => profile.clothingColor)).size).toBeGreaterThan(3);
    expect(new Set(profiles.map((profile) => profile.skinColor)).size).toBeGreaterThan(2);
    expect(new Set(profiles.map((profile) => profile.hairStyle)).size).toBeGreaterThan(2);
    expect(new Set(profiles.map((profile) => profile.heightScale.toFixed(3))).size).toBeGreaterThan(
      8,
    );
    expect(new Set(profiles.map((profile) => profile.walkPace.toFixed(3))).size).toBeGreaterThan(8);
    expect(new Set(profiles.map((profile) => profile.eyeSpacing.toFixed(3))).size).toBeGreaterThan(
      4,
    );
    expect(
      new Set(profiles.map((profile) => profile.headWidthScale.toFixed(3))).size,
    ).toBeGreaterThan(4);
  });

  it("includes adult men, adult women, boys, and girls with modeled garment variety", () => {
    const actors = Array.from({ length: 24 }, (_, index) => {
      const profile = characterProfileFor(0x1e_ad_20_26, index);
      return Object.freeze({
        profile,
        identity: characterIdentityFor(index, profile),
      });
    });
    const cohorts = new Set(
      actors.map(({ identity }) => `${identity.ageGroup}:${identity.gender}`),
    );

    expect(cohorts).toEqual(new Set(["adult:male", "adult:female", "child:male", "child:female"]));
    expect(
      new Set(actors.map(({ identity }) => identity.garmentStyle)).size,
    ).toBeGreaterThanOrEqual(3);
    expect(new Set(actors.map(({ identity }) => identity.hairDetail)).size).toBeGreaterThanOrEqual(
      3,
    );
    expect(new Set(actors.map(({ identity }) => identity.bagStyle)).size).toBeGreaterThanOrEqual(3);
    expect(
      actors
        .filter(({ identity }) => identity.ageGroup === "child")
        .every(({ profile }) => profile.heightScale < 0.88),
    ).toBe(true);
    const seller = characterProfileFor(0x1e_ad_20_26, 10_001);
    expect(characterIdentityFor(10_001, seller).ageGroup).toBe("adult");
  });

  it("covers the scalp crown with overlapping hair geometry", () => {
    const profile = characterProfileFor(0x1e_ad_20_26, 3);
    const identity = characterIdentityFor(3, profile);
    const head = new Mesh(new SphereGeometry(0.27, 12, 8), new MeshBasicMaterial());

    decorateCharacterHead(head, profile, identity);
    const crown = head.children.find((object) => object.userData.sceneRole === "hair-cover");
    expect(crown).toBeInstanceOf(Mesh);
    if (!(crown instanceof Mesh)) {
      return;
    }

    expect(crown.scale.x).toBeGreaterThan(1);
    expect(crown.scale.y).toBeGreaterThanOrEqual(0.65);
    expect(crown.scale.z).toBeGreaterThanOrEqual(0.95);
    expect(crown.position.y).toBeLessThanOrEqual(0.13);
  });

  it("changes character identity when the run seed changes", () => {
    expect(characterProfileFor(1, 4)).not.toEqual(characterProfileFor(2, 4));
  });
});
