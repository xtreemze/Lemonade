import { Group, Mesh, type Object3D, SphereGeometry } from "three";
import { describe, expect, it } from "vitest";

import {
  applyCharacterExpressionPose,
  characterIdentityFor,
  decorateCharacterBody,
  decorateCharacterHead,
  decorateSellerExpression,
} from "../src/character-detail.js";
import { characterProfileFor } from "../src/characters.js";

const sceneRole = (object: Object3D): string => {
  const role: unknown = object.userData["sceneRole"];
  return typeof role === "string" ? role : "";
};

describe("character geometry detail", () => {
  it("covers the crown with hair geometry and provides readable facial expression geometry", () => {
    for (let index = 0; index < 8; index += 1) {
      const profile = characterProfileFor(0x1e_ad_20_26, index);
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

  it("projects blink, gaze, brow, and mouth channels while preserving seeded baselines", () => {
    const profile = characterProfileFor(0x1e_ad_20_26, 3);
    const head = new Mesh(new SphereGeometry(0.27, 12, 8));
    decorateCharacterHead(head, profile, characterIdentityFor(3, profile));

    const faceObjects = head.children.filter(
      (child) => typeof child.userData["characterFacePart"] === "string",
    );
    const pupil = faceObjects.find((child) => child.userData["characterFacePart"] === "eye-pupil");
    const eyeWhite = faceObjects.find(
      (child) => child.userData["characterFacePart"] === "eye-white",
    );
    const brow = faceObjects.find((child) => child.userData["characterFacePart"] === "brow");
    const mouth = faceObjects.find((child) => child.userData["characterFacePart"] === "mouth");
    expect(pupil).toBeDefined();
    expect(eyeWhite).toBeDefined();
    expect(brow).toBeDefined();
    expect(mouth).toBeDefined();
    if (
      pupil === undefined ||
      eyeWhite === undefined ||
      brow === undefined ||
      mouth === undefined
    ) {
      return;
    }

    const pupilX = pupil.position.x;
    const pupilY = pupil.position.y;
    const eyeScaleY = eyeWhite.scale.y;
    const browRotation = brow.rotation.z;
    const mouthRotation = mouth.rotation.z;
    const mouthScaleY = mouth.scale.y;

    applyCharacterExpressionPose(head, {
      valence: 0.5,
      browTilt: 0.2,
      mouthCurve: 0.3,
      mouthOpen: 0.6,
      gazeX: 0.5,
      gazeY: -0.4,
      blink: 1,
    });

    expect(pupil.position.x).not.toBeCloseTo(pupilX);
    expect(pupil.position.y).not.toBeCloseTo(pupilY);
    expect(eyeWhite.scale.y).toBeLessThan(eyeScaleY * 0.2);
    expect(brow.rotation.z).not.toBeCloseTo(browRotation);
    expect(mouth.rotation.z).not.toBeCloseTo(mouthRotation);
    expect(mouth.scale.y).toBeGreaterThan(mouthScaleY);
  });

  it("keeps seller expression geometry on the shared live facial channels without duplicate seeded bars", () => {
    const profile = characterProfileFor(0x1e_ad_20_26, 10_001);
    const head = new Mesh(new SphereGeometry(0.27, 12, 8));
    decorateCharacterHead(head, profile, characterIdentityFor(10_001, profile), false);

    expect(head.children.filter((child) => sceneRole(child) === "face-expression")).toHaveLength(0);

    const eyebrows = [new Group(), new Group()] as const;
    const mouth = [new Group(), new Group()] as const;
    eyebrows[0].position.set(-0.085, 0.125, 0.235);
    eyebrows[1].position.set(0.085, 0.125, 0.235);
    mouth[0].position.set(-0.055, -0.09, 0.238);
    mouth[1].position.set(0.055, -0.09, 0.238);
    head.add(...eyebrows, ...mouth);
    decorateSellerExpression(eyebrows, mouth);

    expect(eyebrows[0].userData["characterFacePart"]).toBe("brow");
    expect(eyebrows[1].userData["characterFacePart"]).toBe("brow");
    expect(mouth[0].userData["characterFacePart"]).toBe("mouth");
    expect(mouth[1].userData["characterFacePart"]).toBe("mouth");
    expect(
      [...eyebrows, ...mouth].every((group) =>
        group.children.some((child) => sceneRole(child) === "face-expression"),
      ),
    ).toBe(true);
  });

  it("adds garment geometry beyond the base body for adults and children", () => {
    for (const index of [0, 1, 4, 5]) {
      const profile = characterProfileFor(0x1e_ad_20_26, index);
      const root = new Group();
      decorateCharacterBody(root, profile, characterIdentityFor(index, profile));
      const garments = root.children.filter((child) => sceneRole(child) === "garment-detail");
      expect(garments.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("adds deterministic bags without putting them on every adult", () => {
    let bagged = 0;
    let bagless = 0;
    for (let index = 0; index < 16; index += 1) {
      const profile = characterProfileFor(0x1e_ad_20_26, index);
      const root = new Group();
      const identity = characterIdentityFor(index, profile);
      decorateCharacterBody(root, profile, identity);
      const bags = root.children.filter((child) => sceneRole(child) === "character-bag");
      if (bags.length > 0) {
        bagged += 1;
      } else {
        bagless += 1;
      }
      if (identity.ageGroup === "child") {
        expect(bags.length).toBeGreaterThan(0);
      }
    }
    expect(bagged).toBeGreaterThan(4);
    expect(bagless).toBeGreaterThan(0);
  });
});
