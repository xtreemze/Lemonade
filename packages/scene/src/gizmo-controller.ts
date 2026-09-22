import {
  Box3,
  type Camera,
  type Mesh,
  type Object3D,
  Raycaster,
  type Scene,
  Vector2,
  Vector3,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

export type TransformMode = "translate" | "rotate" | "scale";
export type SceneEditorView =
  | "perspective"
  | "front"
  | "back"
  | "left"
  | "right"
  | "top";

export type ObjectTransform = Readonly<{
  key: string;
  name: string;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: readonly [number, number, number];
}>;

export type SceneEditorCameraState = Readonly<{
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number | null;
}>;

export type SceneObjectSelection = Readonly<{
  key: string;
  name: string;
  role: string | null;
}>;

export type GizmoControllerOptions = Readonly<{
  camera: Camera;
  scene: Scene;
  container: HTMLElement;
  onSelectionChanged?: (selection: SceneObjectSelection | null) => void;
  onTransformChanged?: (transform: ObjectTransform) => void;
  onCameraChanged?: (state: SceneEditorCameraState) => void;
}>;

const stringMetadata = (object: Object3D, key: string): string | null => {
  const value: unknown = object.userData[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const semanticRole = (object: Object3D): string | null =>
  stringMetadata(object, "sceneRole");

const occurrenceFor = (
  scene: Scene,
  object: Object3D,
  predicate: (candidate: Object3D) => boolean,
): number => {
  let occurrence = 0;
  let result = 0;
  let found = false;
  scene.traverse((candidate) => {
    if (found || !predicate(candidate)) return;
    if (candidate === object) {
      result = occurrence;
      found = true;
      return;
    }
    occurrence += 1;
  });
  return result;
};

export const sceneEditorObjectKey = (
  scene: Scene,
  object: Object3D,
): string => {
  if (object.name.length > 0) return `name:${object.name}`;

  const role = semanticRole(object);
  const propertyRole = stringMetadata(object, "propertyRole");
  if (role !== null && propertyRole !== null) {
    return `role:${role}:property:${propertyRole}`;
  }

  const streetId = stringMetadata(object, "streetId");
  const streetSegment: unknown = object.userData["streetSegment"];
  if (role !== null && streetId !== null && typeof streetSegment === "number") {
    return `role:${role}:street:${streetId}:${String(streetSegment)}`;
  }

  if (role !== null) {
    const occurrence = occurrenceFor(
      scene,
      object,
      (candidate) => semanticRole(candidate) === role,
    );
    return `role:${role}:${String(occurrence)}`;
  }

  const occurrence = occurrenceFor(
    scene,
    object,
    (candidate) => candidate.type === object.type && candidate.parent === object.parent,
  );
  return `object:${object.type}:${String(occurrence)}`;
};

export const captureObjectTransform = (
  scene: Scene,
  object: Object3D,
): ObjectTransform =>
  Object.freeze({
    key: sceneEditorObjectKey(scene, object),
    name:
      object.name.length > 0
        ? object.name
        : (semanticRole(object) ?? object.type),
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

export const applyObjectTransform = (
  object: Object3D,
  transform: ObjectTransform,
): void => {
  object.position.set(...transform.position);
  object.rotation.set(...transform.rotation);
  object.scale.set(...transform.scale);
  object.updateMatrix();
  object.updateMatrixWorld(true);
};

export const indexSceneEditorObjects = (
  scene: Scene,
): ReadonlyMap<string, Object3D> => {
  const index = new Map<string, Object3D>();
  scene.traverse((object) => {
    if (object === scene) return;
    index.set(sceneEditorObjectKey(scene, object), object);
  });
  return index;
};

const isMesh = (object: Object3D): object is Mesh => object instanceof Mesh;

const editorHelper = (object: Object3D): boolean =>
  Boolean(object.userData["sceneEditorHelper"]);

const selectableRoot = (scene: Scene, hit: Object3D): Object3D => {
  let current: Object3D = hit;
  while (current.parent !== null && current.parent !== scene) {
    if (current.name.length > 0 || semanticRole(current) !== null) return current;
    current = current.parent;
  }
  return current;
};

const cameraFov = (camera: Camera): number | null => {
  const candidate = camera as Camera & { fov?: number };
  return typeof candidate.fov === "number" ? candidate.fov : null;
};

const setCameraFov = (camera: Camera, fov: number): void => {
  const candidate = camera as Camera & {
    fov?: number;
    updateProjectionMatrix?: () => void;
  };
  if (typeof candidate.fov !== "number") return;
  candidate.fov = Math.min(100, Math.max(10, fov));
  candidate.updateProjectionMatrix?.();
};

export type GizmoController = Readonly<{
  selectObject(object: Object3D): void;
  deselectObject(): void;
  setMode(mode: TransformMode): void;
  getMode(): TransformMode;
  getSelectedObject(): Object3D | null;
  getSelection(): SceneObjectSelection | null;
  captureSelectedTransform(): ObjectTransform | null;
  setOrbitEnabled(enabled: boolean): void;
  getCameraState(): SceneEditorCameraState;
  applyCameraState(state: SceneEditorCameraState): void;
  setView(view: SceneEditorView): void;
  focusSelected(): void;
  saveTransform(): ObjectTransform | null;
  getSavedTransforms(): readonly ObjectTransform[];
  exportAsJSON(): string;
  exportAsCode(): string;
  setFov(fov: number): void;
  dispose(): void;
}>;

export const createGizmoController = (
  options: GizmoControllerOptions,
): GizmoController => {
  const { camera, scene, container } = options;
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const orbit = new OrbitControls(camera, container);
  orbit.enableDamping = false;
  orbit.screenSpacePanning = true;
  orbit.target.set(0, 1.7, 0);

  const transform = new TransformControls(camera, container);
  const transformHelper = transform.getHelper();
  transformHelper.userData["sceneEditorHelper"] = true;
  scene.add(transformHelper);

  let selected: Object3D | null = null;
  let mode: TransformMode = "translate";
  let orbitRequested = true;
  const savedTransforms = new Map<string, ObjectTransform>();

  const cameraState = (): SceneEditorCameraState =>
    Object.freeze({
      position: Object.freeze([
        camera.position.x,
        camera.position.y,
        camera.position.z,
      ]),
      target: Object.freeze([
        orbit.target.x,
        orbit.target.y,
        orbit.target.z,
      ]),
      fov: cameraFov(camera),
    });

  const notifyCamera = (): void => {
    options.onCameraChanged?.(cameraState());
  };

  const selection = (): SceneObjectSelection | null =>
    selected === null
      ? null
      : Object.freeze({
          key: sceneEditorObjectKey(scene, selected),
          name:
            selected.name.length > 0
              ? selected.name
              : (semanticRole(selected) ?? selected.type),
          role: semanticRole(selected),
        });

  const notifySelection = (): void => {
    options.onSelectionChanged?.(selection());
  };

  const notifyTransform = (): void => {
    if (selected === null) return;
    options.onTransformChanged?.(captureObjectTransform(scene, selected));
  };

  const deselectObject = (): void => {
    if (selected === null) return;
    transform.detach();
    selected = null;
    notifySelection();
  };

  const selectObject = (object: Object3D): void => {
    if (editorHelper(object)) return;
    selected = object;
    transform.attach(object);
    transform.setMode(mode);
    notifySelection();
  };

  const setMode = (nextMode: TransformMode): void => {
    mode = nextMode;
    transform.setMode(nextMode);
  };

  const setOrbitEnabled = (enabled: boolean): void => {
    orbitRequested = enabled;
    orbit.enabled = enabled && !(transform as unknown as { dragging?: boolean }).dragging;
  };

  const applyCameraState = (state: SceneEditorCameraState): void => {
    camera.position.set(...state.position);
    orbit.target.set(...state.target);
    if (state.fov !== null) setCameraFov(camera, state.fov);
    camera.lookAt(orbit.target);
    orbit.update();
    notifyCamera();
  };

  const setView = (view: SceneEditorView): void => {
    const target = orbit.target.clone();
    const distance = Math.max(3, camera.position.distanceTo(target));
    const offset =
      view === "front"
        ? new Vector3(0, 0, distance)
        : view === "back"
          ? new Vector3(0, 0, -distance)
          : view === "left"
            ? new Vector3(-distance, 0, 0)
            : view === "right"
              ? new Vector3(distance, 0, 0)
              : view === "top"
                ? new Vector3(0, distance, 0.001)
                : new Vector3(distance * 0.55, distance * 0.42, distance * 0.78);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    orbit.update();
    notifyCamera();
  };

  const focusSelected = (): void => {
    if (selected === null) return;
    const bounds = new Box3().setFromObject(selected);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const distance = Math.max(2.5, size.length() * 1.8);
    orbit.target.copy(center);
    camera.position.set(
      center.x + distance * 0.55,
      center.y + distance * 0.35,
      center.z + distance * 0.72,
    );
    camera.lookAt(center);
    orbit.update();
    notifyCamera();
  };

  const pointerPosition = (event: PointerEvent): void => {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    pointer.x = ((event.clientX - rect.left) / width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / height) * 2 + 1;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const activeAxis = (transform as unknown as { axis?: string | null }).axis;
    if (activeAxis) return;

    pointerPosition(event);
    raycaster.setFromCamera(pointer, camera);
    const meshes: Object3D[] = [];
    scene.traverse((object) => {
      if (
        object.visible &&
        !editorHelper(object) &&
        isMesh(object)
      ) {
        meshes.push(object);
      }
    });
    const hit = raycaster.intersectObjects(meshes, false)[0]?.object;
    if (hit === undefined) {
      deselectObject();
      return;
    }
    selectObject(selectableRoot(scene, hit));
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "g") setMode("translate");
    else if (key === "r") setMode("rotate");
    else if (key === "s") setMode("scale");
    else if (key === "f") focusSelected();
    else if (event.key === "Escape") deselectObject();
    else return;
    event.preventDefault();
  };

  const onOrbitChange = (): void => {
    notifyCamera();
  };
  orbit.addEventListener("change", onOrbitChange);

  transform.addEventListener("change", notifyTransform);
  transform.addEventListener("dragging-changed", (event) => {
    const dragging = (event as unknown as { value?: boolean }).value === true;
    orbit.enabled = orbitRequested && !dragging;
    if (!dragging) notifyTransform();
  });

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("keydown", onKeyDown);

  return Object.freeze({
    selectObject,
    deselectObject,
    setMode,
    getMode: (): TransformMode => mode,
    getSelectedObject: (): Object3D | null => selected,
    getSelection: selection,
    captureSelectedTransform: (): ObjectTransform | null =>
      selected === null ? null : captureObjectTransform(scene, selected),
    setOrbitEnabled,
    getCameraState: cameraState,
    applyCameraState,
    setView,
    focusSelected,
    saveTransform(): ObjectTransform | null {
      if (selected === null) return null;
      const captured = captureObjectTransform(scene, selected);
      savedTransforms.set(captured.key, captured);
      return captured;
    },
    getSavedTransforms(): readonly ObjectTransform[] {
      return Object.freeze([...savedTransforms.values()]);
    },
    exportAsJSON(): string {
      return JSON.stringify([...savedTransforms.values()], null, 2);
    },
    exportAsCode(): string {
      return `export const sceneTransforms = ${JSON.stringify(
        [...savedTransforms.values()],
        null,
        2,
      )} as const;\n`;
    },
    setFov(fov: number): void {
      setCameraFov(camera, fov);
      notifyCamera();
    },
    dispose(): void {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("keydown", onKeyDown);
      orbit.removeEventListener("change", onOrbitChange);
      deselectObject();
      scene.remove(transformHelper);
      transform.dispose();
      orbit.dispose();
    },
  });
};

