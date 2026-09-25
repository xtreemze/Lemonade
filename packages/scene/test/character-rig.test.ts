import { describe, expect, it } from "vitest";

import { createCharacterGeometrySet } from "../src/character-geometry.js";
import { neutralCharacterPose, seatedCharacterPose } from "../src/character-model.js";
import {
  applyThreeCharacterPose,
  characterRotationYForRouteYaw,
  createThreeCharacterRig,
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
    expect(characterRotationYForRouteYaw(0)).toBeCloseTo(Math.PI / 2);
    expect(characterRotationYForRouteYaw(Math.PI / 2)).toBeCloseTo(0);
    expect(characterRotationYForRouteYaw(Math.PI)).toBeCloseTo(-Math.PI / 2);
  });
});
