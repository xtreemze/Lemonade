import { describe, expect, it } from "vitest";

import { decorateCharacter } from "../src/character-detail.js";
import { createCharacterGeometrySet } from "../src/character-geometry.js";
import { seatedCharacterPose } from "../src/character-model.js";
import { applyThreeCharacterPose, createThreeCharacterRig } from "../src/character-rig.js";
import { WORLD_SCALE } from "../src/world-scale.js";

describe("shared Three procedural character rig", () => {
  it("uses the shared geometry and world-scale character profile", () => {
    const geometries = createCharacterGeometrySet();
    const rig = createThreeCharacterRig(geometries, 0x1e_ad_20_26, 7);

    expect(rig.torso.geometry).toBe(geometries.torso);
    expect(rig.head.geometry).toBe(geometries.head);
    expect(rig.arms[0].lower.children[0]).toBeDefined();
    expect(rig.legs[0].lower.children[0]).toBeDefined();
    expect(rig.root.userData["characterRig"]).toBe("shared-three");
    expect(rig.root.scale.y).toBeCloseTo(
      rig.profile.heightScale * WORLD_SCALE.character.renderScale,
    );
  });

  it("realizes the renderer-neutral pelvis, chest, and neck hierarchy", () => {
    const geometries = createCharacterGeometrySet();
    const rig = createThreeCharacterRig(geometries, 0x1e_ad_20_26, 7);

    expect(rig.poseRoot.parent).toBe(rig.root);
    expect(rig.pelvis.parent).toBe(rig.poseRoot);
    expect(rig.chest.parent).toBe(rig.pelvis);
    expect(rig.neck.parent).toBe(rig.chest);
    expect(rig.head.parent).toBe(rig.neck);
    expect(rig.arms[0].root.parent).toBe(rig.chest);
    expect(rig.legs[0].root.parent).toBe(rig.pelvis);
  });

  it("keeps procedural clothing on the articulated upper-body hierarchy", () => {
    const geometries = createCharacterGeometrySet();
    const rig = createThreeCharacterRig(geometries, 0x1e_ad_20_26, 7);

    decorateCharacter(rig.root, rig.head, rig.profile, 7);

    expect(rig.bodyDecorationRoot.parent).toBe(rig.chest);
    expect(
      rig.bodyDecorationRoot.children.some(
        (child) => child.userData["sceneRole"] === "garment-detail",
      ),
    ).toBe(true);
    expect(
      rig.root.children.some((child) => child.userData["sceneRole"] === "garment-detail"),
    ).toBe(false);
  });

  it("applies seated articulation without changing body scale", () => {
    const geometries = createCharacterGeometrySet();
    const rig = createThreeCharacterRig(geometries, 0x1e_ad_20_26, 10_101);
    const initialScale = rig.root.scale.clone();
    const pose = seatedCharacterPose("driver");

    applyThreeCharacterPose(rig, pose);

    expect(rig.root.scale.toArray()).toEqual(initialScale.toArray());
    expect(rig.pelvis.rotation.x).toBeCloseTo(pose.pelvis.rotation.x);
    expect(rig.chest.rotation.x).toBeCloseTo(pose.chest.rotation.x);
    expect(rig.neck.rotation.x).toBeCloseTo(pose.neck.rotation.x);
    expect(rig.arms[0].root.rotation.x).toBeCloseTo(pose.arms[0].shoulder.rotation.x);
    expect(rig.arms[0].lower.rotation.x).toBeCloseTo(pose.arms[0].elbow.rotation.x);
    expect(rig.arms[0].extremity.rotation.x).toBeCloseTo(pose.arms[0].wrist.rotation.x);
    expect(rig.legs[0].lower.rotation.x).toBeCloseTo(pose.legs[0].knee.rotation.x);
    expect(rig.legs[0].extremity.rotation.x).toBeCloseTo(pose.legs[0].ankle.rotation.x);
  });
});
