/**
 * Developer-only Three.js scene editor.
 *
 * Enable during local development with:
 * localStorage.setItem("LEMONADE_DEV_SCENE_VIEWER", "1")
 */

import {
  createLemonsvilleScene,
  type LemonsvilleSceneController,
  type LemonsvilleSceneState,
  type ScenePhase,
  type SceneWeather,
} from "@lemonade/scene";
import {
  applyObjectTransform,
  captureObjectTransform,
  createGizmoController,
  indexSceneEditorObjects,
  type GizmoController,
  type ObjectTransform,
  type SceneEditorView,
  type SceneObjectSelection,
  type TransformMode,
} from "@lemonade/scene/gizmo-controller";
import { createStreetStoryboard } from "@lemonade/scene/storyboard-create";

import {
  DEFAULT_DEV_SCENE_EDITOR_STATE,
  DEV_SCENE_EDITOR_STORAGE_KEY,
  deserializeDevSceneEditorState,
  parseDevSceneEditorState,
  serializeDevSceneEditorState,
  withTransform,
  withoutTransform,
  type DevSceneAtmosphereState,
  type DevSceneDensityState,
  type DevSceneEditorState,
  type DevSceneWorldState,
} from "./dev-scene-editor-state.js";

import "./dev-scene-editor.css";

const ENABLE_KEY = "LEMONADE_DEV_SCENE_VIEWER";

const PRESETS: Readonly<
  Record<
    string,
    Readonly<{
      weather: SceneWeather;
      phase: ScenePhase;
      confidence: number;
      prepared: number;
      sold: number;
    }>
  >
> = Object.freeze({
  "sunny-forecast": Object.freeze({
    weather: "sunny",
    phase: "forecast",
    confidence: 3,
    prepared: 0,
    sold: 0,
  }),
  "cloudy-forecast": Object.freeze({
    weather: "cloudy",
    phase: "forecast",
    confidence: 3,
    prepared: 0,
    sold: 0,
  }),
  "partly-cloudy-forecast": Object.freeze({
    weather: "hot-and-dry",
    phase: "forecast",
    confidence: 3,
    prepared: 0,
    sold: 0,
  }),
  "storm-forecast": Object.freeze({
    weather: "thunderstorm",
    phase: "forecast",
    confidence: 3,
    prepared: 0,
    sold: 0,
  }),
  "sunny-simulation": Object.freeze({
    weather: "sunny",
    phase: "simulation",
    confidence: 3,
    prepared: 20,
    sold: 10,
  }),
  "busy-simulation": Object.freeze({
    weather: "sunny",
    phase: "simulation",
    confidence: 5,
    prepared: 30,
    sold: 24,
  }),
  "storm-simulation": Object.freeze({
    weather: "thunderstorm",
    phase: "simulation",
    confidence: 2,
    prepared: 12,
    sold: 4,
  }),
});

const editorAvailable = (): boolean => import.meta.env.DEV;

export const isSceneViewerEnabled = (): boolean => {
  if (!editorAvailable() || typeof localStorage === "undefined") return false;
  return localStorage.getItem(ENABLE_KEY) === "1";
};

export const enableSceneViewer = (): void => {
  if (!editorAvailable() || typeof localStorage === "undefined") return;
  localStorage.setItem(ENABLE_KEY, "1");
  window.location.reload();
};

export const disableSceneViewer = (): void => {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(ENABLE_KEY);
  window.location.reload();
};

const loadEditorState = (): DevSceneEditorState => {
  if (typeof localStorage === "undefined") {
    return DEFAULT_DEV_SCENE_EDITOR_STATE;
  }
  const saved = localStorage.getItem(DEV_SCENE_EDITOR_STORAGE_KEY);
  return saved === null
    ? DEFAULT_DEV_SCENE_EDITOR_STATE
    : deserializeDevSceneEditorState(saved);
};

const saveEditorState = (state: DevSceneEditorState): void => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    DEV_SCENE_EDITOR_STORAGE_KEY,
    serializeDevSceneEditorState(state),
  );
};

const editorSceneState = (
  state: DevSceneEditorState,
): LemonsvilleSceneState => {
  const prepared = Math.max(0, state.prepared);
  const sold = Math.min(prepared, Math.max(0, state.sold));
  const durationMs = Math.max(
    500,
    Math.round(state.durationMs / Math.max(0.1, state.playback.rate)),
  );
  const ambientPedestrianCount = Math.round(24 * state.density.pedestrians);

  return Object.freeze({
    weather: state.weather,
    visibleSigns: state.phase === "forecast" ? 0 : state.visibleSigns,
    prepared,
    durationMs,
    confidence: state.confidence,
    nextConfidence: state.nextConfidence,
    characterSeed: state.seed,
    dayNumber: state.dayNumber,
    storyboard: createStreetStoryboard({
      durationMs,
      prepared,
      sold: state.phase === "simulation" ? sold : 0,
      visibleSigns: state.visibleSigns,
      priceCents: state.priceCents,
      ambientPedestrianCount,
    }),
    phase: state.phase,
    reducedMotion: state.playback.paused,
  });
};

