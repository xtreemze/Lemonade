import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

import type { StreetStripSpec } from "./street-layout.js";

export interface StreetSurfaceField {
  readonly anchors: readonly Group[];
  readonly meshes: readonly InstancedMesh[];
}

const material = (color: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, flatShading: true, roughness: 0.92 });

const createAnchor = (strip: StreetStripSpec): Group => {
  const anchor = new Group();
  anchor.position.set(strip.x, strip.role === "sidewalk" ? 0.022 : 0.012, strip.z);
  anchor.rotation.y = -strip.rotationY;
  anchor.userData.sceneRole = strip.role;
  anchor.userData.streetId = strip.streetId;
  anchor.userData.streetSegment = strip.segmentIndex;
  return anchor;
};

const createBatch = (
  name: string,
  strips: readonly StreetStripSpec[],
  color: number,
): InstancedMesh | null => {
  if (strips.length === 0) {
    return null;
  }

  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), material(color), strips.length);
  mesh.name = name;
  mesh.userData.sceneRole = "street-surface-batch";

  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  const up = new Vector3(0, 1, 0);

  strips.forEach((strip, index) => {
    position.set(strip.x, strip.role === "sidewalk" ? 0.022 : 0.012, strip.z);
    rotation.setFromAxisAngle(up, -strip.rotationY);
    scale.set(strip.length, 0.022, strip.width);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
};

export const createStreetSurfaceField = (
  roads: readonly StreetStripSpec[],
  sidewalks: readonly StreetStripSpec[],
): StreetSurfaceField => {
  const mainRoads = roads.filter((strip) => strip.streetId === "main");
  const otherRoads = roads.filter((strip) => strip.streetId !== "main");
  const meshes = [
    createBatch("MainRoadSurfaces", mainRoads, 0x59_60_65),
    createBatch("RoadSurfaces", otherRoads, 0x62_68_6b),
    createBatch("SidewalkSurfaces", sidewalks, 0xd4_d0_c6),
  ].filter((mesh): mesh is InstancedMesh => mesh !== null);

  return Object.freeze({
    anchors: Object.freeze([...roads, ...sidewalks].map(createAnchor)),
    meshes: Object.freeze(meshes),
  });
};
