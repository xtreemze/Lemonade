/**
 * Development-only persistent Three.js scene editor.
 *
 * Enable with:
 * localStorage.setItem("LEMONADE_DEV_SCENE_VIEWER", "1")
 */

import {
  createGizmoController,
  createLemonsvilleScene,
  type GizmoController,
  type LemonsvilleSceneController,
  type LemonsvilleSceneState,
  type ScenePhase,
  type SceneWeather,
} from "@lemonade/scene";
import { createStreetStoryboard } from "@lemonade/scene/storyboard-create";

const VIEWER_FLAG = "LEMONADE_DEV_SCENE_VIEWER";
const EDITOR_STATE_KEY = "LEMONADE_DEV_SCENE_EDITOR_STATE";

type Vec3 = [number, number, number];
type TransformMode = "translate" | "rotate" | "scale";

type StoredTransform = {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
};

type EditorConfig = {
  weather: SceneWeather;
  phase: ScenePhase;
  confidence: number;
  prepared: number;
  sold: number;
  visibleSigns: number;
  durationMs: number;
  characterSeed: number;
  dayNumber: number;
  population: {
    pedestrians: number;
    speed: number;
    vehicles: number;
    bicycles: number;
    pets: number;
    wildlife: number;
  };
  procedural: {
    seed: number;
    buildings: number;
    vegetation: number;
    streets: number;
  };
  atmosphere: {
    liveTime: boolean;
    timeProgress: number;
    sunIntensity: number;
    ambientIntensity: number;
    windScale: number;
  };
  camera: {
    enabled: boolean;
    position: Vec3;
    target: Vec3;
    fov: number;
  };
  transforms: Record<string, StoredTransform>;
};

const DEFAULT_CONFIG: EditorConfig = {
  weather: "sunny",
  phase: "simulation",
  confidence: 3,
  prepared: 20,
  sold: 10,
  visibleSigns: 5,
  durationMs: 14_000,
  characterSeed: 12_345,
  dayNumber: 1,
  population: {
    pedestrians: 36,
    speed: 1,
    vehicles: 8,
    bicycles: 3,
    pets: 2,
    wildlife: 4,
  },
  procedural: {
    seed: 0x4c_45_4d_4f,
    buildings: 1,
    vegetation: 1,
    streets: 1,
  },
  atmosphere: {
    liveTime: true,
    timeProgress: 0.5,
    sunIntensity: 1.8,
    ambientIntensity: 1.9,
    windScale: 1,
  },
  camera: {
    enabled: false,
    position: [0, 6.8, 13.5],
    target: [0, 1.7, 0],
    fov: 34,
  },
  transforms: {},
};

const cloneDefaults = (): EditorConfig =>
  JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as EditorConfig;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

const clampInt = (value: number, min: number, max: number): number =>
  Math.trunc(clamp(value, min, max));

const WEATHER_KINDS: readonly SceneWeather[] = [
  "sunny",
  "cloudy",
  "hot-and-dry",
  "thunderstorm",
];

const PHASES: readonly ScenePhase[] = ["forecast", "idle", "simulation"];

const isWeather = (value: unknown): value is SceneWeather =>
  typeof value === "string" && WEATHER_KINDS.includes(value as SceneWeather);

const isPhase = (value: unknown): value is ScenePhase =>
  typeof value === "string" && PHASES.includes(value as ScenePhase);

const vec3From = (value: unknown, fallback: Vec3): Vec3 => {
  if (!Array.isArray(value) || value.length !== 3) return [...fallback];
  return [
    Number.isFinite(Number(value[0])) ? Number(value[0]) : fallback[0],
    Number.isFinite(Number(value[1])) ? Number(value[1]) : fallback[1],
    Number.isFinite(Number(value[2])) ? Number(value[2]) : fallback[2],
  ];
};

