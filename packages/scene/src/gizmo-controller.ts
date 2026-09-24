import type { Camera, Object3D, Scene } from "three";
import {
  BoxGeometry,
  BoxHelper,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  Euler,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

export type TransformMode = "translate" | "rotate" | "scale";

export interface GizmoState {
  selectedObject: Object3D | null;
  mode: TransformMode;
  isDragging: boolean;
  savedPositions: Map<string, { position: Vector3; rotation: Euler; scale: Vector3 }>;
}

export interface ObjectTransform {
  uuid: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

// TransformControls ships no .d.ts under three/examples/jsm; TypeScript structurally infers its
// Object3D-derived shape from the .js source, but not the extra `gizmoGroup` field it sets at
// runtime. This intersection is the single documented boundary for that gap.
type TransformControlsInstance = TransformControls & { gizmoGroup?: Object3D };

const createTransformControls = (
  camera: Camera,
  container: HTMLElement,
): TransformControlsInstance => new TransformControls(camera, container);

const getVerticalFovRadians = (camera: Camera): number => {
  const fovDegrees = camera instanceof PerspectiveCamera ? camera.fov : 50;
  return fovDegrees * (Math.PI / 180);
};

const readAxis = (obj: Object3D): "x" | "y" | "z" | null => {
  const axis: unknown = obj.userData["axis"];
  return axis === "x" || axis === "y" || axis === "z" ? axis : null;
};

const raycaster = new Raycaster();
const mouse = new Vector2();

let selectedObject: Object3D | null = null;
let selectedHelper: BoxHelper | null = null;
let currentMode: TransformMode = "translate";
let isDragging = false;
let dragAxis: "x" | "y" | "z" | null = null;
const dragStartWorldPos = new Vector3();
const initialPosition = new Vector3();
const initialRotation = new Euler();
const initialScale = new Vector3();

interface GizmoOptions {
  camera: Camera;
  scene: Scene;
  container: HTMLElement;
  selectableObjects?: Object3D[];
  onTransformChanged?: () => void;
}

export interface GizmoController {
  selectObject: (obj: Object3D) => void;
  deselectObject: () => void;
  saveTransform: () => void;
  getSavedTransforms: () => ObjectTransform[];
  exportAsJSON: () => string;
  exportAsCode: () => string;
  getState: () => GizmoState;
  setMode: (mode: TransformMode) => void;
  getMode: () => TransformMode;
  getSelectedObject: () => Object3D | null;
  dispose: () => void;
}

export const createGizmoController = (options: GizmoOptions): GizmoController => {
  const { camera, scene, container, selectableObjects, onTransformChanged } = options;
  const savedTransforms = new Map<string, ObjectTransform>();

  // Create TransformControls for visual 3D gizmo
  const transformControls = createTransformControls(camera, container);
  transformControls.setSpace("world");

  // Add the gizmo visual group to the scene so it renders
  if (transformControls.gizmoGroup) {
    scene.add(transformControls.gizmoGroup);
  }

  // Listen for changes to update the UI
  transformControls.addEventListener("change", () => {
    onTransformChanged?.();
  });

  const getSelectableObjects = (): Object3D[] => {
    if (selectableObjects) {
      return selectableObjects;
    }
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

  const createMoveGizmo = (): Group => {
    const gizmo = new Group();
    gizmo.name = "GizmoVisuals";
    const axisLength = 3;
    const coneRadius = 0.15;
    const coneHeight = 0.5;

    // X axis (red)
    const xCone = new Mesh(
      new ConeGeometry(coneRadius, coneHeight, 8),
      new MeshBasicMaterial({ color: 0xff_00_00 }),
    );
    xCone.position.x = axisLength;
    xCone.rotation.z = Math.PI / 2;
    xCone.name = "gizmo-x";
    xCone.userData["axis"] = "x";
    gizmo.add(xCone);

    const xLineGeom = new BufferGeometry();
    xLineGeom.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([0, 0, 0, axisLength - coneHeight / 2, 0, 0]), 3),
    );
    const xLine = new Line(xLineGeom, new LineBasicMaterial({ color: 0xff_00_00, linewidth: 3 }));
    xLine.name = "gizmo-x";
    xLine.userData["axis"] = "x";
    gizmo.add(xLine);

    // Y axis (green)
    const yCone = new Mesh(
      new ConeGeometry(coneRadius, coneHeight, 8),
      new MeshBasicMaterial({ color: 0x00_ff_00 }),
    );
    yCone.position.y = axisLength;
    yCone.name = "gizmo-y";
    yCone.userData["axis"] = "y";
    gizmo.add(yCone);

    const yLineGeom = new BufferGeometry();
    yLineGeom.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([0, 0, 0, 0, axisLength - coneHeight / 2, 0]), 3),
    );
    const yLine = new Line(yLineGeom, new LineBasicMaterial({ color: 0x00_ff_00, linewidth: 3 }));
    yLine.name = "gizmo-y";
    yLine.userData["axis"] = "y";
    gizmo.add(yLine);

    // Z axis (blue)
    const zCone = new Mesh(
      new ConeGeometry(coneRadius, coneHeight, 8),
      new MeshBasicMaterial({ color: 0x00_00_ff }),
    );
    zCone.position.z = axisLength;
    zCone.rotation.x = Math.PI / 2;
    zCone.name = "gizmo-z";
    zCone.userData["axis"] = "z";
    gizmo.add(zCone);

    const zLineGeom = new BufferGeometry();
    zLineGeom.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([0, 0, 0, 0, 0, axisLength - coneHeight / 2]), 3),
    );
    const zLine = new Line(zLineGeom, new LineBasicMaterial({ color: 0x00_00_ff, linewidth: 3 }));
    zLine.name = "gizmo-z";
    zLine.userData["axis"] = "z";
    gizmo.add(zLine);

    return gizmo;
  };

  const createRotateGizmo = (): Group => {
    const gizmo = new Group();
    gizmo.name = "GizmoVisuals";
    const radius = 2.5;

    const createArc = (color: number, axis: "x" | "y" | "z") => {
      const points: Vector3[] = [];
      const segments = 16;
      const range = Math.PI * 1.5;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * range - range / 2;
        if (axis === "x") {
          points.push(new Vector3(0, Math.cos(angle) * radius, Math.sin(angle) * radius));
        } else if (axis === "y") {
          points.push(new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
        } else {
          points.push(new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
        }
      }
      const arcGeom = new BufferGeometry().setFromPoints(points);
      return new Line(arcGeom, new LineBasicMaterial({ color, linewidth: 2 }));
    };

    gizmo.add(createArc(0xff_00_00, "x"));
    gizmo.add(createArc(0x00_ff_00, "y"));
    gizmo.add(createArc(0x00_00_ff, "z"));

    return gizmo;
  };

  const createScaleGizmo = (): Group => {
    const gizmo = new Group();
    gizmo.name = "GizmoVisuals";
    const axisLength = 3;
    const boxSize = 0.3;

    // X axis (red box)
    const xBox = new Mesh(
      new BoxGeometry(boxSize, boxSize, boxSize),
      new MeshBasicMaterial({ color: 0xff_00_00 }),
    );
    xBox.position.x = axisLength;
    gizmo.add(xBox);

    const xLineGeom = new BufferGeometry();
    xLineGeom.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([0, 0, 0, axisLength - boxSize / 2, 0, 0]), 3),
    );
    gizmo.add(new Line(xLineGeom, new LineBasicMaterial({ color: 0xff_00_00, linewidth: 2 })));

    // Y axis (green box)
    const yBox = new Mesh(
      new BoxGeometry(boxSize, boxSize, boxSize),
      new MeshBasicMaterial({ color: 0x00_ff_00 }),
    );
    yBox.position.y = axisLength;
    gizmo.add(yBox);

    const yLineGeom = new BufferGeometry();
    yLineGeom.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([0, 0, 0, 0, axisLength - boxSize / 2, 0]), 3),
    );
    gizmo.add(new Line(yLineGeom, new LineBasicMaterial({ color: 0x00_ff_00, linewidth: 2 })));

    // Z axis (blue box)
    const zBox = new Mesh(
      new BoxGeometry(boxSize, boxSize, boxSize),
      new MeshBasicMaterial({ color: 0x00_00_ff }),
    );
    zBox.position.z = axisLength;
    gizmo.add(zBox);

    const zLineGeom = new BufferGeometry();
    zLineGeom.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([0, 0, 0, 0, 0, axisLength - boxSize / 2]), 3),
    );
    gizmo.add(new Line(zLineGeom, new LineBasicMaterial({ color: 0x00_00_ff, linewidth: 2 })));

    return gizmo;
  };

  const createGizmoForMode = (mode: TransformMode): Group => {
    switch (mode) {
      case "translate":
        return createMoveGizmo();
      case "rotate":
        return createRotateGizmo();
      case "scale":
        return createScaleGizmo();
    }
  };

  const onMouseMove = (event: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    if (isDragging && selectedObject && dragAxis) {
      raycaster.setFromCamera(mouse, camera);

      // Calculate world position at current mouse
      const distance = camera.position.z - selectedObject.position.z;
      const vFov = getVerticalFovRadians(camera);
      const height = 2 * Math.tan(vFov / 2) * distance;
      const width = height * (container.clientWidth / container.clientHeight);

      const worldPos = new Vector3(
        (mouse.x * width) / 2,
        (mouse.y * height) / 2,
        selectedObject.position.z,
      );

      // Calculate delta from drag start
      const delta = worldPos.clone().sub(dragStartWorldPos);

      // Apply delta only on the selected axis
      if (currentMode === "translate") {
        if (dragAxis === "x") {
          selectedObject.position.x = initialPosition.x + delta.x;
        } else if (dragAxis === "y") {
          selectedObject.position.y = initialPosition.y + delta.y;
        } else {
          selectedObject.position.z = initialPosition.z - delta.y; // Z uses vertical mouse movement
        }
      } else if (currentMode === "scale") {
        const scaleFactor = 1 + delta.x * 2;
        if (dragAxis === "x") {
          selectedObject.scale.x = Math.max(0.1, initialScale.x * scaleFactor);
        } else if (dragAxis === "y") {
          selectedObject.scale.y = Math.max(0.1, initialScale.y * scaleFactor);
        } else {
          selectedObject.scale.z = Math.max(0.1, initialScale.z * (1 - delta.y * 2));
        }
      }

      onTransformChanged?.();
      return;
    }

    raycaster.setFromCamera(mouse, camera);
    const objects = getSelectableObjects();
    const intersects = raycaster.intersectObjects(objects, true);

    if (selectedObject && selectedHelper) {
      selectedHelper.update();
    }

    if (intersects.length > 0 && !isDragging) {
      container.style.cursor = "pointer";
    } else if (!isDragging) {
      container.style.cursor = "default";
    }
  };

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) {
      return;
    }

    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const objects = getSelectableObjects();
    const intersects = raycaster.intersectObjects(objects, true);

    const firstIntersect = intersects[0];
    if (firstIntersect) {
      let target = firstIntersect.object;
      let foundAxis: "x" | "y" | "z" | null = readAxis(target);

      if (!foundAxis) {
        // Traverse up to find a gizmo part
        let current = target;
        while (current.parent && !foundAxis) {
          foundAxis = readAxis(current);
          current = current.parent;
        }
      }

      // Find the main selectable object (not a gizmo)
      while (target.parent && target.parent !== scene) {
        if (
          target.name &&
          !target.name.startsWith("gizmo-") &&
          !target.name.includes("GizmoVisuals")
        ) {
          break;
        }
        target = target.parent;
      }

      // If we don't have a selected object, select one; otherwise, start dragging on the selected axis
      if (!selectedObject) {
        selectObject(target);
      } else if (foundAxis) {
        isDragging = true;
        dragAxis = foundAxis;
        initialPosition.copy(selectedObject.position);
        initialRotation.copy(selectedObject.rotation);
        initialScale.copy(selectedObject.scale);

        // Store world position at drag start
        const distance = camera.position.z - selectedObject.position.z;
        const vFov = getVerticalFovRadians(camera);
        const height = 2 * Math.tan(vFov / 2) * distance;
        const width = height * (container.clientWidth / container.clientHeight);
        dragStartWorldPos.set(
          (mouse.x * width) / 2,
          (mouse.y * height) / 2,
          selectedObject.position.z,
        );

        container.style.cursor = "grabbing";
      }
    }
  };

  const onMouseUp = () => {
    isDragging = false;
    dragAxis = null;
    container.style.cursor = "default";
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const updateMode = (mode: TransformMode) => {
      currentMode = mode;
      transformControls.setMode(mode);

      // Update gizmo visuals if an object is selected
      if (selectedObject) {
        const oldGizmo = selectedObject.getObjectByName("GizmoVisuals");
        if (oldGizmo) {
          selectedObject.remove(oldGizmo);
        }
        const newGizmo = createGizmoForMode(mode);
        selectedObject.add(newGizmo);
      }
    };

    if (event.key === "g" || event.key === "G") {
      updateMode("translate");
      event.preventDefault();
    } else if (event.key === "r" || event.key === "R") {
      updateMode("rotate");
      event.preventDefault();
    } else if (event.key === "s" || event.key === "S") {
      updateMode("scale");
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
    selectedHelper = new BoxHelper(obj, 0xff_00_ff);
    selectedHelper.name = "GizmoHelper";
    scene.add(selectedHelper);

    // Add mode-specific gizmo to the selected object
    const gizmo = createGizmoForMode(currentMode);
    obj.add(gizmo);

    // Attach TransformControls to the selected object
    transformControls.attach(obj);
    transformControls.setMode(currentMode);
  };

  const deselectObject = () => {
    if (selectedObject) {
      // Remove gizmo visuals
      const gizmo = selectedObject.getObjectByName("GizmoVisuals");
      if (gizmo) {
        selectedObject.remove(gizmo);
      }
    }
    if (selectedHelper) {
      scene.remove(selectedHelper);
      selectedHelper = null;
    }
    // Detach from TransformControls
    transformControls.detach();
    selectedObject = null;
  };

  const saveTransform = () => {
    if (!selectedObject) {
      return;
    }

    const uuid = selectedObject.uuid;
    const transform: ObjectTransform = {
      uuid,
      name: selectedObject.name,
      position: [selectedObject.position.x, selectedObject.position.y, selectedObject.position.z],
      rotation: [selectedObject.rotation.x, selectedObject.rotation.y, selectedObject.rotation.z],
      scale: [selectedObject.scale.x, selectedObject.scale.y, selectedObject.scale.z],
    };

    savedTransforms.set(uuid, transform);
  };

  const getSavedTransforms = (): ObjectTransform[] => Array.from(savedTransforms.values());

  const exportAsJson = (): string => {
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
    exportAsJSON: exportAsJson,
    exportAsCode,
    getState,
    setMode: (mode: TransformMode) => {
      currentMode = mode;
      transformControls.setMode(mode);

      // Update gizmo visuals if an object is selected
      if (selectedObject) {
        const oldGizmo = selectedObject.getObjectByName("GizmoVisuals");
        if (oldGizmo) {
          selectedObject.remove(oldGizmo);
        }
        const newGizmo = createGizmoForMode(mode);
        selectedObject.add(newGizmo);
      }
    },
    getMode: () => currentMode,
    getSelectedObject: () => selectedObject,
    dispose: () => {
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keydown", onKeyDown);
      deselectObject();
      if (transformControls.gizmoGroup) {
        scene.remove(transformControls.gizmoGroup);
      }
      transformControls.dispose();
    },
  };
};
