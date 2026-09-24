import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Meshes/instancedMesh";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";

import type { StreetStripSpec } from "@lemonade/scene-contracts/street-layout";

export interface BabylonStreetSurfaceBatch {
  readonly role: "main-road" | "road" | "sidewalk";
  readonly source: Mesh;
  readonly instances: readonly InstancedMesh[];
}

export interface BabylonStreetSurfaceField {
  readonly anchors: readonly TransformNode[];
  readonly batches: readonly BabylonStreetSurfaceBatch[];
}

const color3 = (color: number): Color3 =>
  new Color3(
    ((color >>> 16) & 0xff) / 255,
    ((color >>> 8) & 0xff) / 255,
    (color & 0xff) / 255,
  );

const applyStripTransform = (
  node: TransformNode,
  strip: StreetStripSpec,
): void => {
  node.position.set(
    strip.x,
    strip.role === "sidewalk" ? 0.022 : 0.012,
    strip.z,
  );
  node.rotation.y = -strip.rotationY;
  node.scaling.set(strip.length, 0.022, strip.width);
};

const createAnchor = (
  scene: Scene,
  strip: StreetStripSpec,
): TransformNode => {
  const anchor = new TransformNode(
    `street-anchor:${strip.streetId}:${String(strip.segmentIndex)}:${strip.role}`,
    scene,
  );
  anchor.position.set(
    strip.x,
    strip.role === "sidewalk" ? 0.022 : 0.012,
    strip.z,
  );
  anchor.rotation.y = -strip.rotationY;
  anchor.metadata = Object.freeze({
    sceneRole: strip.role,
    streetId: strip.streetId,
    streetSegment: strip.segmentIndex,
  });
  return anchor;
};

const createBatch = (
  scene: Scene,
  role: BabylonStreetSurfaceBatch["role"],
  name: string,
  strips: readonly StreetStripSpec[],
  color: number,
): BabylonStreetSurfaceBatch | null => {
  const first = strips[0];
  if (first === undefined) return null;

  const material = new StandardMaterial(`${name}-material`, scene);
  material.diffuseColor = color3(color);
  material.specularColor = Color3.Black();

  const source = MeshBuilder.CreateBox(name, { size: 1 }, scene);
  source.material = material;
  source.isPickable = false;
  source.metadata = Object.freeze({
    sceneRole: "street-surface-batch",
    streetSurfaceRole: role,
  });
  applyStripTransform(source, first);
  source.freezeWorldMatrix();

  const instances = strips.slice(1).map((strip, index) => {
    const instance = source.createInstance(
      `${name}-instance-${String(index + 1)}`,
    );
    instance.isPickable = false;
    applyStripTransform(instance, strip);
    instance.freezeWorldMatrix();
    return instance;
  });

  return Object.freeze({
    role,
    source,
    instances: Object.freeze(instances),
  });
};

export const createBabylonStreetSurfaceField = (
  scene: Scene,
  roads: readonly StreetStripSpec[],
  sidewalks: readonly StreetStripSpec[],
): BabylonStreetSurfaceField => {
  const mainRoads = roads.filter((strip) => strip.streetId === "main");
  const otherRoads = roads.filter((strip) => strip.streetId !== "main");
  const batches = [
    createBatch(scene, "main-road", "MainRoadSurfaces", mainRoads, 0x596065),
    createBatch(scene, "road", "RoadSurfaces", otherRoads, 0x62686b),
    createBatch(
      scene,
      "sidewalk",
      "SidewalkSurfaces",
      sidewalks,
      0xd4d0c6,
    ),
  ].filter(
    (batch): batch is BabylonStreetSurfaceBatch => batch !== null,
  );

  return Object.freeze({
    anchors: Object.freeze(
      [...roads, ...sidewalks].map((strip) => createAnchor(scene, strip)),
    ),
    batches: Object.freeze(batches),
  });
};
