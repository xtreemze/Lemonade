import {
  Vector3,
  Vector2,
  Raycaster,
  Camera,
  Scene,
  Object3D,
  Group,
  BoxHelper,
  Euler,
  Quaternion,
  Matrix4,
} from "three";

export type TransformMode = "translate" | "rotate" | "scale";

export type GizmoState = {
  selectedObject: Object3D | null;
  mode: TransformMode;
  isDragging: boolean;
  savedPositions: Map<string, { position: Vector3; rotation: Euler; scale: Vector3 }>;
};

export type ObjectTransform = {
  uuid: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

const raycaster = new Raycaster();
const mouse = new Vector2();

let selectedObject: Object3D | null = null;
let selectedHelper: BoxHelper | null = null;
let currentMode: TransformMode = "translate";
let isDragging = false;
let dragPlane = new Vector3(0, 1, 0);
let dragPoint = new Vector3();
let initialPosition = new Vector3();
let initialRotation = new Euler();
let initialScale = new Vector3();

interface GizmoOptions {
  camera: Camera;
  scene: Scene;
  container: HTMLElement;
  selectableObjects?: Object3D[];
}

export const createGizmoController = (options: GizmoOptions) => {
  const { camera, scene, container, selectableObjects } = options;
  const savedTransforms = new Map<string, ObjectTransform>();

  const getSelectableObjects = (): Object3D[] => {
    if (selectableObjects) return selectableObjects;
    const objects: Object3D[] = [];
    scene.traverse((obj) => {
      if (
        obj !== scene &&
        obj.name &&
        !obj.name.startsWith("Gizmo") &&
        !(obj instanceof Group && obj.children.length === 0)
      ) {
        objects.push(obj);
      }
    });
    return objects;
  };

  const onMouseMove = (event: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera as any);

    const objects = getSelectableObjects();
    const intersects = raycaster.intersectObjects(objects, true);

    // Hover effect
    if (selectedObject && selectedHelper) {
      selectedHelper.update();
    }

    if (intersects.length > 0 && !isDragging) {
      const target = intersects[0]?.object;
      if (target) {
        container.style.cursor = "pointer";
      }
    } else if (!isDragging) {
      container.style.cursor = "default";
    }

    if (isDragging && selectedObject) {
      raycaster.setFromCamera(mouse, camera as any);
      const distance = camera.position.z - selectedObject.position.z;
      const vFOV = (camera as any).fov * (Math.PI / 180);
      const height = 2 * Math.tan(vFOV / 2) * distance;
      const width = height * (container.clientWidth / container.clientHeight);

      const worldPos = new Vector3(
        (mouse.x * width) / 2,
        (mouse.y * height) / 2,
        selectedObject.position.z,
      );

      if (currentMode === "translate") {
        const delta = worldPos.clone().sub(initialPosition);
        selectedObject.position.copy(dragPoint.clone().add(delta));
      }
    }
  };

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return;

    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera as any);
    const objects = getSelectableObjects();
    const intersects = raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
      let target = intersects[0]!.object;
      while (target.parent && target.parent !== scene) {
        if (target.name && !target.name.startsWith("Gizmo")) {
          break;
        }
        target = target.parent;
      }

      selectObject(target);
      isDragging = true;
      dragPoint.copy(selectedObject!.position);
      initialPosition.copy(selectedObject!.position);
      initialRotation.copy(selectedObject!.rotation);
      initialScale.copy(selectedObject!.scale);
      container.style.cursor = "grabbing";
    }
  };

  const onMouseUp = () => {
    isDragging = false;
    container.style.cursor = "default";
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "g" || event.key === "G") {
      currentMode = "translate";
      event.preventDefault();
    } else if (event.key === "r" || event.key === "R") {
      currentMode = "rotate";
      event.preventDefault();
    } else if (event.key === "s" || event.key === "S") {
      currentMode = "scale";
      event.preventDefault();
    } else if (event.key === "Escape") {
      deselectObject();
    }
  };

  const selectObject = (obj: Object3D) => {
    deselectObject();
    selectedObject = obj;

    if (selectedHelper) {
      scene.remove(selectedHelper);
    }
    selectedHelper = new BoxHelper(obj, 0xff00ff);
    selectedHelper.name = "GizmoHelper";
    scene.add(selectedHelper);
  };

  const deselectObject = () => {
    if (selectedHelper) {
      scene.remove(selectedHelper);
      selectedHelper = null;
    }
    selectedObject = null;
  };

  const saveTransform = () => {
    if (!selectedObject) return;

    const uuid = selectedObject.uuid;
    const transform: ObjectTransform = {
      uuid,
      name: selectedObject.name,
      position: [selectedObject.position.x, selectedObject.position.y, selectedObject.position.z],
      rotation: [selectedObject.rotation.x, selectedObject.rotation.y, selectedObject.rotation.z],
      scale: [selectedObject.scale.x, selectedObject.scale.y, selectedObject.scale.z],
    };

    savedTransforms.set(uuid, transform);
    console.log("Saved transform for", selectedObject.name, transform);
  };

  const getSavedTransforms = (): ObjectTransform[] => {
    return Array.from(savedTransforms.values());
  };

  const exportAsJSON = (): string => {
    const transforms = getSavedTransforms();
    return JSON.stringify(transforms, null, 2);
  };

  const exportAsCode = (): string => {
    const transforms = getSavedTransforms();
    let code = "// Scene object positions and transforms\n\n";

    for (const transform of transforms) {
      code += `// ${transform.name} (${transform.uuid})\n`;
      code += `object.position.set(${transform.position.join(", ")});\n`;
      code += `object.rotation.set(${transform.rotation.join(", ")});\n`;
      code += `object.scale.set(${transform.scale.join(", ")});\n\n`;
    }

    return code;
  };

  const getState = (): GizmoState => ({
    selectedObject,
    mode: currentMode,
    isDragging,
    savedPositions: new Map(),
  });

  // Attach event listeners
  container.addEventListener("mousemove", onMouseMove);
  container.addEventListener("mousedown", onMouseDown);
  container.addEventListener("mouseup", onMouseUp);
  document.addEventListener("keydown", onKeyDown);

  return {
    selectObject,
    deselectObject,
    saveTransform,
    getSavedTransforms,
    exportAsJSON,
    exportAsCode,
    getState,
    setMode: (mode: TransformMode) => {
      currentMode = mode;
    },
    getMode: () => currentMode,
    getSelectedObject: () => selectedObject,
    dispose: () => {
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keydown", onKeyDown);
      deselectObject();
    },
  };
};

export type GizmoController = ReturnType<typeof createGizmoController>;
