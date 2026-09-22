import {
  BoxHelper,
  Euler,
  Raycaster,
  Vector2,
  Vector3,
  type Camera,
  type Object3D,
  type Scene,
} from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

export type TransformMode = "translate" | "rotate" | "scale";

export interface GizmoState {
  selectedObject: Object3D | null;
  mode: TransformMode;
  isDragging: boolean;
  savedPositions: Map<
    string,
    { position: Vector3; rotation: Euler; scale: Vector3 }
  >;
}

export interface ObjectTransform {
  uuid: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
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
  getSavedTransforms(): ObjectTransform[];
  exportAsJSON(): string;
  exportAsCode(): string;
  getState(): GizmoState;
  setMode(mode: TransformMode): void;
  getMode(): TransformMode;
  getSelectedObject(): Object3D | null;
  dispose(): void;
}

const isDescendantOf = (object: Object3D, ancestor: Object3D): boolean => {
  let current: Object3D | null = object;
  while (current !== null) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
};

export const createGizmoController = (options: GizmoOptions): GizmoController => {
  const { camera, scene, container, selectableObjects, onTransformChanged } = options;
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const savedTransforms = new Map<string, ObjectTransform>();
  let selectedObject: Object3D | null = null;
  let selectedHelper: BoxHelper | null = null;
  let currentMode: TransformMode = "translate";
  let isDragging = false;

  const transformControls = new TransformControls(camera, container);
  transformControls.setSpace("world");
  transformControls.setMode(currentMode);
  const transformHelper = transformControls.getHelper();
  transformHelper.name = "GizmoTransformControls";
  scene.add(transformHelper);

  const setPointer = (event: PointerEvent): void => {
    const rect = container.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const defaultSelectableObjects = (): Object3D[] =>
    scene.children.filter(
      (object) =>
        object !== transformHelper &&
        object !== selectedHelper &&
        object.name !== "GizmoHelper",
    );

  const getSelectableObjects = (): readonly Object3D[] =>
    selectableObjects ?? defaultSelectableObjects();

  const resolveSelectableObject = (object: Object3D): Object3D | null => {
    if (isDescendantOf(object, transformHelper)) return null;

    if (selectableObjects !== undefined) {
      let current: Object3D | null = object;
      while (current !== null && current !== scene) {
        if (selectableObjects.includes(current)) return current;
        current = current.parent;
      }
      return null;
    }

    let current: Object3D | null = object;
    let fallback: Object3D | null = null;
    while (current !== null && current !== scene) {
      if (current === selectedHelper || current.name === "GizmoHelper") return null;
      fallback ??= current;
      if (
        current.name.length > 0 &&
        !current.name.startsWith("Gizmo") &&
        !current.name.startsWith("gizmo-")
      ) {
        return current;
      }
      current = current.parent;
    }
    return fallback;
  };

  const updateSelectionHelper = (): void => {
    selectedHelper?.update();
    onTransformChanged?.();
  };

  const onControlsMouseDown = (): void => {
    isDragging = true;
  };

  const onControlsMouseUp = (): void => {
    isDragging = false;
  };

  transformControls.addEventListener("change", updateSelectionHelper);
  transformControls.addEventListener("mouseDown", onControlsMouseDown);
  transformControls.addEventListener("mouseUp", onControlsMouseUp);

  const deselectObject = (): void => {
    transformControls.detach();
    if (selectedHelper !== null) {
      scene.remove(selectedHelper);
      selectedHelper.dispose();
      selectedHelper = null;
    }
    selectedObject = null;
    isDragging = false;
    onTransformChanged?.();
  };

  const selectObject = (object: Object3D): void => {
    if (object === selectedObject) return;
    deselectObject();
    selectedObject = object;
    selectedHelper = new BoxHelper(object, 0xff00ff);
    selectedHelper.name = "GizmoHelper";
    scene.add(selectedHelper);
    transformControls.attach(object);
    transformControls.setMode(currentMode);
    onTransformChanged?.();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);

    if (raycaster.intersectObject(transformHelper, true).length > 0) return;

    const hit = raycaster.intersectObjects([...getSelectableObjects()], true)[0];
    if (hit === undefined) {
      deselectObject();
      return;
    }
    const selectable = resolveSelectableObject(hit.object);
    if (selectable !== null) selectObject(selectable);
  };

  const setMode = (mode: TransformMode): void => {
    currentMode = mode;
    transformControls.setMode(mode);
    onTransformChanged?.();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "g" || event.key === "G") {
      setMode("translate");
      event.preventDefault();
    } else if (event.key === "r" || event.key === "R") {
      setMode("rotate");
      event.preventDefault();
    } else if (event.key === "s" || event.key === "S") {
      setMode("scale");
      event.preventDefault();
    } else if (event.key === "Escape") {
      deselectObject();
    }
  };

  const saveTransform = (): void => {
    if (selectedObject === null) return;
    savedTransforms.set(selectedObject.uuid, {
      uuid: selectedObject.uuid,
      name: selectedObject.name,
      position: [
        selectedObject.position.x,
        selectedObject.position.y,
        selectedObject.position.z,
      ],
      rotation: [
        selectedObject.rotation.x,
        selectedObject.rotation.y,
        selectedObject.rotation.z,
      ],
      scale: [
        selectedObject.scale.x,
        selectedObject.scale.y,
        selectedObject.scale.z,
      ],
    });
  };

  const getSavedTransforms = (): ObjectTransform[] =>
    Array.from(savedTransforms.values());

  const exportAsJSON = (): string =>
    JSON.stringify(getSavedTransforms(), null, 2);

  const exportAsCode = (): string => {
    let code = "// Scene object positions and transforms\n\n";
    for (const transform of getSavedTransforms()) {
      code += `// ${transform.name} (${transform.uuid})\n`;
      code += `object.position.set(${transform.position.join(", ")});\n`;
      code += `object.rotation.set(${transform.rotation.join(", ")});\n`;
      code += `object.scale.set(${transform.scale.join(", ")});\n\n`;
    }
    return code;
  };

  const getState = (): GizmoState => {
    const savedPositions = new Map<
      string,
      { position: Vector3; rotation: Euler; scale: Vector3 }
    >();
    for (const [uuid, transform] of savedTransforms) {
      savedPositions.set(uuid, {
        position: new Vector3(...transform.position),
        rotation: new Euler(...transform.rotation),
        scale: new Vector3(...transform.scale),
      });
    }
    return {
      selectedObject,
      mode: currentMode,
      isDragging,
      savedPositions,
    };
  };

  container.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown);

  return {
    selectObject,
    deselectObject,
    saveTransform,
    getSavedTransforms,
    exportAsJSON,
    exportAsCode,
    getState,
    setMode,
    getMode: () => currentMode,
    getSelectedObject: () => selectedObject,
    dispose: () => {
      container.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      transformControls.removeEventListener("change", updateSelectionHelper);
      transformControls.removeEventListener("mouseDown", onControlsMouseDown);
      transformControls.removeEventListener("mouseUp", onControlsMouseUp);
      deselectObject();
      scene.remove(transformHelper);
      transformControls.dispose();
    },
  };
};
