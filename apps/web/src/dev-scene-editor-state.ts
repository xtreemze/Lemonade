import type { ScenePhase, SceneWeather } from "@lemonade/scene";
import type {
  ObjectTransform,
  SceneEditorCameraState,
} from "@lemonade/scene/gizmo-controller";

export const DEV_SCENE_EDITOR_STORAGE_KEY =
  "LEMONADE_DEV_SCENE_EDITOR_STATE_V1";

export type DevSceneDensityState = Readonly<{
  pedestrians: number;
  vehicles: number;
  bicycles: number;
  pets: number;
  residents: number;
  wildlife: number;
}>;

export type DevSceneWorldState = Readonly<{
  buildings: number;
  streets: number;
  trees: number;
  shrubs: number;
  flowers: number;
}>;

export type DevSceneAtmosphereState = Readonly<{
  timeOfDay: number;
  weatherIntensity: number;
  hemisphereIntensity: number;
  sunlightIntensity: number;
}>;

export type DevScenePlaybackState = Readonly<{
  paused: boolean;
  rate: number;
}>;

export type DevSceneEditorState = Readonly<{
  version: 1;
  weather: SceneWeather;
  phase: ScenePhase;
  seed: number;
  dayNumber: number;
  confidence: number;
  nextConfidence: number;
  prepared: number;
  sold: number;
  visibleSigns: number;
  priceCents: number;
  durationMs: number;
  density: DevSceneDensityState;
  world: DevSceneWorldState;
  atmosphere: DevSceneAtmosphereState;
  playback: DevScenePlaybackState;
  orbitEnabled: boolean;
  camera: SceneEditorCameraState;
  transforms: readonly ObjectTransform[];
}>;

const DEFAULT_CAMERA: SceneEditorCameraState = Object.freeze({
  position: Object.freeze([0, 6.8, 13.5] as const),
  target: Object.freeze([0, 1.7, 0] as const),
  fov: 34,
});

