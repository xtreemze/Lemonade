import { type BufferGeometry, type Material, Mesh, type Object3D } from "three";

export type SceneResourceCounts = Readonly<{
  geometries: number;
  materials: number;
}>;

type DisposableMesh = Mesh<BufferGeometry, Material | Material[]>;

const isDisposableMesh = (object: Object3D): object is DisposableMesh => object instanceof Mesh;

export const disposeSceneResources = (root: Object3D): SceneResourceCounts => {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();

  root.traverse((object) => {
    if (!isDisposableMesh(object)) {
      return;
    }
    geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      for (const material of object.material) {
        materials.add(material);
      }
    } else {
      materials.add(object.material);
    }
  });

  for (const geometry of geometries) {
    geometry.dispose();
  }
  for (const material of materials) {
    material.dispose();
  }

  return Object.freeze({
    geometries: geometries.size,
    materials: materials.size,
  });
};
