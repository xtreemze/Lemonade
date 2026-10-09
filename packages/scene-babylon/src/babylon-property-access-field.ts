import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import "@babylonjs/core/Meshes/instancedMesh";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

import type { NeighborhoodPropertyTopology } from "@lemonade/scene/neighborhood-topology";

export type BabylonPropertyAccessRole = "driveway" | "front-path";

export interface BabylonPropertyAccessBatch {
  readonly role: BabylonPropertyAccessRole;
  readonly source: Mesh;
  readonly instances: readonly InstancedMesh[];
}

export interface BabylonPropertyAccessField {
  readonly anchors: readonly TransformNode[];
  readonly batches: readonly BabylonPropertyAccessBatch[];
}

type PropertyAccessSurface = Readonly<{
  role: BabylonPropertyAccessRole;
  propertyId: string;
  propertyRole: string;
  x: number;
  z: number;
  length: number;
  width: number;
  rotationY: number;
  connectedSegmentId: string;
}>;

const color3 = (color: number): Color3 =>
  new Color3(((color >>> 16) & 0xff) / 255, ((color >>> 8) & 0xff) / 255, (color & 0xff) / 255);

const surfacesForProperty = (
  property: NeighborhoodPropertyTopology,
): readonly PropertyAccessSurface[] => {
  const path: PropertyAccessSurface = Object.freeze({
    role: "front-path",
    propertyId: property.id,
    propertyRole: property.role,
    x: property.path.center.x,
    z: property.path.center.z,
    length: property.path.length,
    width: property.path.width,
    rotationY: property.path.rotationY,
    connectedSegmentId: property.path.sidewalkSegmentId,
  });

  if (property.driveway === null) {
    return Object.freeze([path]);
  }

  const driveway: PropertyAccessSurface = Object.freeze({
    role: "driveway",
    propertyId: property.id,
    propertyRole: property.role,
    x: property.driveway.center.x,
    z: property.driveway.center.z,
    length: property.driveway.length,
    width: property.driveway.width,
    rotationY: property.driveway.rotationY,
    connectedSegmentId: property.driveway.roadSegmentId,
  });

  return Object.freeze([path, driveway]);
};

const applySurfaceMetadata = (
  node: TransformNode,
  surface: PropertyAccessSurface,
): void => {
  node.metadata = Object.freeze({
    sceneRole: surface.role,
    propertyId: surface.propertyId,
    propertyRole: surface.propertyRole,
    connectedSegmentId: surface.connectedSegmentId,
  });
};

const applySurfaceTransform = (
  node: TransformNode,
  surface: PropertyAccessSurface,
): void => {
  node.position.set(surface.x, 0.028, surface.z);
  node.rotation.y = -surface.rotationY;
  node.scaling.set(surface.length, 0.018, surface.width);
};

const createAnchor = (
  scene: Scene,
  surface: PropertyAccessSurface,
): TransformNode => {
  const anchor = new TransformNode(
    `property-access-anchor:${surface.propertyRole}:${surface.role}`,
    scene,
  );
  anchor.position.set(surface.x, 0.037, surface.z);
  anchor.rotation.y = -surface.rotationY;
  applySurfaceMetadata(anchor, surface);
  return anchor;
};

const createBatch = (
  scene: Scene,
  role: BabylonPropertyAccessRole,
  surfaces: readonly PropertyAccessSurface[],
  color: number,
): BabylonPropertyAccessBatch | null => {
  const first = surfaces[0];
  if (first === undefined) {
    return null;
  }

  const material = new StandardMaterial(`${role}-material`, scene);
  material.diffuseColor = color3(color);
  material.specularColor = Color3.Black();

  const source = MeshBuilder.CreateBox(`${role}-surfaces`, { size: 1 }, scene);
  source.material = material;
  source.isPickable = false;
  applySurfaceTransform(source, first);
  applySurfaceMetadata(source, first);
  source.freezeWorldMatrix();

  const instances = surfaces.slice(1).map((surface, index) => {
    const instance = source.createInstance(`${role}-surface-${String(index + 1)}`);
    instance.isPickable = false;
    applySurfaceTransform(instance, surface);
    applySurfaceMetadata(instance, surface);
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
  properties: readonly NeighborhoodPropertyTopology[],
): BabylonPropertyAccessField => {
  const surfaces = properties.flatMap(surfacesForProperty);
  const paths = surfaces.filter((surface) => surface.role === "front-path");
  const driveways = surfaces.filter((surface) => surface.role === "driveway");
  const batches = [
    createBatch(scene, "front-path", paths, 0xc7_bf_b0),
    createBatch(scene, "driveway", driveways, 0xa6_a2_9a),
  ].filter((batch): batch is BabylonPropertyAccessBatch => batch !== null);

  return Object.freeze({
    anchors: Object.freeze(surfaces.map((surface) => createAnchor(scene, surface))),
    batches: Object.freeze(batches),
  });
};
