import {
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  type BufferGeometry,
} from "three";

import { CHARACTER_ANATOMY } from "./character-model.js";

export interface CharacterGeometrySet {
  readonly torso: BufferGeometry;
  readonly head: BufferGeometry;
  readonly armUpper: BufferGeometry;
  readonly armJoint: BufferGeometry;
  readonly armLower: BufferGeometry;
  readonly hand: BufferGeometry;
  readonly legUpper: BufferGeometry;
  readonly legJoint: BufferGeometry;
  readonly legLower: BufferGeometry;
  readonly foot: BufferGeometry;
}

export const createCharacterGeometrySet = (): CharacterGeometrySet =>
  Object.freeze({
    torso: new CylinderGeometry(
      0.25,
      0.34,
      CHARACTER_ANATOMY.torso.height,
      10,
    ),
    head: new SphereGeometry(CHARACTER_ANATOMY.head.radius, 12, 8),
    armUpper: new CylinderGeometry(
      0.082,
      0.082 * 0.94,
      CHARACTER_ANATOMY.arm.upperLength,
      8,
    ),
    armJoint: new SphereGeometry(0.082 * 1.14, 9, 6),
    armLower: new CylinderGeometry(
      0.082 * 0.92,
      0.082 * 0.82,
      CHARACTER_ANATOMY.arm.lowerLength,
      8,
    ),
    hand: new SphereGeometry(0.082 * 1.05, 9, 6),
    legUpper: new CylinderGeometry(
      0.105,
      0.105 * 0.94,
      CHARACTER_ANATOMY.leg.upperLength,
      8,
    ),
    legJoint: new SphereGeometry(0.105 * 1.14, 9, 6),
    legLower: new CylinderGeometry(
      0.105 * 0.92,
      0.105 * 0.82,
      CHARACTER_ANATOMY.leg.lowerLength,
      8,
    ),
    foot: new BoxGeometry(
      CHARACTER_ANATOMY.foot.width,
      CHARACTER_ANATOMY.foot.height,
      CHARACTER_ANATOMY.foot.length,
    ),
  });
