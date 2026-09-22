import {
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from "three";
import { describe, expect, it } from "vitest";

import {
  decorateCharacterClothing,
  decorateCharacterHead,
} from "../src/character-detail.js";
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
    expect(new Set(profiles.map((profile) => profile.expression)).size).toBeGreaterThan(2);
  });

  it("covers male and female adults and children deterministically", () => {
    const profiles = Array.from({ length: 8 }, (_, index) =>
      characterProfileFor(0x1ead2026, index),
    );
    const demographics = new Set(
      profiles.map((profile) => `${profile.ageGroup}:${profile.genderPresentation}`),
    );

    expect(demographics).toEqual(
      new Set(["adult:male", "adult:female", "child:male", "child:female"]),
    );
    expect(
      profiles.filter((profile) => profile.ageGroup === "child")
        .every((profile) => profile.heightScale < 0.8),
    ).toBe(true);
  });

  it("always adds crown-covering hair and physical clothing geometry", () => {
    for (let index = 0; index < 8; index += 1) {
      const profile = characterProfileFor(0x1ead2026, index);
      const head = new Mesh(
        new SphereGeometry(0.27, 12, 8),
        new MeshBasicMaterial(),
      );
      decorateCharacterHead(head, profile);

      let hairPieces = 0;
      head.traverse((object) => {
        if (object.userData["sceneRole"] === "character-hair") hairPieces += 1;
      });
      expect(hairPieces).toBeGreaterThan(0);

      const root = new Group();
      const clothing = decorateCharacterClothing(root, profile);
      expect(clothing.userData["sceneRole"]).toBe("character-clothing");
      expect(clothing.children.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("changes character identity when the run seed changes", () => {
    expect(characterProfileFor(1, 4)).not.toEqual(characterProfileFor(2, 4));
  });
});
