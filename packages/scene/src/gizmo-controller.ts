import {
  Raycaster,
  Vector2,
  type Camera,
  type Object3D,
  type Scene,
} from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

export type TransformMode = "translate" | "rotate" | "scale";

export interface ObjectTransform {
  uuid: string;
  name: string;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: readonly [number, number, number];
}

export interface GizmoState {
  selectedObject: Object3D | null;
  mode: TransformMode;
  savedTransforms: ReadonlyMap<string, ObjectTransform>;
}

export interface GizmoOptions {
  camera: Camera;
  scene: Scene;
  container: HTMLElement;
  selectableObjects?: readonly Object3D[];
  onTransformChanged?: () => void;
}

export interface GizmoController {
  selectObject(object: Object3D): void;
  deselectObject(): void;
  saveTransform(): void;
  getSavedTransforms(): readonly ObjectTransform[];
  exportAsJSON(): string;
  exportAsCode(): string;
  getState(): GizmoState;
  setMode(mode: TransformMode): void;
  getMode(): TransformMode;
  getSelectedObject(): Object3D | null;
  dispose(): void;
}

const objectTransform = (object: Object3D): ObjectTransform =>
  Object.freeze({
    uuid: object.uuid,
    name: object.name,
    position: Object.freeze([
      object.position.x,
      object.position.y,
      object.position.z,
    ]),
    rotation: Object.freeze([
      object.rotation.x,
      object.rotation.y,
      object.rotation.z,
    ]),
    scale: Object.freeze([
      object.scale.x,
      object.scale.y,
      object.scale.z,
    ]),
  });

const isDescendantOf = (object: Object3D, ancestor: Object3D): boolean => {
  let current: Object3D | null = object;
  while (current !== null) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
};

export const createGizmoController = (options: GizmoOptions): GizmoController => {
  const { camera, scene, container, onTransformChanged } = options;
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const savedTransforms = new Map<string, ObjectTransform>();
  const controls = new TransformControls(camera, container);
  const helper = controls.getHelper();
  helper.name = "GizmoTransformControls";
  scene.add(helper);

  let selectedObject: Object3D | null = null;
  let mode: TransformMode = "translate";

  const selectableObjects = (): readonly Object3D[] => {
    if (options.selectableObjects !== undefined) return options.selectableObjects;

    const objects: Object3D[] = [];
    scene.traverse((object) => {
      if (
        object !== scene &&
        object.name.length > 0 &&
        !isDescendantOf(object, helper)
      ) {
        objects.push(object);
      }
    });
    return objects;
  };

  const selectObject = (object: Object3D): void => {
    selectedObject = object;
    controls.attach(object);
    controls.setMode(mode);
    onTransformChanged?.();
  };

  const deselectObject = (): void => {
    controls.detach();
    selectedObject = null;
    onTransformChanged?.();
  };

  const setMode = (nextMode: TransformMode): void => {
    mode = nextMode;
    controls.setMode(nextMode);
    onTransformChanged?.();
  };

  const saveTransform = (): void => {
    if (selectedObject === null) return;
    const transform = objectTransform(selectedObject);
    savedTransforms.set(transform.uuid, transform);
    onTransformChanged?.();
  };

  const getSavedTransforms = (): readonly ObjectTransform[] =>
    Object.freeze([...savedTransforms.values()]);

  const exportAsJSON = (): string =>
    JSON.stringify(getSavedTransforms(), null, 2);

  const exportAsCode = (): string =>
    getSavedTransforms()
      .map(
        (transform) =>
          [
            `// ${transform.name || "unnamed"} (${transform.uuid})`,
            `object.position.set(${transform.position.join(", ")});`,
            `object.rotation.set(${transform.rotation.join(", ")});`,
            `object.scale.set(${transform.scale.join(", ")});`,
          ].join("\n"),
      )
      .join("\n\n");

  const getState = (): GizmoState =>
    Object.freeze({
      selectedObject,
      mode,
      savedTransforms: new Map(savedTransforms),
    });

  const pointerPosition = (event: PointerEvent): void => {
    const rect = container.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    pointerPosition(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(selectableObjects(), false)[0];
    if (hit === undefined) {
      deselectObject();
      return;
    }
    selectObject(hit.object);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
      return;
    }
    switch (event.key.toLowerCase()) {
      case "g":
        setMode("translate");
        break;
      case "r":
        setMode("rotate");
        break;
      case "s":
        setMode("scale");
        break;
      case "escape":
        deselectObject();
        break;
    }
  };

  const onControlsChange = (): void => {
    onTransformChanged?.();
  };

  controls.addEventListener("change", onControlsChange);
  container.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown);

  return Object.freeze({
    selectObject,
    deselectObject,
    saveTransform,
    getSavedTransforms,
    exportAsJSON,
    exportAsCode,
    getState,
    setMode,
    getMode(): TransformMode {
      return mode;
    },
    getSelectedObject(): Object3D | null {
      return selectedObject;
    },
    dispose(): void {
      container.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      controls.removeEventListener("change", onControlsChange);
      controls.detach();
      scene.remove(helper);
      controls.dispose();
      selectedObject = null;
    },
  });
};
