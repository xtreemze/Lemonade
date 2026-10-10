import { Group, Mesh, MeshStandardMaterial } from "three";
import { clearCharacterDecorations, decorateCharacter } from "./character-detail.js";
import type { CharacterGeometrySet } from "./character-geometry.js";
import { CHARACTER_ANATOMY, type CharacterPose } from "./character-model.js";
import {
  characterIdentityIndexForVisualSeed,
  type CharacterProfile,
  characterProfileFor,
  characterProfileForVisualSeed,
} from "./characters.js";
import { WORLD_SCALE } from "./world-scale.js";

export type LimbRig = Readonly<{
  root: Group;
  upper: Mesh;
  joint: Mesh;
  lower: Group;
  lowerMesh: Mesh;
  extremity: Mesh;
}>;

export type ThreeCharacterRig = Readonly<{
  root: Group;
  poseRoot: Group;
  pelvis: Group;
  chest: Group;
  neck: Group;
  headPivot: Group;
  bodyDecorationRoot: Group;
  torso: Mesh;
  head: Mesh;
  arms: readonly [LimbRig, LimbRig];
  legs: readonly [LimbRig, LimbRig];
  profile: CharacterProfile;
}>;

const PELVIS_Y = CHARACTER_ANATOMY.leg.hipY;
const CHEST_Y = CHARACTER_ANATOMY.torso.centerY - PELVIS_Y;
const NECK_Y = CHARACTER_ANATOMY.torso.neckY - CHARACTER_ANATOMY.torso.centerY;
const HEAD_Y = CHARACTER_ANATOMY.head.centerY - CHARACTER_ANATOMY.torso.neckY;
const SHOULDER_Y = CHARACTER_ANATOMY.torso.shoulderY - CHARACTER_ANATOMY.torso.centerY;
const BODY_DECORATION_Y = -CHARACTER_ANATOMY.torso.centerY;
const BASE_HEAD_SCALE = Object.freeze([0.94, 1.04, 0.9] as const);
const SHOE_COLOR = 0x30_38_3d;

type MutableVisualState = {
  profile: CharacterProfile;
};

// The root is stable even when the scene composes a frozen person wrapper.
const visualStateByRig = new WeakMap<Group, MutableVisualState>();

export const characterRotationYForRouteYaw = (routeYaw: number): number =>
  Math.PI / 2 - (Number.isFinite(routeYaw) ? routeYaw : 0);

const material = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({
    color,
    flatShading: false,
    roughness: 0.88,
  });

const createLimb = (
  geometries: CharacterGeometrySet,
  upperLength: number,
  lowerLength: number,
  upperColor: number,
  lowerColor: number,
  extremityColor: number,
  foot = false,
): LimbRig => {
  const root = new Group();

  const upper = new Mesh(foot ? geometries.legUpper : geometries.armUpper, material(upperColor));
  upper.position.y = -upperLength / 2;
  root.add(upper);

  const joint = new Mesh(foot ? geometries.legJoint : geometries.armJoint, material(lowerColor));
  joint.position.y = -upperLength;
  root.add(joint);

  const lower = new Group();
  lower.position.y = -upperLength;
  const lowerMesh = new Mesh(
    foot ? geometries.legLower : geometries.armLower,
    material(lowerColor),
  );
  lowerMesh.position.y = -lowerLength / 2;
  lower.add(lowerMesh);

  const extremity = new Mesh(foot ? geometries.foot : geometries.hand, material(extremityColor));
  extremity.position.set(0, -lowerLength, foot ? CHARACTER_ANATOMY.foot.height * 0.5 : 0);
  lower.add(extremity);
  root.add(lower);

  return Object.freeze({ root, upper, joint, lower, lowerMesh, extremity });
};