const parseConfig = (value: unknown): EditorConfig => {
  const base = cloneDefaults();
  if (typeof value !== "object" || value === null) return base;
  const raw = value as Partial<EditorConfig>;
  const population: Partial<EditorConfig["population"]> =
    typeof raw.population === "object" && raw.population !== null
      ? raw.population
      : {};
  const procedural: Partial<EditorConfig["procedural"]> =
    typeof raw.procedural === "object" && raw.procedural !== null
      ? raw.procedural
      : {};
  const atmosphere: Partial<EditorConfig["atmosphere"]> =
    typeof raw.atmosphere === "object" && raw.atmosphere !== null
      ? raw.atmosphere
      : {};
  const camera: Partial<EditorConfig["camera"]> =
    typeof raw.camera === "object" && raw.camera !== null ? raw.camera : {};

  base.weather = isWeather(raw.weather) ? raw.weather : base.weather;
  base.phase = isPhase(raw.phase) ? raw.phase : base.phase;
  base.confidence = clampInt(Number(raw.confidence ?? base.confidence), 0, 5);
  base.prepared = clampInt(Number(raw.prepared ?? base.prepared), 0, 250);
  base.sold = clampInt(Number(raw.sold ?? base.sold), 0, 250);
  base.visibleSigns = clampInt(Number(raw.visibleSigns ?? base.visibleSigns), 0, 40);
  base.durationMs = clampInt(Number(raw.durationMs ?? base.durationMs), 1_000, 120_000);
  base.characterSeed = clampInt(
    Number(raw.characterSeed ?? base.characterSeed),
    0,
    0xffff_ffff,
  );
  base.dayNumber = clampInt(Number(raw.dayNumber ?? base.dayNumber), 1, 10_000);

  base.population.pedestrians = clampInt(
    Number(population.pedestrians ?? base.population.pedestrians),
    0,
    128,
  );
  base.population.speed = clamp(
    Number(population.speed ?? base.population.speed),
    0.1,
    4,
  );
  base.population.vehicles = clampInt(
    Number(population.vehicles ?? base.population.vehicles),
    0,
    8,
  );
  base.population.bicycles = clampInt(
    Number(population.bicycles ?? base.population.bicycles),
    0,
    3,
  );
  base.population.pets = clampInt(
    Number(population.pets ?? base.population.pets),
    0,
    3,
  );
  base.population.wildlife = clampInt(
    Number(population.wildlife ?? base.population.wildlife),
    0,
    4,
  );

  base.procedural.seed = clampInt(
    Number(procedural.seed ?? base.procedural.seed),
    0,
    0xffff_ffff,
  );
  base.procedural.buildings = clamp(
    Number(procedural.buildings ?? base.procedural.buildings),
    0,
    1,
  );
  base.procedural.vegetation = clamp(
    Number(procedural.vegetation ?? base.procedural.vegetation),
    0,
    1,
  );
  base.procedural.streets = clamp(
    Number(procedural.streets ?? base.procedural.streets),
    0,
    1,
  );

  base.atmosphere.liveTime =
    typeof atmosphere.liveTime === "boolean"
      ? atmosphere.liveTime
      : base.atmosphere.liveTime;
  base.atmosphere.timeProgress = clamp(
    Number(atmosphere.timeProgress ?? base.atmosphere.timeProgress),
    0,
    1,
  );
  base.atmosphere.sunIntensity = clamp(
    Number(atmosphere.sunIntensity ?? base.atmosphere.sunIntensity),
    0,
    5,
  );
  base.atmosphere.ambientIntensity = clamp(
    Number(atmosphere.ambientIntensity ?? base.atmosphere.ambientIntensity),
    0,
    5,
  );
  base.atmosphere.windScale = clamp(
    Number(atmosphere.windScale ?? base.atmosphere.windScale),
    0,
    3,
  );

  base.camera.enabled =
    typeof camera.enabled === "boolean" ? camera.enabled : base.camera.enabled;
  base.camera.position = vec3From(camera.position, base.camera.position);
  base.camera.target = vec3From(camera.target, base.camera.target);
  base.camera.fov = clamp(Number(camera.fov ?? base.camera.fov), 10, 90);

  if (typeof raw.transforms === "object" && raw.transforms !== null) {
    for (const [name, candidate] of Object.entries(raw.transforms)) {
      if (typeof candidate !== "object" || candidate === null || name.length === 0) {
        continue;
      }
      const transform = candidate as Partial<StoredTransform>;
      base.transforms[name] = {
        position: vec3From(transform.position, [0, 0, 0]),
        rotation: vec3From(transform.rotation, [0, 0, 0]),
        scale: vec3From(transform.scale, [1, 1, 1]),
      };
    }
  }

  return base;
};

const loadConfig = (): EditorConfig => {
  if (typeof localStorage === "undefined") return cloneDefaults();
  const raw = localStorage.getItem(EDITOR_STATE_KEY);
  if (raw === null) return cloneDefaults();
  try {
    return parseConfig(JSON.parse(raw));
  } catch {
    return cloneDefaults();
  }
};

const saveConfig = (config: EditorConfig): void => {
  localStorage.setItem(EDITOR_STATE_KEY, JSON.stringify(config));
};

export const isSceneViewerEnabled = (): boolean =>
  typeof localStorage !== "undefined" && localStorage.getItem(VIEWER_FLAG) === "1";

export const enableSceneViewer = (): void => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(VIEWER_FLAG, "1");
  console.log("Scene editor enabled. Refresh the page to activate.");
};

export const disableSceneViewer = (): void => {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(VIEWER_FLAG);
  console.log("Scene editor disabled. Refresh the page.");
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const keepForDensity = (key: string, density: number): boolean => {
  if (density >= 1) return true;
  if (density <= 0) return false;
  return hashString(key) / 0xffff_ffff <= density;
};

const createButton = (label: string, action: () => void): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.cssText =
    "min-height:32px;padding:5px 8px;border:1px solid #6f7278;border-radius:4px;background:#202329;color:#f5f5f5;font:inherit;cursor:pointer;";
  button.addEventListener("click", action);
  return button;
};

const createSection = (
  parent: HTMLElement,
  title: string,
  open = false,
): HTMLElement => {
  const details = document.createElement("details");
  details.open = open;
  details.style.cssText =
    "border-bottom:1px solid #34373d;padding:0 0 6px;margin:0 0 6px;";
  const summary = document.createElement("summary");
  summary.textContent = title;
  summary.style.cssText =
    "cursor:pointer;font-weight:700;padding:8px 2px;color:#f4d96b;user-select:none;";
  const body = document.createElement("div");
  body.style.cssText = "display:grid;gap:6px;padding:2px 0 4px;";
  details.append(summary, body);
  parent.appendChild(details);
  return body;
};

