import {
  Mesh,
  PerspectiveCamera,
  type BufferGeometry,
  type Camera,
  type Material,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from "three";

import type { GizmoController, TransformMode } from "./gizmo-controller.js";

export type SceneObjectSelector = Readonly<{ id: string }>;

export type SceneTransformPatch = Readonly<{
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number];
}>;

export type SceneTreeNode = Readonly<{
  id: string;
  name: string;
  type: string;
  visible: boolean;
  childCount: number;
  children: readonly SceneTreeNode[];
  childrenTruncated: boolean;
}>;

export type SceneObjectDetails = Readonly<{
  id: string;
  name: string;
  type: string;
  visible: boolean;
  position: readonly [number, number, number];
  worldPosition: readonly [number, number, number];
  rotation: readonly [number, number, number, string];
  scale: readonly [number, number, number];
  childCount: number;
  material: readonly string[];
}>;

export type SceneDiagnosticsSnapshot = Readonly<{
  state: unknown;
  scene: Readonly<{
    objects: number;
    visibleObjects: number;
    meshes: number;
    namedObjects: number;
  }>;
  camera: Readonly<{
    type: string;
    position: readonly [number, number, number];
    rotation: readonly [number, number, number, string];
    fov?: number;
    near?: number;
    far?: number;
  }>;
  renderer: Readonly<{
    memory: Readonly<{ geometries: number; textures: number }>;
    render: Readonly<{
      calls: number;
      triangles: number;
      points: number;
      lines: number;
      frame: number;
    }>;
    programs: number;
  }>;
  editor: Readonly<{
    enabled: boolean;
    mode: TransformMode | null;
    selectedObjectId: string | null;
    selectedObjectName: string | null;
  }>;
}>;

export type SceneDevtoolsOptions = Readonly<{
  scene: Scene;
  camera: Camera;
  renderer: WebGLRenderer;
  getState: () => unknown;
  render: () => void;
  gizmo?: GizmoController | null;
}>;

export interface SceneDevtoolsController {
  diagnostics(): SceneDiagnosticsSnapshot;
  tree(options?: Readonly<{ maxDepth?: number; maxChildren?: number }>): SceneTreeNode;
  object(selector: SceneObjectSelector): SceneObjectDetails | null;
  setTransform(selector: SceneObjectSelector, patch: SceneTransformPatch): SceneObjectDetails;
  setVisible(selector: SceneObjectSelector, visible: boolean): SceneObjectDetails;
  select(selector: SceneObjectSelector | null): SceneObjectDetails | null;
  setMode(mode: TransformMode): TransformMode;
}

const tuple3 = (value: Readonly<{ x: number; y: number; z: number }>) =>
  [value.x, value.y, value.z] as const;

const materialNames = (material: Material | Material[]): readonly string[] => {
  const materials = Array.isArray(material) ? material : [material];
  return materials.map((entry) => entry.name || entry.type);
};

const findObject = (scene: Scene, id: string): Object3D | null =>
  scene.getObjectByProperty("uuid", id) ?? scene.getObjectByName(id) ?? null;

const detailsFor = (object: Object3D): SceneObjectDetails => {
  object.updateWorldMatrix(true, false);
  const worldPosition = object.getWorldPosition(object.position.clone());
  return Object.freeze({
    id: object.uuid,
    name: object.name,
    type: object.type,
    visible: object.visible,
    position: tuple3(object.position),
    worldPosition: tuple3(worldPosition),
    rotation: [
      object.rotation.x,
      object.rotation.y,
      object.rotation.z,
      object.rotation.order,
    ] as const,
    scale: tuple3(object.scale),
    childCount: object.children.length,
    material:
      object instanceof Mesh
        ? materialNames(
            (object as Mesh<BufferGeometry, Material | Material[]>).material,
          )
        : [],
  });
};

const requireObject = (scene: Scene, selector: SceneObjectSelector): Object3D => {
  const object = findObject(scene, selector.id);
  if (object === null) throw new RangeError(`Scene object not found: ${selector.id}`);
  return object;
};

const finiteTuple = (
  value: readonly [number, number, number] | undefined,
  field: string,
): readonly [number, number, number] | undefined => {
  if (value === undefined) return undefined;
  if (!value.every(Number.isFinite)) {
    throw new TypeError(`${field} must contain three finite numbers.`);
  }
  return value;
};

