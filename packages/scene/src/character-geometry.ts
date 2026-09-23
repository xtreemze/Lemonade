import {
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  type BufferGeometry,
} from "three";

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
    torso: new CylinderGeometry(0.25, 0.34, 0.9, 10),
    head: new SphereGeometry(0.27, 12, 8),
    armUpper: new CylinderGeometry(0.082, 0.082 * 0.94, 0.38, 8),
    armJoint: new SphereGeometry(0.082 * 1.14, 9, 6),
    armLower: new CylinderGeometry(0.082 * 0.92, 0.082 * 0.82, 0.34, 8),
    hand: new SphereGeometry(0.082 * 1.05, 9, 6),
    legUpper: new CylinderGeometry(0.105, 0.105 * 0.94, 0.43, 8),
    legJoint: new SphereGeometry(0.105 * 1.14, 9, 6),
    legLower: new CylinderGeometry(0.105 * 0.92, 0.105 * 0.82, 0.42, 8),
    foot: new BoxGeometry(0.105 * 2.1, 0.105 * 1.25, 0.105 * 3.2),
  });