const createControlRow = (
  parent: HTMLElement,
  labelText: string,
): HTMLLabelElement => {
  const row = document.createElement("label");
  row.style.cssText =
    "display:grid;grid-template-columns:minmax(88px,1fr) minmax(112px,1.25fr);gap:8px;align-items:center;min-width:0;";
  const label = document.createElement("span");
  label.textContent = labelText;
  label.style.cssText = "color:#c8cad0;min-width:0;";
  row.appendChild(label);
  parent.appendChild(row);
  return row;
};

const createNumberControl = (
  parent: HTMLElement,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  onValue: (value: number) => void,
): HTMLInputElement => {
  const row = createControlRow(parent, label);
  const input = document.createElement("input");
  input.type = "number";
  input.value = String(value);
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.style.cssText =
    "min-width:0;width:100%;box-sizing:border-box;background:#121419;color:#f5f5f5;border:1px solid #555a62;border-radius:4px;padding:5px 6px;font:inherit;";
  input.addEventListener("change", () => {
    const next = clamp(Number(input.value), min, max);
    input.value = String(next);
    onValue(next);
  });
  row.appendChild(input);
  return input;
};

const createRangeControl = (
  parent: HTMLElement,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  format: (value: number) => string,
  onValue: (value: number) => void,
): HTMLInputElement => {
  const row = createControlRow(parent, label);
  const host = document.createElement("div");
  host.style.cssText = "display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;min-width:0;";
  const input = document.createElement("input");
  input.type = "range";
  input.value = String(value);
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.style.cssText = "width:100%;min-width:0;";
  const output = document.createElement("output");
  output.textContent = format(value);
  output.style.cssText = "min-width:42px;text-align:right;color:#f5f5f5;";
  input.addEventListener("input", () => {
    const next = clamp(Number(input.value), min, max);
    output.textContent = format(next);
    onValue(next);
  });
  host.append(input, output);
  row.appendChild(host);
  return input;
};

const createCheckboxControl = (
  parent: HTMLElement,
  label: string,
  checked: boolean,
  onValue: (value: boolean) => void,
): HTMLInputElement => {
  const row = createControlRow(parent, label);
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.style.cssText = "width:20px;height:20px;";
  input.addEventListener("change", () => onValue(input.checked));
  row.appendChild(input);
  return input;
};

const createSelectControl = <T extends string>(
  parent: HTMLElement,
  label: string,
  values: readonly T[],
  current: T,
  format: (value: T) => string,
  onValue: (value: T) => void,
): HTMLSelectElement => {
  const row = createControlRow(parent, label);
  const select = document.createElement("select");
  select.style.cssText =
    "min-width:0;width:100%;box-sizing:border-box;background:#121419;color:#f5f5f5;border:1px solid #555a62;border-radius:4px;padding:5px 6px;font:inherit;";
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = format(value);
    option.selected = value === current;
    select.appendChild(option);
  }
  select.addEventListener("change", () => onValue(select.value as T));
  row.appendChild(select);
  return select;
};

const createButtonRow = (
  parent: HTMLElement,
  buttons: ReadonlyArray<readonly [string, () => void]>,
): void => {
  const row = document.createElement("div");
  row.style.cssText = "display:flex;flex-wrap:wrap;gap:5px;";
  for (const [label, action] of buttons) row.appendChild(createButton(label, action));
  parent.appendChild(row);
};

