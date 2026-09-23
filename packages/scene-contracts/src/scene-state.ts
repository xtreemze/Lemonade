import type { StreetStoryboard } from "./storyboard.js";

export type SceneWeather =
  | "sunny"
  | "cloudy"
  | "hot-and-dry"
  | "thunderstorm";
export type CustomerActivity =
  | "quiet"
  | "light"
  | "steady"
  | "lively"
  | "busy";
export type ScenePhase = "idle" | "simulation" | "forecast";

export type LemonsvilleSceneState = Readonly<{
  weather: SceneWeather;
  visibleSigns: number;
  prepared: number;
  durationMs: number;
  confidence: number;
  nextConfidence: number;
  characterSeed: number;
  dayNumber?: number;
  storyboard: StreetStoryboard;
  phase: ScenePhase;
  reducedMotion: boolean;
}>;

export type LemonsvilleSceneOptions = Readonly<{
  enableGizmo?: boolean;
}>;

export type RendererDiagnostics = Readonly<{
  frame: number;
  drawCalls: number;
  triangles: number;
  lines: number;
  points: number;
  geometries: number;
  textures: number;
}>;

export interface LemonsvilleSceneController {
  update(state: LemonsvilleSceneState): void;
  resize(width: number, height: number): void;
  diagnostics(): RendererDiagnostics;
  dispose(): void;
}
