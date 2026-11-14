import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import "@babylonjs/core/Meshes/instancedMesh";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

import type { NeighborhoodPropertyTopology } from "@lemonade/scene/neighborhood-topology";

export type BabylonResidentialHousePart = "house-body" | "house-foundation" | "house-roof";

export interface BabylonResidentialHouseBatch {
  readonly role: BabylonResidentialHousePart;
  readonly color: number;
  readonly source: Mesh;
  readonly instances: readonly InstancedMesh[];
}

export interface BabylonResidentialHouseField {
  readonly anchors: readonly TransformNode[];
  readonly batches: readonly BabylonResidentialHouseBatch[];
}

const color3 = (color: number): Color3 =>
  new Color3(((color >>> 16) & 0xff) / 255, ((color >>> 8) & 0xff) / 255, (color & 0xff) / 255);

const material = (scene: Scene, name: string, color: number): StandardMaterial => {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = color3(color);
  result.specularColor = Color3.Black();
  return result;
};

const applyHouseMetadata = (
  node: TransformNode,
  property: NeighborhoodPropertyTopology,
  sceneRole: BabylonResidentialHousePart | "residential-house",
): void => {
  node.metadata = Object.freeze({
    sceneRole,
    propertyId: property.id,
    propertyRole: property.role,
    propertyGroup: property.group,
    houseColor: property.house.color,
  });
};

const applyHouseTransform = (
  node: TransformNode,
  property: NeighborhoodPropertyTopology,
  localY: number,
  localRotationY = 0,
): void => {
  const scale = property.house.scale;
  node.position.set(property.house.center.x, localY * scale, property.house.center.z);
  node.rotation.y = localRotationY - property.house.rotationY;
  node.scaling.set(scale, scale, scale);
};

const createAnchor = (
  scene: Scene,
  property: NeighborhoodPropertyTopology,
): TransformNode => {
  const anchor = new TransformNode(`house-anchor:${property.role}`, scene);
  anchor.position.set(property.house.center.x, 0, property.house.center.z);
  anchor.rotation.y = -property.house.rotationY;
  anchor.scaling.set(property.house.scale, property.house.scale, property.house.scale);
  applyHouseMetadata(anchor, property, "residential-house");
  return anchor;
};

type MeshFactory = (name: string) => Mesh;

const createBatch = (
  scene: Scene,
  role: BabylonResidentialHousePart,
  color: number,
  properties: readonly NeighborhoodPropertyTopology[],
  localY: number,
  localRotationY: number,
  createMesh: MeshFactory,
): BabylonResidentialHouseBatch | null => {
  const first = properties[0];
  if (first === undefined) {
    return null;
  }

  const source = createMesh(`${role}-source-${color.toString(16)}`);
  source.material = material(scene, `${role}-material-${color.toString(16)}`, color);
  source.isPickable = role === "house-body";
  applyHouseTransform(source, first, localY, localRotationY);
  applyHouseMetadata(source, first, role);
  source.freezeWorldMatrix();

  const instances = properties.slice(1).map((property, index) => {
    const instance = source.createInstance(
      `${role}-${property.role}-${String(index + 1)}`,
    );
    instance.isPickable = role === "house-body";
    applyHouseTransform(instance, property, localY, localRotationY);
    applyHouseMetadata(instance, property, role);
    instance.freezeWorldMatrix();
    return instance;
  });

  return Object.freeze({
    role,
    color,
    source,
    instances: Object.freeze(instances),
  });
};

const createBodyBatches = (
  scene: Scene,
  properties: readonly NeighborhoodPropertyTopology[],
): readonly BabylonResidentialHouseBatch[] => {
  const byColor = new Map<number, NeighborhoodPropertyTopology[]>();
  for (const property of properties) {
    const group = byColor.get(property.house.color);
    if (group === undefined) {
      byColor.set(property.house.color, [property]);
    } else {
      group.push(property);
    }
  }

  return Object.freeze(
    [...byColor.entries()].flatMap(([color, group]) => {
      const batch = createBatch(
        scene,
        "house-body",
        color,
        group,
        1.7,
        0,
        (name) => MeshBuilder.CreateBox(name, { width: 5.8, height: 3.4, depth: 4.5 }, scene),
      );
      return batch === null ? [] : [batch];
    }),
  );
};

export const createBabylonResidentialHouseField = (
  scene: Scene,
  properties: readonly NeighborhoodPropertyTopology[],
): BabylonResidentialHouseField => {
  const bodyBatches = createBodyBatches(scene, properties);
  const foundation = createBatch(
    scene,
    "house-foundation",
    0xc7_a9_80,
    properties,
    0.18,
    0,
    (name) =>
      MeshBuilder.CreateBox(name, { width: 5.95, height: 0.18, depth: 4.62 }, scene),
  );
  const roof = createBatch(
    scene,
    "house-roof",
    0x7f_4a_43,
    properties,
    4.45,
    Math.PI / 4,
    (name) =>
      MeshBuilder.CreateCylinder(
        name,
        { height: 2.25, diameterTop: 0, diameterBottom: 8.8, tessellation: 4 },
        scene,
      ),
  );

  return Object.freeze({
    anchors: Object.freeze(properties.map((property) => createAnchor(scene, property))),
    batches: Object.freeze([
      ...bodyBatches,
      ...(foundation === null ? [] : [foundation]),
      ...(roof === null ? [] : [roof]),
    ]),
  });
};
