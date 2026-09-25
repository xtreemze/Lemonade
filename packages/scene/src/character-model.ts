import type { CharacterProfile } from "./characters.js";
import { walkingCycleAtDistance } from "./gait.js";
import { WORLD_SCALE } from "./world-scale.js";

export type Rotation3 = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type JointPose = Readonly<{
  rotation: Rotation3;
  lift: number;
}>;

export type ArmPose = Readonly<{
  shoulder: JointPose;
  elbow: JointPose;
  wrist: JointPose;
}>;

export type LegPose = Readonly<{
  hip: JointPose;
  knee: JointPose;
  ankle: JointPose;
}>;

export type CharacterExpressionPose = Readonly<{
  valence: number;
  browTilt: number;
  mouthCurve: number;
  mouthOpen: number;
  gazeX: number;
  gazeY: number;
  blink: number;
}>;

export type CharacterPose = Readonly<{
  root: Readonly<{
    lift: number;
    scale: number;
  }>;
  pelvis: JointPose;
  chest: JointPose;
  neck: JointPose;
  head: JointPose;
  arms: readonly [ArmPose, ArmPose];
  legs: readonly [LegPose, LegPose];
  expression: CharacterExpressionPose;
  rightHandOccupancy: "none" | "cup";
}>;

export type CharacterPoseOptions = Readonly<{
  moving?: boolean;
  carryingCup?: boolean;
}>;

export type SeatedCharacterKind = "driver" | "rider";

const rotation = (x = 0, y = 0, z = 0): Rotation3 => Object.freeze({ x, y, z });

const joint = (x = 0, y = 0, z = 0, lift = 0): JointPose =>
  Object.freeze({
    rotation: rotation(x, y, z),
    lift,
  });

const arm = (shoulder = joint(), elbow = joint(), wrist = joint()): ArmPose =>
  Object.freeze({ shoulder, elbow, wrist });

const leg = (hip = joint(), knee = joint(), ankle = joint()): LegPose =>
  Object.freeze({ hip, knee, ankle });

const expression = (values: Partial<CharacterExpressionPose> = {}): CharacterExpressionPose =>
  Object.freeze({
    valence: values.valence ?? 0,
    browTilt: values.browTilt ?? 0,
    mouthCurve: values.mouthCurve ?? 0,
    mouthOpen: values.mouthOpen ?? 0,
    gazeX: values.gazeX ?? 0,
    gazeY: values.gazeY ?? 0,
    blink: values.blink ?? 0,
  });

const createPose = (values: Partial<CharacterPose> = {}): CharacterPose =>
  Object.freeze({
    root: values.root ?? Object.freeze({ lift: 0, scale: 1 }),
    pelvis: values.pelvis ?? joint(),
    chest: values.chest ?? joint(),
    neck: values.neck ?? joint(),
    head: values.head ?? joint(),
    arms: values.arms ?? (Object.freeze([arm(), arm()]) as readonly [ArmPose, ArmPose]),
    legs: values.legs ?? (Object.freeze([leg(), leg()]) as readonly [LegPose, LegPose]),
    expression: values.expression ?? expression(),
    rightHandOccupancy: values.rightHandOccupancy ?? "none",
  });

export const CHARACTER_ANATOMY = Object.freeze({
  hierarchy: Object.freeze(["root", "pelvis", "chest", "neck", "head"] as const),
  modeledStandingHeight: WORLD_SCALE.character.modeledStandingHeight,
  renderScale: WORLD_SCALE.character.renderScale,
  torso: Object.freeze({
    height: 0.9,
    centerY: 1.05,
    shoulderY: 1.38,
    neckY: 1.52,
  }),
  head: Object.freeze({
    radius: 0.27,
    centerY: 1.78,
  }),
  arm: Object.freeze({
    shoulderOffsetX: 0.35,
    upperLength: 0.38,
    lowerLength: 0.34,
  }),
  leg: Object.freeze({
    hipOffsetX: 0.14,
    hipY: 0.72,
    upperLength: 0.43,
    lowerLength: 0.42,
  }),
  foot: Object.freeze({
    width: 0.105 * 2.1,
    height: 0.105 * 1.25,
    length: 0.105 * 3.2,
  }),
});

export const neutralCharacterPose = (): CharacterPose => createPose();

