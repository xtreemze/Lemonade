import type { RendererDiagnostics } from "./renderer-diagnostics.js";
import type { StreetStoryboard } from "./storyboard.js";

export type SceneWeather = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";
export type ScenePhase = "idle" | "simulation" | "forecast";

export type LemonsvilleSceneState = Readonly<{
  weather: SceneWeather;
  visibleSigns: number;
  prepared: number;
  durationMs: number;
  confidence: number;
  nextConfidence: number;
  characterSeed: number;
  storyboard: StreetStoryboard;
  phase: ScenePhase;
  reducedMotion: boolean;
}>;

export type LemonsvilleSceneOptions = Readonly<{
  enableGizmo?: boolean;
}>;

export interface LemonsvilleSceneControllerContract {
  update: (state: LemonsvilleSceneState) => void;
  resize: (width: number, height: number) => void;
  diagnostics: () => RendererDiagnostics;
  dispose: () => void;
}

export type { RendererDiagnostics };