const editorMarkup = (): string => `
  <section class="dev-scene-editor" data-sidebar-collapsed="false">
    <div class="dev-scene-editor__viewport">
      <canvas
        class="dev-scene-editor__canvas"
        tabindex="0"
        aria-label="Editable Lemonsville Three.js scene"
      ></canvas>
      <button
        class="dev-scene-editor__sidebar-toggle"
        type="button"
        aria-label="Toggle editor sidebar"
        aria-expanded="true"
      >Tools</button>
    </div>

    <aside class="dev-scene-editor__sidebar" aria-label="3D editor controls">
      <header class="dev-scene-editor__header">
        <div class="dev-scene-editor__header-row">
          <h1 class="dev-scene-editor__title">Lemonsville 3D editor</h1>
          <button type="button" data-action="exit">Exit</button>
        </div>
        <p class="dev-scene-editor__status" role="status" aria-live="polite">
          Persistent developer scene ready.
        </p>
      </header>

      <details class="dev-scene-editor__section" open>
        <summary>Scene and generation</summary>
        <div class="dev-scene-editor__section-body">
          <label class="dev-scene-editor__field">
            <span>Preset</span>
            <select data-control="preset">
              <option value="">Custom</option>
              <option value="sunny-forecast">Sunny forecast</option>
              <option value="cloudy-forecast">Cloudy forecast</option>
              <option value="partly-cloudy-forecast">Partly cloudy forecast</option>
              <option value="storm-forecast">Storm forecast</option>
              <option value="sunny-simulation">Sunny simulation</option>
              <option value="busy-simulation">Busy simulation</option>
              <option value="storm-simulation">Storm simulation</option>
            </select>
          </label>
          <label class="dev-scene-editor__field">
            <span>Weather</span>
            <select data-control="weather">
              <option value="sunny">Sunny</option>
              <option value="cloudy">Cloudy</option>
              <option value="hot-and-dry">Partly cloudy / hot</option>
              <option value="thunderstorm">Thunderstorm</option>
            </select>
          </label>
          <label class="dev-scene-editor__field">
            <span>Phase</span>
            <select data-control="phase">
              <option value="forecast">Forecast</option>
              <option value="simulation">Simulation</option>
              <option value="idle">Idle</option>
            </select>
          </label>
          <label class="dev-scene-editor__field">
            <span>Seed</span>
            <input data-control="seed" type="number" min="0" max="4294967295" step="1" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Day</span>
            <input data-control="day" type="number" min="1" max="100000" step="1" />
          </label>
          <div class="dev-scene-editor__button-row">
            <button type="button" data-action="regenerate">Regenerate</button>
            <button type="button" data-action="randomize-seed">New seed</button>
          </div>
        </div>
      </details>

      <details class="dev-scene-editor__section" open>
        <summary>Camera and view</summary>
        <div class="dev-scene-editor__section-body">
          <label class="dev-scene-editor__field">
            <span>Orbit / pan</span>
            <input data-control="orbit" type="checkbox" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Field of view</span>
            <input data-control="fov" type="range" min="10" max="100" step="1" />
          </label>
          <div class="dev-scene-editor__view-grid">
            <button type="button" data-view="perspective">Perspective</button>
            <button type="button" data-view="front">Front</button>
            <button type="button" data-view="back">Back</button>
            <button type="button" data-view="left">Left</button>
            <button type="button" data-view="right">Right</button>
            <button type="button" data-view="top">Top</button>
          </div>
          <button type="button" data-action="focus">Focus selected</button>
        </div>
      </details>

      <details class="dev-scene-editor__section" open>
        <summary>Selection and transform</summary>
        <div class="dev-scene-editor__section-body">
          <label class="dev-scene-editor__field dev-scene-editor__field--stack">
            <span>Scene object</span>
            <select data-control="object-list">
              <option value="">Select in viewport or choose object</option>
            </select>
          </label>
          <p class="dev-scene-editor__selected" data-selected>
            No object selected.
          </p>
          <div class="dev-scene-editor__button-row">
            <button type="button" data-mode="translate" aria-pressed="true">Move (G)</button>
            <button type="button" data-mode="rotate" aria-pressed="false">Rotate (R)</button>
            <button type="button" data-mode="scale" aria-pressed="false">Scale (S)</button>
          </div>
          <div class="dev-scene-editor__transform-grid" aria-label="Selected object transform">
            <strong>P</strong>
            <input data-transform="px" type="number" step="0.05" aria-label="Position X" />
            <input data-transform="py" type="number" step="0.05" aria-label="Position Y" />
            <input data-transform="pz" type="number" step="0.05" aria-label="Position Z" />
            <strong>R°</strong>
            <input data-transform="rx" type="number" step="1" aria-label="Rotation X degrees" />
            <input data-transform="ry" type="number" step="1" aria-label="Rotation Y degrees" />
            <input data-transform="rz" type="number" step="1" aria-label="Rotation Z degrees" />
            <strong>S</strong>
            <input data-transform="sx" type="number" min="0.001" step="0.05" aria-label="Scale X" />
            <input data-transform="sy" type="number" min="0.001" step="0.05" aria-label="Scale Y" />
            <input data-transform="sz" type="number" min="0.001" step="0.05" aria-label="Scale Z" />
          </div>
          <div class="dev-scene-editor__button-row">
            <button type="button" data-action="save-transform">Save transform</button>
            <button type="button" data-action="reset-transform">Reset transform</button>
            <button type="button" data-action="deselect">Deselect</button>
          </div>
          <p class="dev-scene-editor__help">
            Click objects in the viewport. G/R/S switch gizmos, F focuses the selection, Escape deselects.
          </p>
        </div>
      </details>

      <details class="dev-scene-editor__section">
        <summary>Crowd and behavior</summary>
        <div class="dev-scene-editor__section-body">
          <label class="dev-scene-editor__field">
            <span>Confidence / activity</span>
            <input data-control="confidence" type="range" min="0" max="5" step="0.1" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Prepared cups</span>
            <input data-control="prepared" type="number" min="0" max="1000" step="1" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Sales / buyers</span>
            <input data-control="sold" type="number" min="0" max="1000" step="1" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Advertising signs</span>
            <input data-control="signs" type="number" min="0" max="40" step="1" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Pedestrians</span>
            <input data-density="pedestrians" type="range" min="0" max="1" step="0.05" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Residents / workers</span>
            <input data-density="residents" type="range" min="0" max="1" step="0.05" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Wildlife</span>
            <input data-density="wildlife" type="range" min="0" max="1" step="0.05" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Pause motion</span>
            <input data-control="paused" type="checkbox" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Playback rate</span>
            <input data-control="rate" type="range" min="0.1" max="4" step="0.1" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Cycle duration ms</span>
            <input data-control="duration" type="number" min="500" max="120000" step="100" />
          </label>
        </div>
      </details>

      <details class="dev-scene-editor__section">
        <summary>Traffic and mobility</summary>
        <div class="dev-scene-editor__section-body">
          <label class="dev-scene-editor__field">
            <span>Vehicles</span>
            <input data-density="vehicles" type="range" min="0" max="1" step="0.05" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Bicycles</span>
            <input data-density="bicycles" type="range" min="0" max="1" step="0.05" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Pets</span>
            <input data-density="pets" type="range" min="0" max="1" step="0.05" />
          </label>
          <p class="dev-scene-editor__help">
            Density changes are deterministic for the current seed. Select individual actors in the object list to reposition them with gizmos.
          </p>
        </div>
      </details>

      <details class="dev-scene-editor__section">
        <summary>Procedural neighborhood</summary>
        <div class="dev-scene-editor__section-body">
          <label class="dev-scene-editor__field">
            <span>Buildings</span>
            <input data-world="buildings" type="range" min="0" max="1" step="0.05" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Roads / sidewalks</span>
            <input data-world="streets" type="range" min="0" max="1" step="0.05" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Trees</span>
            <input data-world="trees" type="range" min="0" max="1" step="0.05" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Shrubs</span>
            <input data-world="shrubs" type="range" min="0" max="1" step="0.05" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Flowers</span>
            <input data-world="flowers" type="range" min="0" max="1" step="0.05" />
          </label>
          <p class="dev-scene-editor__help">
            Seed + Regenerate produces a deterministic neighborhood. Density controls thin generated categories without changing collision/pathfinding topology.
          </p>
        </div>
      </details>

      <details class="dev-scene-editor__section">
        <summary>Weather, day and atmosphere</summary>
        <div class="dev-scene-editor__section-body">
          <label class="dev-scene-editor__field">
            <span>Time of day</span>
            <input data-atmosphere="timeOfDay" type="range" min="0" max="1" step="0.01" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Weather FX scale</span>
            <input data-atmosphere="weatherIntensity" type="range" min="0" max="2" step="0.05" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Ambient light</span>
            <input data-atmosphere="hemisphereIntensity" type="range" min="0" max="3" step="0.05" />
          </label>
          <label class="dev-scene-editor__field">
            <span>Sun light</span>
            <input data-atmosphere="sunlightIntensity" type="range" min="0" max="3" step="0.05" />
          </label>
        </div>
      </details>

      <details class="dev-scene-editor__section">
        <summary>Persistence</summary>
        <div class="dev-scene-editor__section-body">
          <div class="dev-scene-editor__button-row">
            <button type="button" data-action="save">Save state</button>
            <button type="button" data-action="export">Export JSON</button>
            <button type="button" data-action="import">Import JSON</button>
            <button type="button" data-action="reset">Reset all</button>
          </div>
          <input data-control="import-file" type="file" accept="application/json,.json" hidden />
          <p class="dev-scene-editor__help">
            State auto-saves locally. JSON includes scene configuration, camera, and semantic object transforms.
          </p>
        </div>
      </details>
    </aside>
  </section>
`;