export const characterPoseAtDistance = (
  profile: CharacterProfile,
  travelDistance: number,
  options: CharacterPoseOptions = {},
): CharacterPose => {
  const moving = options.moving ?? true;
  const carryingCup = options.carryingCup ?? false;
  if (!(moving || carryingCup)) {
    return neutralCharacterPose();
  }

  if (!moving) {
    return createPose({
      arms: Object.freeze([arm(), arm(joint(-0.54), joint(-1.05), joint())]) as readonly [
        ArmPose,
        ArmPose,
      ],
      rightHandOccupancy: "cup",
    });
  }

  const cycle = walkingCycleAtDistance(
    travelDistance,
    profile.heightScale,
    profile.walkPace,
    profile.strideOffset,
  );
  const stride = Math.sin(cycle) * profile.gaitAmplitude;
  const oppositeStride = Math.sin(cycle + Math.PI) * profile.gaitAmplitude;
  const stance = Math.abs(Math.sin(cycle));
  const chestRoll = Math.sin(cycle * 0.5) * 0.035;

  const leftShoulder = -stride * 0.78;
  const rightShoulder = carryingCup ? -0.54 : stride * 0.78;
  const leftElbow = -0.12 - Math.max(0, stride) * 0.22;
  const rightElbow = carryingCup ? -1.05 : -0.12 - Math.max(0, -stride) * 0.22;
  const leftKnee = Math.max(0, -Math.sin(cycle)) * 0.62;
  const rightKnee = Math.max(0, Math.sin(cycle)) * 0.62;

  return createPose({
    chest: joint(0, Math.sin(cycle) * 0.028, chestRoll, stance * 0.026),
    head: joint(0, 0, -chestRoll * 0.42, stance * 0.018),
    arms: Object.freeze([
      arm(joint(leftShoulder), joint(leftElbow), joint()),
      arm(joint(rightShoulder), joint(rightElbow), joint()),
    ]) as readonly [ArmPose, ArmPose],
    legs: Object.freeze([
      leg(joint(stride), joint(leftKnee), joint(-leftKnee * 0.22)),
      leg(joint(oppositeStride), joint(rightKnee), joint(-rightKnee * 0.22)),
    ]) as readonly [LegPose, LegPose],
    rightHandOccupancy: carryingCup ? "cup" : "none",
  });
};

export const seatedCharacterPose = (kind: SeatedCharacterKind): CharacterPose => {
  if (kind === "rider") {
    return createPose({
      pelvis: joint(-0.12),
      chest: joint(-0.12),
      neck: joint(0.08),
      arms: Object.freeze([
        arm(joint(-0.92), joint(-0.58), joint(0.18)),
        arm(joint(-0.92), joint(-0.58), joint(-0.18)),
      ]) as readonly [ArmPose, ArmPose],
      legs: Object.freeze([
        leg(joint(0.82), joint(-1.0), joint(0.34)),
        leg(joint(-0.52), joint(0.88), joint(-0.28)),
      ]) as readonly [LegPose, LegPose],
    });
  }

  return createPose({
    pelvis: joint(-0.08),
    chest: joint(-0.04),
    neck: joint(0.06),
    arms: Object.freeze([
      arm(joint(-0.72), joint(-0.66), joint(0.12)),
      arm(joint(-0.72), joint(-0.66), joint(-0.12)),
    ]) as readonly [ArmPose, ArmPose],
    legs: Object.freeze([
      leg(joint(0.62), joint(-1.08), joint(0.42)),
      leg(joint(0.62), joint(-1.08), joint(0.42)),
    ]) as readonly [LegPose, LegPose],
  });
};

export type BuyerInteractionKind = "purchasing" | "drinking";

export const buyerInteractionPose = (kind: BuyerInteractionKind, index = 0): CharacterPose => {
  if (kind === "purchasing") {
    return createPose({
      chest: joint(0.07),
      head: joint(-0.04),
      arms: Object.freeze([
        arm(joint(-0.12), joint(), joint()),
        arm(joint(-0.88), joint(-1), joint()),
      ]) as readonly [ArmPose, ArmPose],
      expression: expression({
        browTilt: -0.08,
        gazeY: -0.04,
      }),
    });
  }

  const headRoll = Math.abs(Math.trunc(index)) % 2 === 0 ? -0.055 : 0.055;
  return createPose({
    chest: joint(-0.025),
    head: joint(0.14, 0, headRoll),
    arms: Object.freeze([arm(), arm(joint(-1.05), joint(-1.42), joint())]) as readonly [
      ArmPose,
      ArmPose,
    ],
    expression: expression({
      valence: 0.35,
      mouthCurve: 0.16,
      gazeY: 0.04,
    }),
    rightHandOccupancy: "cup",
  });
};

const clamp01 = (value: number): number =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const lerp = (low: number, high: number, progress: number): number => low + (high - low) * progress;

export const sellerConfidencePose = (confidence: number): CharacterPose => {
  const progress = clamp01(confidence / 5);
  const valence = progress * 2 - 1;
  const armSpread = lerp(0.06, 0.5, progress);

  return createPose({
    chest: joint(lerp(0.17, -0.025, progress), 0, 0, lerp(-0.035, 0.055, progress)),
    head: joint(lerp(0.2, -0.06, progress)),
    arms: Object.freeze([
      arm(joint(lerp(0.28, -0.18, progress), 0, -armSpread), joint(), joint()),
      arm(joint(lerp(0.22, -0.14, progress), 0, armSpread), joint(), joint()),
    ]) as readonly [ArmPose, ArmPose],
    expression: expression({
      valence,
      browTilt: valence * 0.26,
      mouthCurve: valence * 0.46,
      gazeY: lerp(-0.04, 0.02, progress),
    }),
  });
};

export const blinkAmountAt = (identitySeed: number, elapsedMs: number): number => {
  const seed = Number.isFinite(identitySeed) ? Math.abs(Math.trunc(identitySeed)) >>> 0 : 0;
  const intervalMs = 2600 + (seed % 1700);
  const offsetMs = (seed >>> 8) % intervalMs;
  const phase = (Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0) + offsetMs) % intervalMs;
  const durationMs = 160;
  const startMs = intervalMs - durationMs;
  if (phase < startMs) {
    return 0;
  }
  const progress = (phase - startMs) / durationMs;
  return clamp01(progress <= 0.5 ? progress * 2 : (1 - progress) * 2);
};
