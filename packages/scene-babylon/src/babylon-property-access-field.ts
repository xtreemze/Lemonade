import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Meshes/instancedMesh";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

import type {
  PropertyAccessRole,
  PropertyAccessSurfaceSpec,
} from "@lemonade/scene-contracts/property-access-layout";

export interface BabylonPropertyAccessBatch {
  readonly role: PropertyAccessRole;
  readonly source: Mesh;
  readonly instances: readonly InstancedMesh[];
}

export interface BabylonPropertyAccessField {
  readonly anchors: readonly TransformNode[];
  readonly batches: readonly BabylonPropertyAccessBatch[];
}

const config = (
  role: PropertyAccessRole,
): Readonly<{ color: Color3; y: number }> =>
  role === "driveway"
    ? Object.freeze({ color: Color3.FromHexString("#c9b995"), y: 0.019 })
    : Object.freeze({ color: Color3.FromHexString("#d8c9aa"), y: 0.021 });

const applyTransform = (
  node: TransformNode,
  spec: PropertyAccessSurfaceSpec,
): void => {
  const { y } = config(spec.role);
  node.position.set(spec.x, y, spec.z);
  node.rotation.y = -spec.rotationY;
  node.scaling.set(spec.length, 0.018, spec.width);
};

const createAnchor = (
  scene: Scene,
  spec: PropertyAccessSurfaceSpec,
  index: number,
): TransformNode => {
  const anchor = new TransformNode(
    `property-access-anchor:${spec.role}:${String(index)}`,
    scene,
  );
  const { y } = config(spec.role);
  anchor.position.set(spec.x, y, spec.z);
  anchor.rotation.y = -spec.rotationY;
  anchor.metadata = Object.freeze({ sceneRole: spec.role });
  return anchor;
};

const createBatch = (
  scene: Scene,
  role: PropertyAccessRole,
  specs: readonly PropertyAccessSurfaceSpec[],
): BabylonPropertyAccessBatch | null => {
  const first = specs[0];
  if (first === undefined) return null;

  const name = role === "driveway" ? "DrivewaySurfaces" : "FrontPathSurfaces";
  const material = new StandardMaterial(`${name}-material`, scene);
  material.diffuseColor = config(role).color;
  material.specularColor = Color3.Black();

  const source = MeshBuilder.CreateBox(name, { size: 1 }, scene);
  source.material = material;
  source.isPickable = false;
  source.metadata = Object.freeze({
    sceneRole: "property-access-surface-batch",
    propertyAccessRole: role,
  });
  applyTransform(source, first);
  source.freezeWorldMatrix();

  const instances = specs.slice(1).map((spec, index) => {
    const instance = source.createInstance(
      `${name}-instance-${String(index + 1)}`,
    );
    instance.isPickable = false;
    applyTransform(instance, spec);
    instance.freezeWorldMatrix();
    return instance;
  });

  return Object.freeze({
    role,
    source,
    instances: Object.freeze(instances),
  });
};

export const createBabylonPropertyAccessField = (
  scene: Scene,
  specs: readonly PropertyAccessSurfaceSpec[],
): BabylonPropertyAccessField => {
  const driveways = specs.filter((spec) => spec.role === "driveway");
  const paths = specs.filter((spec) => spec.role === "front-path");
  const batches = [
    createBatch(scene, "driveway", driveways),
    createBatch(scene, "front-path", paths),
  ].filter(
    (batch): batch is BabylonPropertyAccessBatch => batch !== null,
  );

  return Object.freeze({
    anchors: Object.freeze(
      specs.map((spec, index) => createAnchor(scene, spec, index)),
    ),
    batches: Object.freeze(batches),
  });
};
