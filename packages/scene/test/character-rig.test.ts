import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { decorateCharacter } from "../src/character-detail.js";
import { createCharacterGeometrySet } from "../src/character-geometry.js";
import { neutralCharacterPose, seatedCharacterPose } from "../src/character-model.js";
import {
  applyThreeCharacterPose,
  characterRotationYForRouteYaw,
  createThreeCharacterRig,
  rebindThreeCharacterRig,
} from "../src/character-rig.js";
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

  it("implements the renderer-neutral root, pelvis, chest, neck, and head hierarchy", () => {
    const geometries = createCharacterGeometrySet();
    const rig = createThreeCharacterRig(geometries, 0x1e_ad_20_26, 7);

    expect(rig.poseRoot.parent).toBe(rig.root);
    expect(rig.pelvis.parent).toBe(rig.poseRoot);
    expect(rig.chest.parent).toBe(rig.pelvis);
    expect(rig.neck.parent).toBe(rig.chest);
    expect(rig.headPivot.parent).toBe(rig.neck);
    expect(rig.head.parent).toBe(rig.headPivot);
    expect(rig.torso.parent).toBe(rig.chest);
    expect(rig.arms[0].root.parent).toBe(rig.chest);
    expect(rig.arms[1].root.parent).toBe(rig.chest);
    expect(rig.legs[0].root.parent).toBe(rig.pelvis);
    expect(rig.legs[1].root.parent).toBe(rig.pelvis);
  });

  it("keeps procedural body detail attached to the articulated chest", () => {
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


  it("binds different pool slots to the same authoritative visual identity", () => {
    const geometries = createCharacterGeometrySet();
    const left = createThreeCharacterRig(geometries, 0x1e_ad_20_26, 2);
    const right = createThreeCharacterRig(geometries, 0x1e_ad_20_26, 19);

    const leftBinding = rebindThreeCharacterRig(left, 0x7a_31_92_f0);
    const rightBinding = rebindThreeCharacterRig(right, 0x7a_31_92_f0);

    expect(leftBinding).toEqual(rightBinding);
    expect(left.profile).toEqual(right.profile);
    expect(left.root.scale.toArray()).toEqual(right.root.scale.toArray());
    expect(left.head.scale.toArray()).toEqual(right.head.scale.toArray());
    expect(left.root.userData["authoritativeVisualSeed"]).toBe(0x7a_31_92_f0);
    expect(right.root.userData["authoritativeVisualSeed"]).toBe(0x7a_31_92_f0);
  });

  it("replaces identity decoration instead of accumulating it when a pooled rig is rebound", () => {
    const geometries = createCharacterGeometrySet();
    const rig = createThreeCharacterRig(geometries, 0x1e_ad_20_26, 7);

    rebindThreeCharacterRig(rig, 101);
    const firstHeadChildren = rig.head.children.length;
    const firstBodyChildren = rig.bodyDecorationRoot.children.length;
    const firstProfile = rig.profile;

    rebindThreeCharacterRig(rig, 202);
    const secondHeadChildren = rig.head.children.length;
    const secondBodyChildren = rig.bodyDecorationRoot.children.length;
    const secondProfile = rig.profile;

    expect(secondProfile).not.toEqual(firstProfile);
    expect(secondHeadChildren).toBeGreaterThan(0);
    expect(secondBodyChildren).toBeGreaterThan(0);
    expect(secondHeadChildren).toBeLessThanOrEqual(firstHeadChildren + 6);
    expect(secondBodyChildren).toBeLessThanOrEqual(firstBodyChildren + 6);

    const replay = rebindThreeCharacterRig(rig, 202);
    expect(replay.profile).toEqual(secondProfile);
    expect(rig.head.children).toHaveLength(secondHeadChildren);
    expect(rig.bodyDecorationRoot.children).toHaveLength(secondBodyChildren);
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
    expect(rig.headPivot.rotation.x).toBeCloseTo(pose.head.rotation.x);
    expect(rig.arms[0].root.rotation.x).toBeCloseTo(pose.arms[0].shoulder.rotation.x);
    expect(rig.arms[0].lower.rotation.x).toBeCloseTo(pose.arms[0].elbow.rotation.x);
    expect(rig.arms[0].extremity.rotation.x).toBeCloseTo(pose.arms[0].wrist.rotation.x);
    expect(rig.legs[0].lower.rotation.x).toBeCloseTo(pose.legs[0].knee.rotation.x);
    expect(rig.legs[0].extremity.rotation.x).toBeCloseTo(pose.legs[0].ankle.rotation.x);
  });

  it("keeps world placement separate from semantic root lift and scale", () => {
    const geometries = createCharacterGeometrySet();
    const rig = createThreeCharacterRig(geometries, 0x1e_ad_20_26, 7);
    rig.root.position.set(4, 0.18, -3);
    const neutral = neutralCharacterPose();
    const pose = Object.freeze({
      ...neutral,
      root: Object.freeze({ lift: 0.12, scale: 0.94 }),
    });

    applyThreeCharacterPose(rig, pose);

    expect(rig.root.position.toArray()).toEqual([4, 0.18, -3]);
    expect(rig.poseRoot.position.y).toBeCloseTo(0.12);
    expect(rig.poseRoot.scale.toArray()).toEqual([0.94, 0.94, 0.94]);
  });

  it("converts +X-based route yaw into the character model's +Z forward convention", () => {
    const up = new Vector3(0, 1, 0);
    for (const routeYaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const forward = new Vector3(0, 0, 1).applyAxisAngle(
        up,
        characterRotationYForRouteYaw(routeYaw),
      );
      expect(forward.x).toBeCloseTo(Math.cos(routeYaw));
      expect(forward.z).toBeCloseTo(Math.sin(routeYaw));
    }
  });
});