const downloadJson = (filename: string, value: unknown): void => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const createPersistentSceneViewer = (
  appRoot: HTMLElement,
  options: {
    enableGizmo?: boolean;
    weather?: SceneWeather;
    phase?: ScenePhase;
  } = {},
): Readonly<{ dispose(): void }> => {
  appRoot.innerHTML = "";

  const config = loadConfig();
  if (options.weather !== undefined) config.weather = options.weather;
  if (options.phase !== undefined) config.phase = options.phase;
  saveConfig(config);

  const style = document.createElement("style");
  style.textContent =
    ".lemonade-dev-viewer{width:100%;height:100dvh;max-height:100dvh;display:flex;overflow:hidden;background:#08090b;color:#f5f5f5;font:12px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace}" +
    ".lemonade-dev-canvas-host{flex:1;min-width:0;min-height:0;position:relative;background:#000}" +
    ".lemonade-dev-canvas{width:100%;height:100%;display:block;touch-action:none}" +
    ".lemonade-dev-sidebar{width:min(360px,42vw);min-width:290px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;border-left:1px solid #4f5259;background:#111318}" +
    ".lemonade-dev-sections{flex:1;min-height:0;overflow-y:auto;padding:0 10px 12px}" +
    "@media (max-width:720px){.lemonade-dev-viewer{flex-direction:column}.lemonade-dev-canvas-host{min-height:52%}.lemonade-dev-sidebar{width:100%;min-width:0;height:48%;border-left:0;border-top:1px solid #4f5259}}";
  appRoot.appendChild(style);

  const container = document.createElement("div");
  container.className = "lemonade-dev-viewer";

  const canvasHost = document.createElement("div");
  canvasHost.className = "lemonade-dev-canvas-host";
  const canvas = document.createElement("canvas");
  canvas.className = "lemonade-dev-canvas";
  canvas.setAttribute("aria-label", "Lemonsville Three.js scene editor viewport");
  canvasHost.appendChild(canvas);

  const sidebar = document.createElement("aside");
  sidebar.className = "lemonade-dev-sidebar";
  sidebar.setAttribute("aria-label", "3D scene developer tools");

  const header = document.createElement("div");
  header.style.cssText = "padding:10px;border-bottom:1px solid #34373d;display:grid;gap:6px;";
  const title = document.createElement("strong");
  title.textContent = "Lemonsville Scene Editor";
  title.style.cssText = "font-size:14px;color:#f4d96b;";
  const status = document.createElement("div");
  status.textContent = "Initializing scene…";
  status.style.cssText = "color:#9ea3ad;white-space:normal;";
  const exit = createButton("Exit editor", () => {
    disableSceneViewer();
    location.reload();
  });
  header.append(title, status, exit);

  const sections = document.createElement("div");
  sections.className = "lemonade-dev-sections";
  sidebar.append(header, sections);
  container.append(canvasHost, sidebar);
  appRoot.appendChild(container);

  let controller: LemonsvilleSceneController | null = null;
  let gizmo: GizmoController | null = null;
  let disposed = false;
  let editorFrame: number | null = null;
  let refreshTimer: number | null = null;
  let selectedObjectName = "";

  const buildState = (): LemonsvilleSceneState => {
    const prepared = Math.max(config.prepared, config.sold);
    const commonDev = {
      pedestrianLimit: config.population.pedestrians,
      crowdSpeed: config.population.speed,
      ambientPopulation: {
        vehicles: config.population.vehicles,
        bicycles: config.population.bicycles,
        pets: config.population.pets,
        wildlife: config.population.wildlife,
      },
    };
    const dev = config.atmosphere.liveTime
      ? commonDev
      : { ...commonDev, timeProgress: config.atmosphere.timeProgress };

    return Object.freeze({
      weather: config.weather,
      visibleSigns: config.visibleSigns,
      prepared,
      durationMs: config.durationMs,
      confidence: config.confidence,
      nextConfidence: config.confidence,
      characterSeed: config.characterSeed >>> 0,
      dayNumber: config.dayNumber,
      storyboard: createStreetStoryboard({
        durationMs: config.durationMs,
        prepared,
        sold: config.phase === "simulation" ? Math.min(config.sold, prepared) : 0,
        visibleSigns: config.visibleSigns,
        priceCents: 150,
        ambientPedestrianCount: config.population.pedestrians,
      }),
      phase: config.phase,
      reducedMotion: false,
      dev,
    });
  };

  const persist = (): void => saveConfig(config);

  const updateSceneState = (): void => {
    persist();
    controller?.update(buildState());
  };

  const objectKey = (name: string, fallback: string): string =>
    name.length > 0 ? name : fallback;

  const applyStaticDensity = (): void => {
    if (controller === null) return;
    const streetRoles = new Set([
      "road",
      "sidewalk",
      "road-marking",
      "driveway",
      "front-path",
    ]);
    controller.scene.children.forEach((object, index) => {
      const roleValue = object.userData["sceneRole"];
      const role = typeof roleValue === "string" ? roleValue : "";
      const fallback =
        role +
        ":" +
        object.position.x.toFixed(2) +
        ":" +
        object.position.z.toFixed(2) +
        ":" +
        String(index);
      if (object.name.startsWith("building-")) {
        object.visible = keepForDensity(
          objectKey(object.name, fallback),
          config.procedural.buildings,
        );
      } else if (object.userData["windResponsive"] === true) {
        object.visible = keepForDensity(
          objectKey(object.name, fallback),
          config.procedural.vegetation,
        );
      } else if (streetRoles.has(role)) {
        object.visible = keepForDensity(
          objectKey(object.name, fallback),
          config.procedural.streets,
        );
      }
    });
  };

  const applySavedTransforms = (): void => {
    if (controller === null) return;
    const selected = gizmo?.getSelectedObject() ?? null;
    controller.scene.traverse((object) => {
      if (object === selected || object.name.length === 0) return;
      const transform = config.transforms[object.name];
      if (transform === undefined) return;
      object.position.set(...transform.position);
      object.rotation.set(...transform.rotation);
      object.scale.set(...transform.scale);
    });
  };

  const applyAtmosphere = (): void => {
    if (controller === null) return;
    controller.scene.traverse((object) => {
      if (object.type === "DirectionalLight" && "intensity" in object) {
        (object as unknown as { intensity: number }).intensity =
          config.atmosphere.sunIntensity;
      } else if (object.type === "HemisphereLight" && "intensity" in object) {
        (object as unknown as { intensity: number }).intensity =
          config.atmosphere.ambientIntensity;
      }

      if (object.userData["windResponsive"] === true) {
        const baseX = Number(object.userData["windBaseRotationX"] ?? object.rotation.x);
        const baseZ = Number(object.userData["windBaseRotationZ"] ?? object.rotation.z);
        object.rotation.x =
          baseX + (object.rotation.x - baseX) * config.atmosphere.windScale;
        object.rotation.z =
          baseZ + (object.rotation.z - baseZ) * config.atmosphere.windScale;
      }
    });
  };

  const applyCamera = (): void => {
    if (controller === null || !config.camera.enabled) return;
    const camera = controller.camera;
    camera.position.set(...config.camera.position);
    camera.fov = config.camera.fov;
    camera.lookAt(...config.camera.target);
    camera.updateProjectionMatrix();
  };

  const applyEditorOverrides = (): void => {
    applyStaticDensity();
    applySavedTransforms();
    applyAtmosphere();
    applyCamera();
  };

  const renderEditorFrame = (): void => {
    if (disposed) return;
    applyEditorOverrides();
    controller?.render();
    editorFrame = window.requestAnimationFrame(renderEditorFrame);
  };

  const resize = (): void => {
    if (controller === null) return;
    const rect = canvasHost.getBoundingClientRect();
    controller.resize(Math.max(1, rect.width), Math.max(1, rect.height));
  };

  const sceneSection = createSection(sections, "Scene and conditions", true);
  createSelectControl(
    sceneSection,
    "Weather",
    WEATHER_KINDS,
    config.weather,
    (value) => (value === "hot-and-dry" ? "partly cloudy" : value),
    (value) => {
      config.weather = value;
      updateSceneState();
    },
  );
  createSelectControl(
    sceneSection,
    "Phase",
    PHASES,
    config.phase,
    (value) => value,
    (value) => {
      config.phase = value;
      updateSceneState();
    },
  );
  createRangeControl(
    sceneSection,
    "Confidence",
    config.confidence,
    0,
    5,
    1,
    (value) => value.toFixed(0),
    (value) => {
      config.confidence = clampInt(value, 0, 5);
      updateSceneState();
    },
  );
  createNumberControl(
    sceneSection,
    "Prepared",
    config.prepared,
    0,
    250,
    1,
    (value) => {
      config.prepared = clampInt(value, 0, 250);
      updateSceneState();
    },
  );
  createNumberControl(sceneSection, "Sold", config.sold, 0, 250, 1, (value) => {
    config.sold = clampInt(value, 0, 250);
    updateSceneState();
  });
  createRangeControl(
    sceneSection,
    "Signs",
    config.visibleSigns,
    0,
    40,
    1,
    (value) => value.toFixed(0),
    (value) => {
      config.visibleSigns = clampInt(value, 0, 40);
      updateSceneState();
    },
  );
  createNumberControl(
    sceneSection,
    "Day",
    config.dayNumber,
    1,
    10_000,
    1,
    (value) => {
      config.dayNumber = clampInt(value, 1, 10_000);
      updateSceneState();
    },
  );

  const populationSection = createSection(sections, "Crowd and traffic");
  createRangeControl(
    populationSection,
    "Pedestrians",
    config.population.pedestrians,
    0,
    128,
    1,
    (value) => value.toFixed(0),
    (value) => {
      config.population.pedestrians = clampInt(value, 0, 128);
      updateSceneState();
    },
  );
  createRangeControl(
    populationSection,
    "Motion speed",
    config.population.speed,
    0.1,
    4,
    0.1,
    (value) => value.toFixed(1) + "×",
    (value) => {
      config.population.speed = clamp(value, 0.1, 4);
      updateSceneState();
    },
  );
  for (const entry of [
    ["Vehicles", "vehicles", 8],
    ["Bicycles", "bicycles", 3],
    ["Pets", "pets", 3],
    ["Wildlife", "wildlife", 4],
  ] as const) {
    const [label, key, max] = entry;
    createRangeControl(
      populationSection,
      label,
      config.population[key],
      0,
      max,
      1,
      (value) => value.toFixed(0),
      (value) => {
        config.population[key] = clampInt(value, 0, max);
        updateSceneState();
      },
    );
  }

  const proceduralSection = createSection(sections, "Procedural neighborhood");
  const seedInput = createNumberControl(
    proceduralSection,
    "Seed",
    config.procedural.seed,
    0,
    0xffff_ffff,
    1,
    (value) => {
      config.procedural.seed = clampInt(value, 0, 0xffff_ffff);
      persist();
    },
  );
  createRangeControl(
    proceduralSection,
    "Buildings",
    config.procedural.buildings,
    0,
    1,
    0.05,
    (value) => Math.round(value * 100) + "%",
    (value) => {
      config.procedural.buildings = value;
      persist();
    },
  );
  createRangeControl(
    proceduralSection,
    "Vegetation",
    config.procedural.vegetation,
    0,
    1,
    0.05,
    (value) => Math.round(value * 100) + "%",
    (value) => {
      config.procedural.vegetation = value;
      persist();
    },
  );
  createRangeControl(
    proceduralSection,
    "Streets",
    config.procedural.streets,
    0,
    1,
    0.05,
    (value) => Math.round(value * 100) + "%",
    (value) => {
      config.procedural.streets = value;
      persist();
    },
  );

  const atmosphereSection = createSection(sections, "Weather, day and atmosphere");
  createCheckboxControl(
    atmosphereSection,
    "Live day cycle",
    config.atmosphere.liveTime,
    (value) => {
      config.atmosphere.liveTime = value;
      updateSceneState();
    },
  );
  createRangeControl(
    atmosphereSection,
    "Time of day",
    config.atmosphere.timeProgress,
    0,
    1,
    0.01,
    (value) => Math.round(value * 100) + "%",
    (value) => {
      config.atmosphere.timeProgress = value;
      if (!config.atmosphere.liveTime) updateSceneState();
      else persist();
    },
  );
  createRangeControl(
    atmosphereSection,
    "Sun",
    config.atmosphere.sunIntensity,
    0,
    5,
    0.1,
    (value) => value.toFixed(1),
    (value) => {
      config.atmosphere.sunIntensity = value;
      persist();
    },
  );
  createRangeControl(
    atmosphereSection,
    "Ambient",
    config.atmosphere.ambientIntensity,
    0,
    5,
    0.1,
    (value) => value.toFixed(1),
    (value) => {
      config.atmosphere.ambientIntensity = value;
      persist();
    },
  );
  createRangeControl(
    atmosphereSection,
    "Wind response",
    config.atmosphere.windScale,
    0,
    3,
    0.1,
    (value) => value.toFixed(1) + "×",
    (value) => {
      config.atmosphere.windScale = value;
      persist();
    },
  );

  const cameraSection = createSection(sections, "Camera and view");
  createCheckboxControl(
    cameraSection,
    "Lock editor camera",
    config.camera.enabled,
    (value) => {
      config.camera.enabled = value;
      persist();
    },
  );

  const cameraPositionInputs: HTMLInputElement[] = [];
  const cameraTargetInputs: HTMLInputElement[] = [];
  const cameraAxes = [
    ["X", 0],
    ["Y", 1],
    ["Z", 2],
  ] as const;
  cameraAxes.forEach(([axis, index]) => {
    cameraPositionInputs.push(
      createNumberControl(
        cameraSection,
        "Camera " + axis,
        config.camera.position[index],
        -250,
        250,
        0.1,
        (value) => {
          config.camera.position[index] = value;
          config.camera.enabled = true;
          persist();
        },
      ),
    );
  });
  cameraAxes.forEach(([axis, index]) => {
    cameraTargetInputs.push(
      createNumberControl(
        cameraSection,
        "Target " + axis,
        config.camera.target[index],
        -250,
        250,
        0.1,
        (value) => {
          config.camera.target[index] = value;
          config.camera.enabled = true;
          persist();
        },
      ),
    );
  });
  const fovInput = createNumberControl(
    cameraSection,
    "FOV",
    config.camera.fov,
    10,
    90,
    1,
    (value) => {
      config.camera.fov = value;
      config.camera.enabled = true;
      persist();
    },
  );

  const syncCameraInputs = (): void => {
    cameraAxes.forEach(([, axisIndex], controlIndex) => {
      const positionInput = cameraPositionInputs[controlIndex];
      const targetInput = cameraTargetInputs[controlIndex];
      if (positionInput !== undefined) {
        positionInput.value = config.camera.position[axisIndex].toFixed(2);
      }
      if (targetInput !== undefined) {
        targetInput.value = config.camera.target[axisIndex].toFixed(2);
      }
    });
    fovInput.value = config.camera.fov.toFixed(1);
  };

  const setCameraPreset = (position: Vec3, target: Vec3, fov: number): void => {
    config.camera.enabled = true;
    config.camera.position = [...position];
    config.camera.target = [...target];
    config.camera.fov = fov;
    syncCameraInputs();
    persist();
  };

  createButtonRow(cameraSection, [
    ["Stand", () => setCameraPreset([0, 6.8, 13.5], [0, 1.7, 0], 34)],
    ["Street", () => setCameraPreset([12, 5.2, 10], [0, 1.4, -3], 42)],
    ["Top", () => setCameraPreset([0, 38, 0.01], [0, 0, -8], 48)],
    ["Wide", () => setCameraPreset([0, 15, 28], [0, 2, -14], 46)],
  ]);
  const cameraHelp = document.createElement("small");
  cameraHelp.textContent =
    "With camera lock enabled: right/middle drag orbits; wheel dollies. Left drag remains available to the transform gizmo.";
  cameraHelp.style.cssText = "color:#8e939d;";
  cameraSection.appendChild(cameraHelp);

  const transformSection = createSection(sections, "Selection and transform");
  const objectRow = createControlRow(transformSection, "Object");
  const objectSelect = document.createElement("select");
  objectSelect.style.cssText =
    "min-width:0;width:100%;box-sizing:border-box;background:#121419;color:#f5f5f5;border:1px solid #555a62;border-radius:4px;padding:5px 6px;font:inherit;";
  objectRow.appendChild(objectSelect);

  const transformInputs: Record<
    "position" | "rotation" | "scale",
    HTMLInputElement[]
  > = {
    position: [],
    rotation: [],
    scale: [],
  };

  const syncSelectedTransformInputs = (): void => {
    const selected = gizmo?.getSelectedObject() ?? null;
    if (selected === null) return;
    selectedObjectName = selected.name;
    selected.position.toArray().forEach((value, index) => {
      const input = transformInputs.position[index];
      if (input !== undefined) input.value = value.toFixed(3);
    });
    selected.rotation.toArray().slice(0, 3).forEach((value, index) => {
      const input = transformInputs.rotation[index];
      if (input !== undefined) input.value = (Number(value) * 180 / Math.PI).toFixed(2);
    });
    selected.scale.toArray().forEach((value, index) => {
      const input = transformInputs.scale[index];
      if (input !== undefined) input.value = value.toFixed(3);
    });
  };

  const selectByUuid = (uuid: string): void => {
    if (controller === null || gizmo === null) return;
    const object = controller.scene.getObjectByProperty("uuid", uuid);
    if (object === undefined) return;
    if (object.name.length === 0) object.name = "editor-object-" + uuid.slice(0, 8);
    gizmo.selectObject(object);
    selectedObjectName = object.name;
    syncSelectedTransformInputs();
    controller.render();
  };
  objectSelect.addEventListener("change", () => selectByUuid(objectSelect.value));

  const modes: readonly TransformMode[] = ["translate", "rotate", "scale"];
  createButtonRow(
    transformSection,
    modes.map(
      (mode) =>
        [
          mode === "translate" ? "Move (G)" : mode === "rotate" ? "Rotate (R)" : "Scale (S)",
          () => gizmo?.setMode(mode),
        ] as [string, () => void],
    ),
  );

  const applySelectedTransformInput = (
    property: "position" | "rotation" | "scale",
    index: number,
    input: HTMLInputElement,
  ): void => {
    const selected = gizmo?.getSelectedObject() ?? null;
    if (selected === null) return;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    if (property === "position") selected.position.setComponent(index, value);
    else if (property === "scale") selected.scale.setComponent(index, Math.max(0.01, value));
    else {
      const radians = value * Math.PI / 180;
      if (index === 0) selected.rotation.x = radians;
      else if (index === 1) selected.rotation.y = radians;
      else selected.rotation.z = radians;
    }
    controller?.render();
  };

  for (const property of ["position", "rotation", "scale"] as const) {
    cameraAxes.forEach(([axis, index]) => {
      const row = createControlRow(
        transformSection,
        (property === "rotation" ? "Rot " : property === "scale" ? "Scale " : "Pos ") +
          axis,
      );
      const input = document.createElement("input");
      input.type = "number";
      input.step = property === "rotation" ? "1" : "0.05";
      input.style.cssText =
        "min-width:0;width:100%;box-sizing:border-box;background:#121419;color:#f5f5f5;border:1px solid #555a62;border-radius:4px;padding:5px 6px;font:inherit;";
      input.addEventListener("change", () =>
        applySelectedTransformInput(property, index, input),
      );
      transformInputs[property].push(input);
      row.appendChild(input);
    });
  }

  const saveSelectedTransform = (): void => {
    const selected = gizmo?.getSelectedObject() ?? null;
    if (selected === null) return;
    if (selected.name.length === 0) selected.name = "editor-object-" + selected.uuid.slice(0, 8);
    config.transforms[selected.name] = {
      position: [selected.position.x, selected.position.y, selected.position.z],
      rotation: [selected.rotation.x, selected.rotation.y, selected.rotation.z],
      scale: [selected.scale.x, selected.scale.y, selected.scale.z],
    };
    selectedObjectName = selected.name;
    persist();
    status.textContent = "Saved transform for " + selected.name;
  };

  createButtonRow(transformSection, [
    ["Save selected", saveSelectedTransform],
    [
      "Clear saved",
      () => {
        config.transforms = {};
        persist();
        status.textContent = "Cleared persisted object transforms";
      },
    ],
  ]);

  const persistenceSection = createSection(sections, "Presets and persistence");
  createButtonRow(persistenceSection, [
    [
      "Export JSON",
      () => downloadJson("lemonsville-scene-editor.json", config),
    ],
    [
      "Reset editor",
      () => {
        localStorage.removeItem(EDITOR_STATE_KEY);
        location.reload();
      },
    ],
  ]);
  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json,.json";
  importInput.style.cssText = "width:100%;color:#c8cad0;";
  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (file === undefined) return;
    void file.text().then((text) => {
      try {
        const imported = parseConfig(JSON.parse(text));
        localStorage.setItem(EDITOR_STATE_KEY, JSON.stringify(imported));
        location.reload();
      } catch {
        status.textContent = "Import failed: invalid editor JSON";
      }
    });
  });
  persistenceSection.appendChild(importInput);

  const refreshObjectOptions = (): void => {
    if (controller === null) return;
    const previous = gizmo?.getSelectedObject()?.uuid ?? objectSelect.value;
    const objects: Array<{ uuid: string; label: string }> = [];
    let generatedName = 0;
    controller.scene.traverse((object) => {
      if (object === controller?.scene || object.name.startsWith("Gizmo")) return;
      const role = object.userData["sceneRole"];
      if (object.name.length === 0 && object.parent === controller?.scene && typeof role === "string") {
        generatedName += 1;
        object.name = role + "-" + String(generatedName).padStart(3, "0");
      }
      if (object.name.length === 0) return;
      objects.push({
        uuid: object.uuid,
        label:
          object.name +
          (typeof role === "string" && role !== object.name ? " · " + role : ""),
      });
    });
    objects.sort((left, right) => left.label.localeCompare(right.label));
    objectSelect.replaceChildren();
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Select scene object…";
    objectSelect.appendChild(empty);
    for (const object of objects) {
      const option = document.createElement("option");
      option.value = object.uuid;
      option.textContent = object.label;
      option.selected = object.uuid === previous;
      objectSelect.appendChild(option);
    }
    if (selectedObjectName.length > 0 && gizmo?.getSelectedObject() === null) {
      const restored = objects.find((entry) => {
        const object = controller?.scene.getObjectByProperty("uuid", entry.uuid);
        return object?.name === selectedObjectName;
      });
      if (restored !== undefined) selectByUuid(restored.uuid);
    }
  };

  const rebuildScene = (): void => {
    gizmo?.dispose();
    gizmo = null;
    controller?.dispose();
    controller = createLemonsvilleScene(canvas, buildState(), {
      neighborhoodSeed: config.procedural.seed >>> 0,
    });
    if (controller === null) {
      status.textContent = "WebGL scene creation failed";
      return;
    }
    const rect = canvasHost.getBoundingClientRect();
    controller.resize(Math.max(1, rect.width), Math.max(1, rect.height));
    if (options.enableGizmo !== false) {
      gizmo = createGizmoController({
        camera: controller.camera,
        scene: controller.scene,
        container: canvas,
        onTransformChanged: () => {
          syncSelectedTransformInputs();
          controller?.render();
        },
      });
    }
    controller.update(buildState());
    applyEditorOverrides();
    controller.render();
    refreshObjectOptions();
    window.setTimeout(refreshObjectOptions, 250);
    window.setTimeout(refreshObjectOptions, 900);
    status.textContent =
      config.weather +
      " · " +
      config.phase +
      " · seed " +
      String(config.procedural.seed >>> 0);
  };

  createButtonRow(proceduralSection, [
    [
      "Regenerate",
      () => {
        config.procedural.seed = clampInt(Number(seedInput.value), 0, 0xffff_ffff);
        persist();
        rebuildScene();
      },
    ],
    [
      "Next seed",
      () => {
        config.procedural.seed = (config.procedural.seed + 1) >>> 0;
        seedInput.value = String(config.procedural.seed);
        persist();
        rebuildScene();
      },
    ],
  ]);

  let orbitPointer: number | null = null;
  let orbitX = 0;
  let orbitY = 0;

  const syncOrbitCamera = (): void => {
    syncCameraInputs();
    persist();
    applyCamera();
    controller?.render();
  };

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", (event) => {
    if (!config.camera.enabled || (event.button !== 1 && event.button !== 2)) return;
    orbitPointer = event.pointerId;
    orbitX = event.clientX;
    orbitY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (orbitPointer !== event.pointerId || !config.camera.enabled) return;
    const dx = event.clientX - orbitX;
    const dy = event.clientY - orbitY;
    orbitX = event.clientX;
    orbitY = event.clientY;

    const px = config.camera.position[0] - config.camera.target[0];
    const py = config.camera.position[1] - config.camera.target[1];
    const pz = config.camera.position[2] - config.camera.target[2];
    const radius = Math.max(0.2, Math.hypot(px, py, pz));
    let theta = Math.atan2(px, pz) - dx * 0.006;
    let phi = Math.acos(clamp(py / radius, -1, 1)) + dy * 0.006;
    phi = clamp(phi, 0.04, Math.PI - 0.04);
    theta = Number.isFinite(theta) ? theta : 0;

    config.camera.position = [
      config.camera.target[0] + radius * Math.sin(phi) * Math.sin(theta),
      config.camera.target[1] + radius * Math.cos(phi),
      config.camera.target[2] + radius * Math.sin(phi) * Math.cos(theta),
    ];
    syncOrbitCamera();
  });
  canvas.addEventListener("pointerup", (event) => {
    if (orbitPointer !== event.pointerId) return;
    orbitPointer = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!config.camera.enabled) return;
      const dx = config.camera.position[0] - config.camera.target[0];
      const dy = config.camera.position[1] - config.camera.target[1];
      const dz = config.camera.position[2] - config.camera.target[2];
      const current = Math.max(0.2, Math.hypot(dx, dy, dz));
      const next = clamp(current * Math.exp(event.deltaY * 0.001), 0.4, 200);
      const scale = next / current;
      config.camera.position = [
        config.camera.target[0] + dx * scale,
        config.camera.target[1] + dy * scale,
        config.camera.target[2] + dz * scale,
      ];
      syncOrbitCamera();
      event.preventDefault();
    },
    { passive: false },
  );

  const observer = new ResizeObserver(resize);
  observer.observe(canvasHost);

  rebuildScene();
  editorFrame = window.requestAnimationFrame(renderEditorFrame);
  refreshTimer = window.setInterval(refreshObjectOptions, 1_500);

  return Object.freeze({
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (editorFrame !== null) window.cancelAnimationFrame(editorFrame);
      if (refreshTimer !== null) window.clearInterval(refreshTimer);
      observer.disconnect();
      gizmo?.dispose();
      controller?.dispose();
      gizmo = null;
      controller = null;
    },
  });
};

if (typeof window !== "undefined") {
  Object.assign(window, {
    enableSceneViewer,
    disableSceneViewer,
  });
}