type ElementConstructor<T extends Element> = abstract new () => T;

const requireElement = <T extends Element>(
  root: ParentNode,
  selector: string,
  constructor: ElementConstructor<T>,
): T => {
  const element = root.querySelector(selector);
  if (!(element instanceof constructor)) {
    throw new TypeError(`Expected editor element ${selector}.`);
  }
  return element;
};

const stableUnit = (key: string, seed: number): number => {
  let hash = (2166136261 ^ seed) >>> 0;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash & 0x00ff_ffff) / 0x00ff_ffff;
};

const finiteInput = (input: HTMLInputElement, fallback: number): number => {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
};

const degrees = (radians: number): number => (radians * 180) / Math.PI;
const radians = (angle: number): number => (angle * Math.PI) / 180;

export const createPersistentSceneViewer = (
  appRoot: HTMLElement,
): Readonly<{ dispose(): void }> | null => {
  if (!editorAvailable()) return null;

  appRoot.innerHTML = editorMarkup();
  const root = requireElement(appRoot, ".dev-scene-editor", HTMLElement);
  const viewport = requireElement(root, ".dev-scene-editor__viewport", HTMLElement);
  const canvas = requireElement(root, ".dev-scene-editor__canvas", HTMLCanvasElement);
  const sidebarToggle = requireElement(
    root,
    ".dev-scene-editor__sidebar-toggle",
    HTMLButtonElement,
  );
  const status = requireElement(root, ".dev-scene-editor__status", HTMLElement);
  const selectedLabel = requireElement(root, "[data-selected]", HTMLElement);
  const objectList = requireElement(
    root,
    '[data-control="object-list"]',
    HTMLSelectElement,
  );
  const importFile = requireElement(
    root,
    '[data-control="import-file"]',
    HTMLInputElement,
  );

  let state = loadEditorState();
  let sceneController: LemonsvilleSceneController | null = null;
  let gizmo: GizmoController | null = null;
  let disposed = false;
  let enforcementFrame: number | null = null;
  let objectRefreshTimer: number | null = null;
  let selection: SceneObjectSelection | null = null;
  let visibilityBeforeDensity = new WeakMap<object, boolean>();
  const originalTransforms = new Map<string, ObjectTransform>();

  const setStatus = (message: string): void => {
    status.textContent = message;
  };

  const persist = (): void => {
    saveEditorState(state);
  };

  const control = (name: string): HTMLInputElement =>
    requireElement(root, `[data-control="${name}"]`, HTMLInputElement);
  const selectControl = (name: string): HTMLSelectElement =>
    requireElement(root, `[data-control="${name}"]`, HTMLSelectElement);

  const transformInputs = Object.freeze({
    px: requireElement(root, '[data-transform="px"]', HTMLInputElement),
    py: requireElement(root, '[data-transform="py"]', HTMLInputElement),
    pz: requireElement(root, '[data-transform="pz"]', HTMLInputElement),
    rx: requireElement(root, '[data-transform="rx"]', HTMLInputElement),
    ry: requireElement(root, '[data-transform="ry"]', HTMLInputElement),
    rz: requireElement(root, '[data-transform="rz"]', HTMLInputElement),
    sx: requireElement(root, '[data-transform="sx"]', HTMLInputElement),
    sy: requireElement(root, '[data-transform="sy"]', HTMLInputElement),
    sz: requireElement(root, '[data-transform="sz"]', HTMLInputElement),
  });

  const setTransformInputsEnabled = (enabled: boolean): void => {
    for (const input of Object.values(transformInputs)) input.disabled = !enabled;
  };

  const syncTransformInputs = (): void => {
    const object = gizmo?.getSelectedObject() ?? null;
    if (object === null) {
      setTransformInputsEnabled(false);
      for (const input of Object.values(transformInputs)) input.value = "";
      return;
    }
    setTransformInputsEnabled(true);
    transformInputs.px.value = object.position.x.toFixed(3);
    transformInputs.py.value = object.position.y.toFixed(3);
    transformInputs.pz.value = object.position.z.toFixed(3);
    transformInputs.rx.value = degrees(object.rotation.x).toFixed(2);
    transformInputs.ry.value = degrees(object.rotation.y).toFixed(2);
    transformInputs.rz.value = degrees(object.rotation.z).toFixed(2);
    transformInputs.sx.value = object.scale.x.toFixed(3);
    transformInputs.sy.value = object.scale.y.toFixed(3);
    transformInputs.sz.value = object.scale.z.toFixed(3);
  };

  const syncControls = (): void => {
    selectControl("weather").value = state.weather;
    selectControl("phase").value = state.phase;
    control("seed").value = String(state.seed);
    control("day").value = String(state.dayNumber);
    control("confidence").value = String(state.confidence);
    control("prepared").value = String(state.prepared);
    control("sold").value = String(state.sold);
    control("signs").value = String(state.visibleSigns);
    control("paused").checked = state.playback.paused;
    control("rate").value = String(state.playback.rate);
    control("duration").value = String(state.durationMs);
    control("orbit").checked = state.orbitEnabled;
    control("fov").value = String(state.camera.fov ?? 34);

    root.querySelectorAll<HTMLInputElement>("[data-density]").forEach((input) => {
      const key = input.dataset["density"] as keyof DevSceneDensityState | undefined;
      if (key !== undefined) input.value = String(state.density[key]);
    });
    root.querySelectorAll<HTMLInputElement>("[data-world]").forEach((input) => {
      const key = input.dataset["world"] as keyof DevSceneWorldState | undefined;
      if (key !== undefined) input.value = String(state.world[key]);
    });
    root
      .querySelectorAll<HTMLInputElement>("[data-atmosphere]")
      .forEach((input) => {
        const key = input.dataset[
          "atmosphere"
        ] as keyof DevSceneAtmosphereState | undefined;
        if (key !== undefined) input.value = String(state.atmosphere[key]);
      });
  };

  const selectMode = (mode: TransformMode): void => {
    gizmo?.setMode(mode);
    root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        button.dataset["mode"] === mode ? "true" : "false",
      );
    });
  };

  const onSelection = (nextSelection: SceneObjectSelection | null): void => {
    selection = nextSelection;
    if (nextSelection === null) {
      selectedLabel.textContent = "No object selected.";
      objectList.value = "";
      syncTransformInputs();
      return;
    }

    const object = gizmo?.getSelectedObject() ?? null;
    if (object !== null && sceneController !== null) {
      if (!originalTransforms.has(nextSelection.key)) {
        originalTransforms.set(
          nextSelection.key,
          captureObjectTransform(sceneController.scene, object),
        );
      }
    }

    selectedLabel.replaceChildren();
    const name = document.createElement("code");
    name.textContent = nextSelection.name;
    selectedLabel.append(
      name,
      document.createTextNode(
        nextSelection.role === null ? "" : ` · ${nextSelection.role}`,
      ),
    );
    objectList.value = nextSelection.key;
    syncTransformInputs();
  };

  const onTransform = (transform: ObjectTransform): void => {
    state = withTransform(state, transform);
    persist();
    syncTransformInputs();
    sceneController?.render();
  };

  const resizeScene = (): void => {
    if (sceneController === null) return;
    const rect = viewport.getBoundingClientRect();
    sceneController.resize(
      Math.max(1, Math.floor(rect.width)),
      Math.max(1, Math.floor(rect.height)),
    );
    gizmo?.applyCameraState(state.camera);
    sceneController.render();
  };

  const refreshObjectList = (): void => {
    if (sceneController === null) return;
    const previous = selection?.key ?? objectList.value;
    const objects = [...indexSceneEditorObjects(sceneController.scene)]
      .filter(([, object]) => {
        if (object.userData["sceneEditorHelper"] === true) return false;
        const role: unknown = object.userData["sceneRole"];
        return object.name.length > 0 || typeof role === "string";
      })
      .map(([key, object]) => {
        const role: unknown = object.userData["sceneRole"];
        const displayName =
          object.name ||
          (typeof role === "string" ? role : object.type);
        return Object.freeze({
          key,
          displayName,
          role: typeof role === "string" ? role : null,
        });
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName));

    const fragment = document.createDocumentFragment();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select in viewport or choose object";
    fragment.appendChild(placeholder);
    for (const object of objects) {
      const option = document.createElement("option");
      option.value = object.key;
      option.textContent =
        object.role === null
          ? object.displayName
          : `${object.displayName} — ${object.role}`;
      fragment.appendChild(option);
    }
    objectList.replaceChildren(fragment);
    objectList.value = objects.some((object) => object.key === previous)
      ? previous
      : "";
  };

  const densityForObject = (
    key: string,
    object: ReturnType<
      typeof indexSceneEditorObjects
    > extends ReadonlyMap<string, infer TObject>
      ? TObject
      : never,
  ): number | null => {
    const role: unknown = object.userData["sceneRole"];
    const roleName = typeof role === "string" ? role : "";

    if (object.name.startsWith("building-")) return state.world.buildings;
    if (
      roleName === "road" ||
      roleName === "sidewalk" ||
      roleName === "driveway" ||
      roleName === "front-path"
    ) {
      return state.world.streets;
    }
    if (roleName === "procedural-tree") return state.world.trees;
    if (roleName === "procedural-shrub") return state.world.shrubs;
    if (roleName === "garden-flower") return state.world.flowers;
    if (roleName === "pedestrian") return state.density.pedestrians;
    if (roleName === "ambient-vehicle") return state.density.vehicles;
    if (roleName === "ambient-bicycle") return state.density.bicycles;
    if (roleName === "ambient-pet") return state.density.pets;
    if (
      roleName === "ambient-resident" ||
      roleName === "ambient-mail-carrier" ||
      roleName === "ambient-gardener"
    ) {
      return state.density.residents;
    }
    if (roleName === "ambient-bird") return state.density.wildlife;

    void key;
    return null;
  };

  const applyDensityControls = (): void => {
    if (sceneController === null) return;
    const objects = indexSceneEditorObjects(sceneController.scene);
    for (const [key, object] of objects) {
      const density = densityForObject(key, object);
      if (density === null) continue;
      const shouldShow = density >= 1 || stableUnit(key, state.seed) <= density;

      if (!shouldShow) {
        if (!visibilityBeforeDensity.has(object)) {
          visibilityBeforeDensity.set(object, object.visible);
        }
        object.visible = false;
      } else if (visibilityBeforeDensity.has(object)) {
        const previous = visibilityBeforeDensity.get(object);
        visibilityBeforeDensity.delete(object);
        if (previous !== undefined) object.visible = previous;
      }
    }
  };

  const applyAtmosphereControls = (): void => {
    if (sceneController === null) return;
    const objects = indexSceneEditorObjects(sceneController.scene);
    const hemisphere = objects.get("name:hemisphere-light") as
      | (object & { intensity?: number })
      | undefined;
    const sunlight = objects.get("name:sunlight") as
      | (object & { intensity?: number })
      | undefined;

    const daylight = Math.max(
      0.04,
      Math.sin(Math.PI * state.atmosphere.timeOfDay),
    );
    if (hemisphere !== undefined && typeof hemisphere.intensity === "number") {
      hemisphere.intensity =
        1.9 *
        state.atmosphere.hemisphereIntensity *
        (0.22 + daylight * 0.78);
    }
    if (sunlight !== undefined && typeof sunlight.intensity === "number") {
      sunlight.intensity =
        1.8 * state.atmosphere.sunlightIntensity * daylight;
    }

    const weatherRoot = objects.get(`name:weather-${state.weather}`);
    if (weatherRoot !== undefined) {
      const fxScale = Math.max(0.01, 0.65 + state.atmosphere.weatherIntensity * 0.35);
      weatherRoot.scale.setScalar(fxScale);
      weatherRoot.visible = state.atmosphere.weatherIntensity > 0;
    }
  };

  const applySavedTransforms = (): void => {
    if (sceneController === null) return;
    const objects = indexSceneEditorObjects(sceneController.scene);
    for (const transform of state.transforms) {
      const object = objects.get(transform.key);
      if (object === undefined) continue;
      if (!originalTransforms.has(transform.key)) {
        originalTransforms.set(
          transform.key,
          captureObjectTransform(sceneController.scene, object),
        );
      }
      applyObjectTransform(object, transform);
    }
  };

  const enforceEditorOverrides = (): void => {
    enforcementFrame = null;
    if (disposed || sceneController === null) return;
    applySavedTransforms();
    applyDensityControls();
    applyAtmosphereControls();
    sceneController.render();
    enforcementFrame = window.requestAnimationFrame(enforceEditorOverrides);
  };

  const startEnforcement = (): void => {
    if (enforcementFrame === null) {
      enforcementFrame = window.requestAnimationFrame(enforceEditorOverrides);
    }
  };

  const buildGizmo = (): void => {
    if (sceneController === null) return;
    gizmo?.dispose();
    gizmo = createGizmoController({
      camera: sceneController.camera,
      scene: sceneController.scene,
      container: canvas,
      onSelectionChanged: onSelection,
      onTransformChanged: onTransform,
      onCameraChanged: (camera) => {
        state = Object.freeze({ ...state, camera });
        persist();
      },
    });
    gizmo.setOrbitEnabled(state.orbitEnabled);
    gizmo.applyCameraState(state.camera);
    selectMode("translate");
  };

  const rebuildScene = (): void => {
    gizmo?.dispose();
    gizmo = null;
    sceneController?.dispose();
    sceneController = null;
    selection = null;
    originalTransforms.clear();
    visibilityBeforeDensity = new WeakMap<object, boolean>();

    const nextScene = createLemonsvilleScene(canvas, editorSceneState(state), {
      enableGizmo: false,
    });
    if (nextScene === null) {
      const error = document.createElement("p");
      error.className = "dev-scene-editor__error";
      error.textContent = "WebGL scene creation failed.";
      viewport.appendChild(error);
      setStatus("Scene creation failed.");
      return;
    }

    sceneController = nextScene;
    buildGizmo();
    resizeScene();
    applySavedTransforms();
    applyDensityControls();
    applyAtmosphereControls();
    sceneController.render();
    refreshObjectList();
    setStatus(`Scene rebuilt from seed ${String(state.seed)}.`);
  };

  const updateScene = (): void => {
    if (sceneController === null) return;
    const cameraState = gizmo?.getCameraState() ?? state.camera;
    sceneController.update(editorSceneState(state));
    gizmo?.applyCameraState(cameraState);
    applyDensityControls();
    applyAtmosphereControls();
    sceneController.render();
  };

  const commitParsedState = (
    candidate: unknown,
    mode: "update" | "rebuild" = "update",
  ): void => {
    state = parseDevSceneEditorState(candidate, state);
    persist();
    syncControls();
    if (mode === "rebuild") rebuildScene();
    else updateScene();
  };

  const applyTransformInputs = (): void => {
    const object = gizmo?.getSelectedObject() ?? null;
    if (object === null || sceneController === null) return;

    object.position.set(
      finiteInput(transformInputs.px, object.position.x),
      finiteInput(transformInputs.py, object.position.y),
      finiteInput(transformInputs.pz, object.position.z),
    );
    object.rotation.set(
      radians(finiteInput(transformInputs.rx, degrees(object.rotation.x))),
      radians(finiteInput(transformInputs.ry, degrees(object.rotation.y))),
      radians(finiteInput(transformInputs.rz, degrees(object.rotation.z))),
    );
    object.scale.set(
      Math.max(0.001, finiteInput(transformInputs.sx, object.scale.x)),
      Math.max(0.001, finiteInput(transformInputs.sy, object.scale.y)),
      Math.max(0.001, finiteInput(transformInputs.sz, object.scale.z)),
    );
    object.updateMatrixWorld(true);
    onTransform(captureObjectTransform(sceneController.scene, object));
  };

  selectControl("preset").addEventListener("change", (event) => {
    const target = event.currentTarget as HTMLSelectElement;
    const preset = PRESETS[target.value];
    if (preset === undefined) return;
    commitParsedState({
      ...state,
      weather: preset.weather,
      phase: preset.phase,
      confidence: preset.confidence,
      nextConfidence: preset.confidence,
      prepared: preset.prepared,
      sold: preset.sold,
    });
  });

  selectControl("weather").addEventListener("change", (event) => {
    commitParsedState({
      ...state,
      weather: (event.currentTarget as HTMLSelectElement).value,
    });
  });

  selectControl("phase").addEventListener("change", (event) => {
    commitParsedState({
      ...state,
      phase: (event.currentTarget as HTMLSelectElement).value,
    });
  });

  control("seed").addEventListener("change", (event) => {
    commitParsedState(
      {
        ...state,
        seed: finiteInput(event.currentTarget as HTMLInputElement, state.seed),
      },
      "rebuild",
    );
  });

  control("day").addEventListener("change", (event) => {
    commitParsedState({
      ...state,
      dayNumber: finiteInput(
        event.currentTarget as HTMLInputElement,
        state.dayNumber,
      ),
    });
  });

  control("confidence").addEventListener("input", (event) => {
    const confidence = finiteInput(
      event.currentTarget as HTMLInputElement,
      state.confidence,
    );
    commitParsedState({
      ...state,
      confidence,
      nextConfidence: confidence,
    });
  });

  control("prepared").addEventListener("change", (event) => {
    commitParsedState({
      ...state,
      prepared: finiteInput(
        event.currentTarget as HTMLInputElement,
        state.prepared,
      ),
    });
  });

  control("sold").addEventListener("change", (event) => {
    commitParsedState({
      ...state,
      sold: finiteInput(event.currentTarget as HTMLInputElement, state.sold),
    });
  });

  control("signs").addEventListener("change", (event) => {
    commitParsedState({
      ...state,
      visibleSigns: finiteInput(
        event.currentTarget as HTMLInputElement,
        state.visibleSigns,
      ),
    });
  });

  control("paused").addEventListener("change", (event) => {
    commitParsedState({
      ...state,
      playback: {
        ...state.playback,
        paused: (event.currentTarget as HTMLInputElement).checked,
      },
    });
  });

  control("rate").addEventListener("input", (event) => {
    commitParsedState({
      ...state,
      playback: {
        ...state.playback,
        rate: finiteInput(
          event.currentTarget as HTMLInputElement,
          state.playback.rate,
        ),
      },
    });
  });

  control("duration").addEventListener("change", (event) => {
    commitParsedState({
      ...state,
      durationMs: finiteInput(
        event.currentTarget as HTMLInputElement,
        state.durationMs,
      ),
    });
  });

  control("orbit").addEventListener("change", (event) => {
    state = Object.freeze({
      ...state,
      orbitEnabled: (event.currentTarget as HTMLInputElement).checked,
    });
    persist();
    gizmo?.setOrbitEnabled(state.orbitEnabled);
  });

  control("fov").addEventListener("input", (event) => {
    const fov = finiteInput(
      event.currentTarget as HTMLInputElement,
      state.camera.fov ?? 34,
    );
    gizmo?.setFov(fov);
    if (gizmo !== null) {
      state = Object.freeze({ ...state, camera: gizmo.getCameraState() });
      persist();
    }
    sceneController?.render();
  });

  root.querySelectorAll<HTMLInputElement>("[data-density]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset["density"] as keyof DevSceneDensityState | undefined;
      if (key === undefined) return;
      commitParsedState({
        ...state,
        density: {
          ...state.density,
          [key]: finiteInput(input, state.density[key]),
        },
      });
    });
  });

  root.querySelectorAll<HTMLInputElement>("[data-world]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset["world"] as keyof DevSceneWorldState | undefined;
      if (key === undefined) return;
      state = parseDevSceneEditorState({
        ...state,
        world: {
          ...state.world,
          [key]: finiteInput(input, state.world[key]),
        },
      });
      persist();
    });
  });

  root
    .querySelectorAll<HTMLInputElement>("[data-atmosphere]")
    .forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.dataset[
          "atmosphere"
        ] as keyof DevSceneAtmosphereState | undefined;
        if (key === undefined) return;
        state = parseDevSceneEditorState({
          ...state,
          atmosphere: {
            ...state.atmosphere,
            [key]: finiteInput(input, state.atmosphere[key]),
          },
        });
        persist();
        applyAtmosphereControls();
        sceneController?.render();
      });
    });

  root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset["mode"] as TransformMode | undefined;
      if (mode !== undefined) selectMode(mode);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset["view"] as SceneEditorView | undefined;
      if (view === undefined) return;
      gizmo?.setView(view);
      if (gizmo !== null) {
        state = Object.freeze({ ...state, camera: gizmo.getCameraState() });
        persist();
      }
      sceneController?.render();
    });
  });

  objectList.addEventListener("change", () => {
    if (sceneController === null || gizmo === null) return;
    const object = indexSceneEditorObjects(sceneController.scene).get(objectList.value);
    if (object === undefined) gizmo.deselectObject();
    else gizmo.selectObject(object);
    sceneController.render();
  });

  for (const input of Object.values(transformInputs)) {
    input.addEventListener("change", applyTransformInputs);
  }

  requireElement(root, '[data-action="focus"]', HTMLButtonElement).addEventListener(
    "click",
    () => {
      gizmo?.focusSelected();
      sceneController?.render();
    },
  );

  requireElement(
    root,
    '[data-action="deselect"]',
    HTMLButtonElement,
  ).addEventListener("click", () => gizmo?.deselectObject());

  requireElement(
    root,
    '[data-action="save-transform"]',
    HTMLButtonElement,
  ).addEventListener("click", () => {
    const object = gizmo?.getSelectedObject() ?? null;
    if (object === null || sceneController === null) {
      setStatus("Select an object before saving a transform.");
      return;
    }
    const transform = captureObjectTransform(sceneController.scene, object);
    state = withTransform(state, transform);
    persist();
    setStatus(`Saved transform for ${transform.name}.`);
  });

  requireElement(
    root,
    '[data-action="reset-transform"]',
    HTMLButtonElement,
  ).addEventListener("click", () => {
    if (selection === null || sceneController === null) return;
    const original = originalTransforms.get(selection.key);
    const object = indexSceneEditorObjects(sceneController.scene).get(selection.key);
    if (original === undefined || object === undefined) return;
    applyObjectTransform(object, original);
    state = withoutTransform(state, selection.key);
    persist();
    syncTransformInputs();
    sceneController.render();
    setStatus(`Reset transform for ${selection.name}.`);
  });

  requireElement(
    root,
    '[data-action="regenerate"]',
    HTMLButtonElement,
  ).addEventListener("click", rebuildScene);

  requireElement(
    root,
    '[data-action="randomize-seed"]',
    HTMLButtonElement,
  ).addEventListener("click", () => {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now();
    commitParsedState({ ...state, seed }, "rebuild");
  });

  requireElement(root, '[data-action="save"]', HTMLButtonElement).addEventListener(
    "click",
    () => {
      persist();
      setStatus("Editor state saved locally.");
    },
  );

  requireElement(
    root,
    '[data-action="export"]',
    HTMLButtonElement,
  ).addEventListener("click", () => {
    const blob = new Blob([serializeDevSceneEditorState(state)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lemonade-scene-${String(state.seed)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus("Editor state exported.");
  });

  requireElement(
    root,
    '[data-action="import"]',
    HTMLButtonElement,
  ).addEventListener("click", () => importFile.click());

  importFile.addEventListener("change", () => {
    const file = importFile.files?.[0];
    if (file === undefined) return;
    void file.text().then((text) => {
      state = deserializeDevSceneEditorState(text, state);
      persist();
      syncControls();
      rebuildScene();
      importFile.value = "";
      setStatus("Imported editor state.");
    });
  });

  requireElement(root, '[data-action="reset"]', HTMLButtonElement).addEventListener(
    "click",
    () => {
      state = DEFAULT_DEV_SCENE_EDITOR_STATE;
      persist();
      syncControls();
      rebuildScene();
      setStatus("Editor state reset to defaults.");
    },
  );

  requireElement(root, '[data-action="exit"]', HTMLButtonElement).addEventListener(
    "click",
    disableSceneViewer,
  );

  sidebarToggle.addEventListener("click", () => {
    const collapsed = root.dataset["sidebarCollapsed"] === "true";
    root.dataset["sidebarCollapsed"] = collapsed ? "false" : "true";
    sidebarToggle.setAttribute("aria-expanded", collapsed ? "true" : "false");
    window.requestAnimationFrame(resizeScene);
  });

  const resizeObserver = new ResizeObserver(resizeScene);
  resizeObserver.observe(viewport);

  syncControls();
  syncTransformInputs();
  rebuildScene();
  startEnforcement();
  objectRefreshTimer = window.setInterval(refreshObjectList, 1_000);

  return Object.freeze({
    dispose(): void {
      if (disposed) return;
      disposed = true;
      resizeObserver.disconnect();
      if (objectRefreshTimer !== null) window.clearInterval(objectRefreshTimer);
      if (enforcementFrame !== null) window.cancelAnimationFrame(enforcementFrame);
      gizmo?.dispose();
      sceneController?.dispose();
      gizmo = null;
      sceneController = null;
    },
  });
};

if (typeof window !== "undefined" && editorAvailable()) {
  Object.assign(window, {
    enableSceneViewer,
    disableSceneViewer,
  });
}