export const snapshotSceneTree = (
  root: Object3D,
  options: Readonly<{ maxDepth?: number; maxChildren?: number }> = {},
): SceneTreeNode => {
  const maxDepth = Math.max(0, Math.min(8, Math.trunc(options.maxDepth ?? 3)));
  const maxChildren = Math.max(1, Math.min(250, Math.trunc(options.maxChildren ?? 60)));

  const visit = (object: Object3D, depth: number): SceneTreeNode => {
    const children = depth < maxDepth ? object.children.slice(0, maxChildren) : [];
    return Object.freeze({
      id: object.uuid,
      name: object.name,
      type: object.type,
      visible: object.visible,
      childCount: object.children.length,
      children: children.map((child) => visit(child, depth + 1)),
      childrenTruncated: depth >= maxDepth || object.children.length > children.length,
    });
  };

  return visit(root, 0);
};

export const createSceneDevtools = (options: SceneDevtoolsOptions): SceneDevtoolsController => {
  const { scene, camera, renderer, getState, render, gizmo = null } = options;

  const diagnostics = (): SceneDiagnosticsSnapshot => {
    let objects = 0;
    let visibleObjects = 0;
    let meshes = 0;
    let namedObjects = 0;
    scene.traverse((object) => {
      objects += 1;
      if (object.visible) visibleObjects += 1;
      if (object instanceof Mesh) meshes += 1;
      if (object.name.length > 0) namedObjects += 1;
    });

    const selected = gizmo?.getSelectedObject() ?? null;
    const rendererInfo = renderer.info;
    const baseCamera = {
      type: camera.type,
      position: tuple3(camera.position),
      rotation: [
        camera.rotation.x,
        camera.rotation.y,
        camera.rotation.z,
        camera.rotation.order,
      ] as const,
    };
    const cameraInfo =
      camera instanceof PerspectiveCamera
        ? Object.freeze({
            ...baseCamera,
            fov: camera.fov,
            near: camera.near,
            far: camera.far,
          })
        : Object.freeze(baseCamera);

    return Object.freeze({
      state: getState(),
      scene: Object.freeze({ objects, visibleObjects, meshes, namedObjects }),
      camera: cameraInfo,
      renderer: Object.freeze({
        memory: Object.freeze({
          geometries: rendererInfo.memory.geometries,
          textures: rendererInfo.memory.textures,
        }),
        render: Object.freeze({
          calls: rendererInfo.render.calls,
          triangles: rendererInfo.render.triangles,
          points: rendererInfo.render.points,
          lines: rendererInfo.render.lines,
          frame: rendererInfo.render.frame,
        }),
        programs: rendererInfo.programs?.length ?? 0,
      }),
      editor: Object.freeze({
        enabled: gizmo !== null,
        mode: gizmo?.getMode() ?? null,
        selectedObjectId: selected?.uuid ?? null,
        selectedObjectName: selected?.name ?? null,
      }),
    });
  };

  return Object.freeze({
    diagnostics,
    tree: (treeOptions?: Readonly<{ maxDepth?: number; maxChildren?: number }>) =>
      snapshotSceneTree(scene, treeOptions),
    object(selector: SceneObjectSelector) {
      const found = findObject(scene, selector.id);
      return found === null ? null : detailsFor(found);
    },
    setTransform(selector: SceneObjectSelector, patch: SceneTransformPatch) {
      const target = requireObject(scene, selector);
      const position = finiteTuple(patch.position, "position");
      const rotation = finiteTuple(patch.rotation, "rotation");
      const scale = finiteTuple(patch.scale, "scale");

      if (position !== undefined) target.position.set(...position);
      if (rotation !== undefined) target.rotation.set(...rotation);
      if (scale !== undefined) {
        if (scale.some((component) => component === 0)) {
          throw new RangeError("scale components must be non-zero.");
        }
        target.scale.set(...scale);
      }
      target.updateMatrixWorld(true);
      render();
      return detailsFor(target);
    },
    setVisible(selector: SceneObjectSelector, visible: boolean) {
      const target = requireObject(scene, selector);
      target.visible = visible;
      render();
      return detailsFor(target);
    },
    select(selector: SceneObjectSelector | null) {
      if (selector === null) {
        gizmo?.deselectObject();
        render();
        return null;
      }
      const target = requireObject(scene, selector);
      if (gizmo === null) {
        throw new Error("The in-scene gizmo is disabled. Enable LEMONADE_DEV_GIZMO first.");
      }
      gizmo.selectObject(target);
      render();
      return detailsFor(target);
    },
    setMode(mode: TransformMode) {
      if (gizmo === null) {
        throw new Error("The in-scene gizmo is disabled. Enable LEMONADE_DEV_GIZMO first.");
      }
      gizmo.setMode(mode);
      render();
      return mode;
    },
  });
};
