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
  BufferGeometry,
  BufferAttribute,
  LineBasicMaterial,
  Line,
  Color,
  ConeGeometry,
  MeshBasicMaterial,
  Mesh,
} from "three";
// @ts-ignore - TransformControls not in @types/three, but exists in three/examples
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

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
  onTransformChanged?: () => void;
}

export const createGizmoController = (options: GizmoOptions) => {
  const { camera, scene, container, selectableObjects, onTransformChanged } = options;
  const savedTransforms = new Map<string, ObjectTransform>();

  // Create TransformControls for visual 3D gizmo
  const transformControls = new TransformControls(camera, container);
  transformControls.setSpace("world");

  // Add the gizmo visual group to the scene so it renders
  if ((transformControls as any).gizmoGroup) {
    scene.add((transformControls as any).gizmoGroup);
  }

  // Listen for changes to update the UI
  transformControls.addEventListener("change", () => {
    onTransformChanged?.();
  });

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

  const createAxisVisuals = (): Group => {
    const axisGroup = new Group();
    axisGroup.name = "GizmoAxisVisuals";

    const axisLength = 3;
    const coneRadius = 0.15;
    const coneHeight = 0.5;

    // X axis (red cone)
    const xCone = new Mesh(
      new ConeGeometry(coneRadius, coneHeight, 8),
      new MeshBasicMaterial({ color: 0xff0000 }),
    );
    xCone.position.x = axisLength;
    xCone.rotation.z = Math.PI / 2;
    axisGroup.add(xCone);

    // Y axis (green cone)
    const yCone = new Mesh(
      new ConeGeometry(coneRadius, coneHeight, 8),
      new MeshBasicMaterial({ color: 0x00ff00 }),
    );
    yCone.position.y = axisLength;
    axisGroup.add(yCone);

    // Z axis (blue cone)
    const zCone = new Mesh(
      new ConeGeometry(coneRadius, coneHeight, 8),
      new MeshBasicMaterial({ color: 0x0000ff }),
    );
    zCone.position.z = axisLength;
    zCone.rotation.x = Math.PI / 2;
    axisGroup.add(zCone);

    // Add lines connecting to the cones
    const lineLength = axisLength - coneHeight / 2;

    // X line
    const xLineGeom = new BufferGeometry();
    xLineGeom.setAttribute("position", new BufferAttribute(
      new Float32Array([0, 0, 0, lineLength, 0, 0]),
      3,
    ));
    const xLine = new Line(xLineGeom, new LineBasicMaterial({ color: 0xff0000 }));
    axisGroup.add(xLine);

    // Y line
    const yLineGeom = new BufferGeometry();
    yLineGeom.setAttribute("position", new BufferAttribute(
      new Float32Array([0, 0, 0, 0, lineLength, 0]),
      3,
    ));
    const yLine = new Line(yLineGeom, new LineBasicMaterial({ color: 0x00ff00 }));
    axisGroup.add(yLine);

    // Z line
    const zLineGeom = new BufferGeometry();
    zLineGeom.setAttribute("position", new BufferAttribute(
      new Float32Array([0, 0, 0, 0, 0, lineLength]),
      3,
    ));
    const zLine = new Line(zLineGeom, new LineBasicMaterial({ color: 0x0000ff }));
    axisGroup.add(zLine);

    return axisGroup;
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

    // TransformControls handles dragging now
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
      transformControls.setMode("translate");
      event.preventDefault();
    } else if (event.key === "r" || event.key === "R") {
      currentMode = "rotate";
      transformControls.setMode("rotate");
      event.preventDefault();
    } else if (event.key === "s" || event.key === "S") {
      currentMode = "scale";
      transformControls.setMode("scale");
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

    // Add visual axes to the selected object
    const axes = createAxisVisuals();
    obj.add(axes);

    // Attach TransformControls to the selected object
    transformControls.attach(obj);
    transformControls.setMode(currentMode);
  };

  const deselectObject = () => {
    if (selectedObject) {
      // Remove axis visuals
      const axes = selectedObject.getObjectByName("GizmoAxisVisuals");
      if (axes) {
        selectedObject.remove(axes);
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
      transformControls.setMode(mode);
    },
    getMode: () => currentMode,
    getSelectedObject: () => selectedObject,
    dispose: () => {
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keydown", onKeyDown);
      deselectObject();
      if ((transformControls as any).gizmoGroup) {
        scene.remove((transformControls as any).gizmoGroup);
      }
      transformControls.dispose();
    },
  };
};

export type GizmoController = ReturnType<typeof createGizmoController>;
