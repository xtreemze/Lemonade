import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

export type PropertyAccessRole = "driveway" | "front-path";

export type PropertyAccessSurfaceSpec = Readonly<{
  role: PropertyAccessRole;
  length: number;
  width: number;
  x: number;
  z: number;
  rotationY: number;
}>;

export interface PropertyAccessSurfaceField {
  readonly anchors: readonly Group[];
  readonly meshes: readonly InstancedMesh[];
}

const roleConfig = (role: PropertyAccessRole): Readonly<{ color: number; y: number }> =>
  role === "driveway"
    ? Object.freeze({ color: 0xc9_b9_95, y: 0.019 })
    : Object.freeze({ color: 0xd8_c9_aa, y: 0.021 });

const createAnchor = (spec: PropertyAccessSurfaceSpec): Group => {
  const { y } = roleConfig(spec.role);
  const anchor = new Group();
  anchor.position.set(spec.x, y, spec.z);
  anchor.rotation.y = -spec.rotationY;
  anchor.userData.sceneRole = spec.role;
  return anchor;
};

const createBatch = (
  role: PropertyAccessRole,
  specs: readonly PropertyAccessSurfaceSpec[],
): InstancedMesh | null => {
  if (specs.length === 0) {
    return null;
  }
  const { color, y } = roleConfig(role);
  const mesh = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.92,
    }),
    specs.length,
  );
  mesh.name = role === "driveway" ? "DrivewaySurfaces" : "FrontPathSurfaces";
  mesh.userData.sceneRole = "property-access-surface-batch";

  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  const up = new Vector3(0, 1, 0);
  specs.forEach((spec, index) => {
    position.set(spec.x, y, spec.z);
    rotation.setFromAxisAngle(up, -spec.rotationY);
    scale.set(spec.length, 0.018, spec.width);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
};

export const createPropertyAccessSurfaceField = (
  specs: readonly PropertyAccessSurfaceSpec[],
): PropertyAccessSurfaceField => {
  const driveways = specs.filter((spec) => spec.role === "driveway");
  const paths = specs.filter((spec) => spec.role === "front-path");
  const meshes = [createBatch("driveway", driveways), createBatch("front-path", paths)].filter(
    (mesh): mesh is InstancedMesh => mesh !== null,
  );

  return Object.freeze({
    anchors: Object.freeze(specs.map(createAnchor)),
    meshes: Object.freeze(meshes),
  });
};
