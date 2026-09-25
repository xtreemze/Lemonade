import { describe, expect, it } from "vitest";

import {
  blinkAmountAt,
  buyerInteractionPose,
  CHARACTER_ANATOMY,
  characterPoseAtDistance,
  neutralCharacterPose,
  seatedCharacterPose,
  sellerConfidencePose,
} from "../src/character-model.js";
import { characterProfileFor } from "../src/characters.js";
import { WORLD_SCALE } from "../src/world-scale.js";

describe("renderer-neutral character model", () => {
  it("defines one articulated anatomy contract from the shared world scale", () => {
    expect(CHARACTER_ANATOMY.hierarchy).toEqual(["root", "pelvis", "chest", "neck", "head"]);
    expect(CHARACTER_ANATOMY.modeledStandingHeight).toBe(
      WORLD_SCALE.character.modeledStandingHeight,
    );
    expect(CHARACTER_ANATOMY.renderScale).toBe(WORLD_SCALE.character.renderScale);
    expect(CHARACTER_ANATOMY.arm.upperLength).toBeGreaterThan(0);
    expect(CHARACTER_ANATOMY.arm.lowerLength).toBeGreaterThan(0);
    expect(CHARACTER_ANATOMY.leg.upperLength).toBeGreaterThan(0);
    expect(CHARACTER_ANATOMY.leg.lowerLength).toBeGreaterThan(0);
    expect(CHARACTER_ANATOMY.foot.length).toBeGreaterThan(0);
  });

  it("drives walking pose from physical travel distance and stable identity", () => {
    const profile = characterProfileFor(0x1e_ad_20_26, 7);
    const first = characterPoseAtDistance(profile, 1.25);
    const repeated = characterPoseAtDistance(profile, 1.25);
    const later = characterPoseAtDistance(profile, 1.55);

    expect(repeated).toEqual(first);
    expect(later).not.toEqual(first);
    expect(first.root.scale).toBe(1);
    expect(first.legs[0].hip.rotation.x).not.toBe(first.legs[1].hip.rotation.x);
  });

  it("does not advance gait for an explicitly stationary actor", () => {
    const profile = characterProfileFor(0x1e_ad_20_26, 3);
    const first = characterPoseAtDistance(profile, 1.2, {
      moving: false,
    });
    const later = characterPoseAtDistance(profile, 9.8, {
      moving: false,
    });

    expect(later).toEqual(first);
    expect(first).toEqual(neutralCharacterPose());
  });

  it("represents seated driver and rider articulation without shrinking the body", () => {
    const driver = seatedCharacterPose("driver");
    const rider = seatedCharacterPose("rider");

    expect(driver.root.scale).toBe(1);
    expect(rider.root.scale).toBe(1);
    expect(Math.abs(driver.legs[0].knee.rotation.x)).toBeGreaterThan(0);
    expect(Math.abs(driver.legs[0].ankle.rotation.x)).toBeGreaterThan(0);
    expect(Math.abs(rider.arms[0].elbow.rotation.x)).toBeGreaterThan(0);
    expect(Math.abs(rider.arms[0].wrist.rotation.x)).toBeGreaterThan(0);
  });

  it("models purchase and drinking poses through shared articulation", () => {
    const purchasing = buyerInteractionPose("purchasing", 3);
    const drinking = buyerInteractionPose("drinking", 4);

    expect(purchasing.rightHandOccupancy).toBe("none");
    expect(purchasing.chest.rotation.x).toBeGreaterThan(0);
    expect(purchasing.arms[1].elbow.rotation.x).toBeLessThan(-0.9);
    expect(drinking.rightHandOccupancy).toBe("cup");
    expect(drinking.head.rotation.x).toBeGreaterThan(0);
    expect(Math.abs(drinking.head.rotation.z)).toBeGreaterThan(0);
    expect(drinking.expression.valence).toBeGreaterThan(0);
  });

  it("maps seller confidence through the same body and expression channels", () => {
    const low = sellerConfidencePose(0);
    const high = sellerConfidencePose(5);

    expect(low.expression.valence).toBe(-1);
    expect(high.expression.valence).toBe(1);
    expect(low.head.rotation.x).toBeGreaterThan(high.head.rotation.x);
    expect(low.expression.mouthCurve).toBeLessThan(high.expression.mouthCurve);
    expect(Math.abs(high.arms[0].shoulder.rotation.z)).toBeGreaterThan(
      Math.abs(low.arms[0].shoulder.rotation.z),
    );
  });

  it("uses deterministic bounded blink timing", () => {
    const first = Array.from({ length: 400 }, (_, index) => blinkAmountAt(0x51_a7, index * 25));
    const repeated = Array.from({ length: 400 }, (_, index) => blinkAmountAt(0x51_a7, index * 25));

    expect(repeated).toEqual(first);
    expect(first.every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(first.some((value) => value > 0.5)).toBe(true);
  });
});
