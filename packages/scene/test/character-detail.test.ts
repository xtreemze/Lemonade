import { Group, Mesh, SphereGeometry, type Object3D } from "three";
import { describe, expect, it } from "vitest";

import {
  characterIdentityFor,
  decorateCharacterBody,
  decorateCharacterHead,
} from "../src/character-detail.js";
import { characterProfileFor } from "../src/characters.js";

const sceneRole = (object: Object3D): string => {
  const role: unknown = object.userData["sceneRole"];
  return typeof role === "string" ? role : "";
};

describe("character geometry detail", () => {
  it("covers the crown with hair geometry and provides readable facial expression geometry", () => {
    for (let index = 0; index < 8; index += 1) {
      const profile = characterProfileFor(0x1ead2026, index);
      const head = new Mesh(new SphereGeometry(0.27, 12, 8));
      decorateCharacterHead(head, profile, characterIdentityFor(index, profile));

      const roles = new Set(head.children.map(sceneRole));
      expect(roles.has("hair-cover")).toBe(true);
      expect(roles.has("hair-detail")).toBe(true);
      expect(roles.has("face-expression")).toBe(true);
      expect(roles.has("eye-white")).toBe(true);
      expect(roles.has("eye-pupil")).toBe(true);
    }
  });

  it("adds garment geometry beyond the base body for adults and children", () => {
    for (const index of [0, 1, 4, 5]) {
      const profile = characterProfileFor(0x1ead2026, index);
      const root = new Group();
      decorateCharacterBody(root, profile, characterIdentityFor(index, profile));
      const garments = root.children.filter(
        (child) => sceneRole(child) === "garment-detail",
      );
      expect(garments.length).toBeGreaterThanOrEqual(2);
      const clothingItems = root.children.filter(
        (child) => sceneRole(child) === "clothing-item",
      );
      expect(clothingItems.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("adds deterministic bags to a subset of seeded characters", () => {
    let bagged = 0;
    let unbagged = 0;
    for (let index = 0; index < 12; index += 1) {
      const profile = characterProfileFor(0x1ead2026, index);
      const root = new Group();
      decorateCharacterBody(root, profile, characterIdentityFor(index, profile));
      const bags = root.children.filter(
        (child) => sceneRole(child) === "bag-detail",
      );
      if (bags.length > 0) {
        bagged += 1;
        expect(bags.length).toBeGreaterThanOrEqual(2);
      } else {
        unbagged += 1;
      }
    }
    expect(bagged).toBeGreaterThan(0);
    expect(unbagged).toBeGreaterThan(0);
  });
});
