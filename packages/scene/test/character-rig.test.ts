import { describe, expect, it } from "vitest";

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
    expect(rig.root.userData.characterRig).toBe("shared-three");
    expect(rig.root.scale.y).toBeCloseTo(
      rig.profile.heightScale * WORLD_SCALE.character.renderScale,
    );
  });

  it("applies seated articulation without changing body scale", () => {
    const geometries = createCharacterGeometrySet();
    const rig = createThreeCharacterRig(geometries, 0x1e_ad_20_26, 10_101);
    const initialScale = rig.root.scale.clone();
    const pose = seatedCharacterPose("driver");

    applyThreeCharacterPose(rig, pose);

    expect(rig.root.scale.toArray()).toEqual(initialScale.toArray());
    expect(rig.arms[0].root.rotation.x).toBeCloseTo(pose.arms[0].shoulder.rotation.x);
    expect(rig.arms[0].lower.rotation.x).toBeCloseTo(pose.arms[0].elbow.rotation.x);
    expect(rig.arms[0].extremity.rotation.x).toBeCloseTo(pose.arms[0].wrist.rotation.x);
    expect(rig.legs[0].lower.rotation.x).toBeCloseTo(pose.legs[0].knee.rotation.x);
    expect(rig.legs[0].extremity.rotation.x).toBeCloseTo(pose.legs[0].ankle.rotation.x);
  });
});