export const DEFAULT_DEV_SCENE_EDITOR_STATE: DevSceneEditorState =
  Object.freeze({
    version: 1,
    weather: "sunny",
    phase: "simulation",
    seed: 12_345,
    dayNumber: 1,
    confidence: 3,
    nextConfidence: 3,
    prepared: 20,
    sold: 10,
    visibleSigns: 5,
    priceCents: 150,
    durationMs: 10_000,
    density: Object.freeze({
      pedestrians: 1,
      vehicles: 1,
      bicycles: 1,
      pets: 1,
      residents: 1,
      wildlife: 1,
    }),
    world: Object.freeze({
      buildings: 1,
      streets: 1,
      trees: 1,
      shrubs: 1,
      flowers: 1,
    }),
    atmosphere: Object.freeze({
      timeOfDay: 0.52,
      weatherIntensity: 1,
      hemisphereIntensity: 1,
      sunlightIntensity: 1,
    }),
    playback: Object.freeze({
      paused: false,
      rate: 1,
    }),
    orbitEnabled: true,
    camera: DEFAULT_CAMERA,
    transforms: Object.freeze([]),
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finiteNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

const finiteInteger = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => Math.trunc(finiteNumber(value, fallback, min, max));

const booleanValue = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const weatherValue = (
  value: unknown,
  fallback: SceneWeather,
): SceneWeather =>
  value === "sunny" ||
  value === "cloudy" ||
  value === "hot-and-dry" ||
  value === "thunderstorm"
    ? value
    : fallback;

const phaseValue = (value: unknown, fallback: ScenePhase): ScenePhase =>
  value === "idle" || value === "forecast" || value === "simulation"
    ? value
    : fallback;

const tuple3 = (
  value: unknown,
  fallback: readonly [number, number, number],
): readonly [number, number, number] => {
  if (!Array.isArray(value) || value.length !== 3) return fallback;
  const parsed = value.map((item, index) =>
    finiteNumber(item, fallback[index] ?? 0, -10_000, 10_000),
  );
  return Object.freeze([
    parsed[0] ?? fallback[0],
    parsed[1] ?? fallback[1],
    parsed[2] ?? fallback[2],
  ]);
};

const densityState = (
  value: unknown,
  fallback: DevSceneDensityState,
): DevSceneDensityState => {
  const record = isRecord(value) ? value : {};
  return Object.freeze({
    pedestrians: finiteNumber(record["pedestrians"], fallback.pedestrians, 0, 1),
    vehicles: finiteNumber(record["vehicles"], fallback.vehicles, 0, 1),
    bicycles: finiteNumber(record["bicycles"], fallback.bicycles, 0, 1),
    pets: finiteNumber(record["pets"], fallback.pets, 0, 1),
    residents: finiteNumber(record["residents"], fallback.residents, 0, 1),
    wildlife: finiteNumber(record["wildlife"], fallback.wildlife, 0, 1),
  });
};

const worldState = (
  value: unknown,
  fallback: DevSceneWorldState,
): DevSceneWorldState => {
  const record = isRecord(value) ? value : {};
  return Object.freeze({
    buildings: finiteNumber(record["buildings"], fallback.buildings, 0, 1),
    streets: finiteNumber(record["streets"], fallback.streets, 0, 1),
    trees: finiteNumber(record["trees"], fallback.trees, 0, 1),
    shrubs: finiteNumber(record["shrubs"], fallback.shrubs, 0, 1),
    flowers: finiteNumber(record["flowers"], fallback.flowers, 0, 1),
  });
};

const atmosphereState = (
  value: unknown,
  fallback: DevSceneAtmosphereState,
): DevSceneAtmosphereState => {
  const record = isRecord(value) ? value : {};
  return Object.freeze({
    timeOfDay: finiteNumber(record["timeOfDay"], fallback.timeOfDay, 0, 1),
    weatherIntensity: finiteNumber(
      record["weatherIntensity"],
      fallback.weatherIntensity,
      0,
      2,
    ),
    hemisphereIntensity: finiteNumber(
      record["hemisphereIntensity"],
      fallback.hemisphereIntensity,
      0,
      3,
    ),
    sunlightIntensity: finiteNumber(
      record["sunlightIntensity"],
      fallback.sunlightIntensity,
      0,
      3,
    ),
  });
};

const playbackState = (
  value: unknown,
  fallback: DevScenePlaybackState,
): DevScenePlaybackState => {
  const record = isRecord(value) ? value : {};
  return Object.freeze({
    paused: booleanValue(record["paused"], fallback.paused),
    rate: finiteNumber(record["rate"], fallback.rate, 0.1, 4),
  });
};

const cameraState = (
  value: unknown,
  fallback: SceneEditorCameraState,
): SceneEditorCameraState => {
  const record = isRecord(value) ? value : {};
  const fovValue = record["fov"];
  return Object.freeze({
    position: tuple3(record["position"], fallback.position),
    target: tuple3(record["target"], fallback.target),
    fov:
      fovValue === null
        ? null
        : finiteNumber(fovValue, fallback.fov ?? 34, 10, 100),
  });
};

const transformValue = (value: unknown): ObjectTransform | null => {
  if (!isRecord(value)) return null;
  const key = value["key"];
  const name = value["name"];
  if (typeof key !== "string" || key.length === 0) return null;
  if (typeof name !== "string") return null;

  const identity = Object.freeze([0, 0, 0] as const);
  const unit = Object.freeze([1, 1, 1] as const);
  const scale = tuple3(value["scale"], unit);
  return Object.freeze({
    key,
    name,
    position: tuple3(value["position"], identity),
    rotation: tuple3(value["rotation"], identity),
    scale: Object.freeze([
      Math.max(0.001, scale[0]),
      Math.max(0.001, scale[1]),
      Math.max(0.001, scale[2]),
    ] as const),
  });
};

const transformList = (value: unknown): readonly ObjectTransform[] => {
  if (!Array.isArray(value)) return Object.freeze([]);
  const byKey = new Map<string, ObjectTransform>();
  for (const candidate of value.slice(0, 2_000)) {
    const transform = transformValue(candidate);
    if (transform !== null) byKey.set(transform.key, transform);
  }
  return Object.freeze([...byKey.values()]);
};

export const parseDevSceneEditorState = (
  value: unknown,
  fallback: DevSceneEditorState = DEFAULT_DEV_SCENE_EDITOR_STATE,
): DevSceneEditorState => {
  const record = isRecord(value) ? value : {};
  const density = densityState(record["density"], fallback.density);
  const world = worldState(record["world"], fallback.world);
  const atmosphere = atmosphereState(record["atmosphere"], fallback.atmosphere);
  const playback = playbackState(record["playback"], fallback.playback);

  return Object.freeze({
    version: 1,
    weather: weatherValue(record["weather"], fallback.weather),
    phase: phaseValue(record["phase"], fallback.phase),
    seed: finiteInteger(record["seed"], fallback.seed, 0, 0xffff_ffff) >>> 0,
    dayNumber: finiteInteger(record["dayNumber"], fallback.dayNumber, 1, 100_000),
    confidence: finiteNumber(record["confidence"], fallback.confidence, 0, 5),
    nextConfidence: finiteNumber(
      record["nextConfidence"],
      fallback.nextConfidence,
      0,
      5,
    ),
    prepared: finiteInteger(record["prepared"], fallback.prepared, 0, 1_000),
    sold: finiteInteger(record["sold"], fallback.sold, 0, 1_000),
    visibleSigns: finiteInteger(
      record["visibleSigns"],
      fallback.visibleSigns,
      0,
      40,
    ),
    priceCents: finiteInteger(record["priceCents"], fallback.priceCents, 0, 100_000),
    durationMs: finiteInteger(record["durationMs"], fallback.durationMs, 500, 120_000),
    density,
    world,
    atmosphere,
    playback,
    orbitEnabled: booleanValue(record["orbitEnabled"], fallback.orbitEnabled),
    camera: cameraState(record["camera"], fallback.camera),
    transforms: transformList(record["transforms"]),
  });
};

export const deserializeDevSceneEditorState = (
  text: string,
  fallback: DevSceneEditorState = DEFAULT_DEV_SCENE_EDITOR_STATE,
): DevSceneEditorState => {
  try {
    return parseDevSceneEditorState(JSON.parse(text) as unknown, fallback);
  } catch {
    return fallback;
  }
};

export const serializeDevSceneEditorState = (
  state: DevSceneEditorState,
): string => JSON.stringify(state, null, 2);

export const withTransform = (
  state: DevSceneEditorState,
  transform: ObjectTransform,
): DevSceneEditorState => {
  const transforms = new Map(
    state.transforms.map((candidate) => [candidate.key, candidate] as const),
  );
  transforms.set(transform.key, transform);
  return Object.freeze({
    ...state,
    transforms: Object.freeze([...transforms.values()]),
  });
};

export const withoutTransform = (
  state: DevSceneEditorState,
  key: string,
): DevSceneEditorState =>
  Object.freeze({
    ...state,
    transforms: Object.freeze(
      state.transforms.filter((transform) => transform.key !== key),
    ),
  });
