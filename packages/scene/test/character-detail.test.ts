import { Group, Mesh, SphereGeometry } from "three";
import { describe, expect, it } from "vitest";

import {
  decorateCharacterBody,
  decorateCharacterHead,
} from "../src/character-detail.js";
import { characterProfileFor } from "../src/characters.js";

describe("character geometry detail", () => {
  it("covers the crown with hair geometry and provides readable facial expression geometry", () => {
    for (let index = 0; index < 8; index += 1) {
      const profile = characterProfileFor(0x1ead2026, index);
      const head = new Mesh(new SphereGeometry(0.27, 12, 8));
      decorateCharacterHead(head, profile);

      const roles = new Set(head.children.map((child) => child.userData["sceneRole"]));
      expect(roles.has("hair-cover")).toBe(true);
      expect(roles.has("face-expression")).toBe(true);
      expect(roles.has("eye-white")).toBe(true);
      expect(roles.has("eye-pupil")).toBe(true);
    }
  });

  it("adds garment geometry beyond the base body for adults and children", () => {
    for (const index of [0, 1, 4, 5]) {
      const profile = characterProfileFor(0x1ead2026, index);
      const root = new Group();
      decorateCharacterBody(root, profile);
      const garments = root.children.filter(
        (child) => child.userData["sceneRole"] === "garment-detail",
      );
      expect(garments.length).toBeGreaterThanOrEqual(2);
    }
  });
});