export const createThreeCharacterRig = (
  geometries: CharacterGeometrySet,
  characterSeed: number,
  index: number,
): ThreeCharacterRig => {
  const profile = characterProfileFor(characterSeed, index);
  const root = new Group();
  root.userData["characterRig"] = "shared-three";
  root.userData["characterProfileIndex"] = index;

  const poseRoot = new Group();
  const pelvis = new Group();
  const chest = new Group();
  const neck = new Group();
  const headPivot = new Group();
  const bodyDecorationRoot = new Group();
  bodyDecorationRoot.userData["characterBodyDecorationAnchor"] = true;

  pelvis.position.y = PELVIS_Y;
  chest.position.y = CHEST_Y;
  neck.position.y = NECK_Y;
  headPivot.position.y = HEAD_Y;
  bodyDecorationRoot.position.y = BODY_DECORATION_Y;

  root.add(poseRoot);
  poseRoot.add(pelvis);
  pelvis.add(chest);
  chest.add(neck, bodyDecorationRoot);
  neck.add(headPivot);

  const torso = new Mesh(geometries.torso, material(profile.clothingColor));
  chest.add(torso);

  const head = new Mesh(geometries.head, material(profile.skinColor));
  head.scale.set(...BASE_HEAD_SCALE);
  headPivot.add(head);

  const leftArm = createLimb(
    geometries,
    CHARACTER_ANATOMY.arm.upperLength,
    CHARACTER_ANATOMY.arm.lowerLength,
    profile.clothingColor,
    profile.skinColor,
    profile.skinColor,
  );
  const rightArm = createLimb(
    geometries,
    CHARACTER_ANATOMY.arm.upperLength,
    CHARACTER_ANATOMY.arm.lowerLength,
    profile.clothingColor,
    profile.skinColor,
    profile.skinColor,
  );
  leftArm.root.position.set(-CHARACTER_ANATOMY.arm.shoulderOffsetX, SHOULDER_Y, 0);
  rightArm.root.position.set(CHARACTER_ANATOMY.arm.shoulderOffsetX, SHOULDER_Y, 0);
  chest.add(leftArm.root, rightArm.root);

  const leftLeg = createLimb(
    geometries,
    CHARACTER_ANATOMY.leg.upperLength,
    CHARACTER_ANATOMY.leg.lowerLength,
    profile.trouserColor,
    profile.trouserColor,
    SHOE_COLOR,
    true,
  );
  const rightLeg = createLimb(
    geometries,
    CHARACTER_ANATOMY.leg.upperLength,
    CHARACTER_ANATOMY.leg.lowerLength,
    profile.trouserColor,
    profile.trouserColor,
    SHOE_COLOR,
    true,
  );
  leftLeg.root.position.set(-CHARACTER_ANATOMY.leg.hipOffsetX, 0, 0);
  rightLeg.root.position.set(CHARACTER_ANATOMY.leg.hipOffsetX, 0, 0);
  pelvis.add(leftLeg.root, rightLeg.root);

  root.scale.set(
    profile.widthScale * WORLD_SCALE.character.renderScale,
    profile.heightScale * WORLD_SCALE.character.renderScale,
    profile.widthScale * WORLD_SCALE.character.renderScale,
  );

  const visualState: MutableVisualState = { profile };
  const rig: ThreeCharacterRig = Object.freeze({
    root,
    poseRoot,
    pelvis,
    chest,
    neck,
    headPivot,
    bodyDecorationRoot,
    torso,
    head,
    arms: [leftArm, rightArm] as const,
    legs: [leftLeg, rightLeg] as const,
    get profile(): CharacterProfile {
      return visualState.profile;
    },
  });
  visualStateByRig.set(rig.root, visualState);
  return rig;
};

const setMeshColor = (mesh: Mesh, color: number): void => {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const entry of materials) {
    if (entry instanceof MeshStandardMaterial) {
      entry.color.setHex(color);
    }
  }
};

const applyCoreProfile = (rig: ThreeCharacterRig, profile: CharacterProfile): void => {
  setMeshColor(rig.torso, profile.clothingColor);
  setMeshColor(rig.head, profile.skinColor);

  for (const arm of rig.arms) {
    setMeshColor(arm.upper, profile.clothingColor);
    setMeshColor(arm.joint, profile.skinColor);
    setMeshColor(arm.lowerMesh, profile.skinColor);
    setMeshColor(arm.extremity, profile.skinColor);
  }

  for (const leg of rig.legs) {
    setMeshColor(leg.upper, profile.trouserColor);
    setMeshColor(leg.joint, profile.trouserColor);
    setMeshColor(leg.lowerMesh, profile.trouserColor);
    setMeshColor(leg.extremity, SHOE_COLOR);
  }

  rig.root.scale.set(
    profile.widthScale * WORLD_SCALE.character.renderScale,
    profile.heightScale * WORLD_SCALE.character.renderScale,
    profile.widthScale * WORLD_SCALE.character.renderScale,
  );
  rig.head.scale.set(...BASE_HEAD_SCALE);
};

export type CharacterVisualBinding = Readonly<{
  visualSeed: number;
  identityIndex: number;
  profile: CharacterProfile;
}>;

export const rebindThreeCharacterRig = (
  rig: ThreeCharacterRig,
  visualSeedValue: number,
): CharacterVisualBinding => {
  const visualSeed = (Number.isFinite(visualSeedValue) ? Math.trunc(visualSeedValue) : 0) >>> 0;
  const visualState = visualStateByRig.get(rig.root);
  if (visualState === undefined) {
    throw new TypeError("character rig was not created by createThreeCharacterRig");
  }

  const identityIndex = characterIdentityIndexForVisualSeed(visualSeed);
  const currentSeed: unknown = rig.root.userData["authoritativeVisualSeed"];
  if (currentSeed === visualSeed && rig.root.userData["characterDecorated"] === true) {
    return Object.freeze({
      visualSeed,
      identityIndex,
      profile: visualState.profile,
    });
  }

  clearCharacterDecorations(rig.root, rig.head);
  const profile = characterProfileForVisualSeed(visualSeed);
  visualState.profile = profile;
  applyCoreProfile(rig, profile);
  rig.root.userData["authoritativeVisualSeed"] = visualSeed;
  rig.root.userData["characterProfileIndex"] = identityIndex;
  decorateCharacter(rig.root, rig.head, profile, identityIndex);

  return Object.freeze({ visualSeed, identityIndex, profile });
};

export const resetThreeCharacterPose = (rig: ThreeCharacterRig): void => {
  rig.poseRoot.position.set(0, 0, 0);
  rig.poseRoot.rotation.set(0, 0, 0);
  rig.poseRoot.scale.set(1, 1, 1);

  rig.pelvis.position.set(0, PELVIS_Y, 0);
  rig.pelvis.rotation.set(0, 0, 0);
  rig.chest.position.set(0, CHEST_Y, 0);
  rig.chest.rotation.set(0, 0, 0);
  rig.neck.position.set(0, NECK_Y, 0);
  rig.neck.rotation.set(0, 0, 0);
  rig.headPivot.position.set(0, HEAD_Y, 0);
  rig.headPivot.rotation.set(0, 0, 0);

  rig.torso.position.set(0, 0, 0);
  rig.torso.rotation.set(0, 0, 0);
  rig.head.position.set(0, 0, 0);
  rig.head.rotation.set(0, 0, 0);

  for (const limb of [...rig.arms, ...rig.legs]) {
    limb.root.rotation.set(0, 0, 0);
    limb.lower.rotation.set(0, 0, 0);
    limb.extremity.rotation.set(0, 0, 0);
  }
};

export const applyThreeCharacterPose = (rig: ThreeCharacterRig, pose: CharacterPose): void => {
  resetThreeCharacterPose(rig);

  rig.poseRoot.position.y = pose.root.lift;
  rig.poseRoot.scale.setScalar(pose.root.scale);

  rig.pelvis.position.y = PELVIS_Y + pose.pelvis.lift;
  rig.pelvis.rotation.set(pose.pelvis.rotation.x, pose.pelvis.rotation.y, pose.pelvis.rotation.z);
  rig.chest.position.y = CHEST_Y + pose.chest.lift;
  rig.chest.rotation.set(pose.chest.rotation.x, pose.chest.rotation.y, pose.chest.rotation.z);
  rig.neck.position.y = NECK_Y + pose.neck.lift;
  rig.neck.rotation.set(pose.neck.rotation.x, pose.neck.rotation.y, pose.neck.rotation.z);
  rig.headPivot.position.y = HEAD_Y + pose.head.lift;
  rig.headPivot.rotation.set(pose.head.rotation.x, pose.head.rotation.y, pose.head.rotation.z);

  for (const index of [0, 1] as const) {
    const armPose = pose.arms[index];
    rig.arms[index].root.rotation.set(
      armPose.shoulder.rotation.x,
      armPose.shoulder.rotation.y,
      armPose.shoulder.rotation.z,
    );
    rig.arms[index].lower.rotation.set(
      armPose.elbow.rotation.x,
      armPose.elbow.rotation.y,
      armPose.elbow.rotation.z,
    );
    rig.arms[index].extremity.rotation.set(
      armPose.wrist.rotation.x,
      armPose.wrist.rotation.y,
      armPose.wrist.rotation.z,
    );

    const legPose = pose.legs[index];
    rig.legs[index].root.rotation.set(
      legPose.hip.rotation.x,
      legPose.hip.rotation.y,
      legPose.hip.rotation.z,
    );
    rig.legs[index].lower.rotation.set(
      legPose.knee.rotation.x,
      legPose.knee.rotation.y,
      legPose.knee.rotation.z,
    );
    rig.legs[index].extremity.rotation.set(
      legPose.ankle.rotation.x,
      legPose.ankle.rotation.y,
      legPose.ankle.rotation.z,
    );
  }
};
