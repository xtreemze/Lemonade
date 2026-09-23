/**
 * Persistent scene viewer loaded only when explicitly enabled.
 *
 * Enable with: localStorage.setItem("LEMONADE_DEV_SCENE_VIEWER", "1")
 */

import {
  createLemonsvilleScene,
  type LemonsvilleSceneState,
  type ScenePhase,
  type SceneWeather,
} from "@lemonade/scene";
import { createStreetStoryboard } from "@lemonade/scene/storyboard-create";

export interface PersistentSceneViewerOptions {
  enableGizmo?: boolean;
  weather?: SceneWeather;
  phase?: ScenePhase;
}

export interface PersistentSceneViewer {
  dispose(): void;
}

export const isSceneViewerEnabled = (): boolean =>
  localStorage.getItem("LEMONADE_DEV_SCENE_VIEWER") === "1";

export const enableSceneViewer = (): void => {
  localStorage.setItem("LEMONADE_DEV_SCENE_VIEWER", "1");
};

export const disableSceneViewer = (): void => {
  localStorage.removeItem("LEMONADE_DEV_SCENE_VIEWER");
};

const makeState = (
  weather: SceneWeather,
  phase: ScenePhase,
): LemonsvilleSceneState => {
  const durationMs = phase === "forecast" ? 6_000 : phase === "simulation" ? 14_000 : 0;
  return Object.freeze({
    weather,
    visibleSigns: phase === "forecast" ? 0 : 5,
    prepared: phase === "forecast" ? 0 : 20,
    durationMs,
    confidence: 3,
    nextConfidence: 3,
    characterSeed: 12_345,
    dayNumber: 1,
    neighborhoodOccurrences: Object.freeze([]),
    storyboard: createStreetStoryboard({
      durationMs: Math.max(1, durationMs),
      prepared: phase === "forecast" ? 0 : 20,
      sold: phase === "simulation" ? 10 : 0,
      visibleSigns: phase === "forecast" ? 0 : 5,
      priceCents: 150,
      ambientPedestrianCount: 12,
    }),
    phase,
    reducedMotion: false,
  });
};

const createSelect = <T extends string>(
  labelText: string,
  values: readonly T[],
  selected: T,
): Readonly<{ label: HTMLLabelElement; select: HTMLSelectElement }> => {
  const label = document.createElement("label");
  label.style.cssText = "display:grid;gap:4px;";
  label.append(labelText);

  const select = document.createElement("select");
  for (const value of values) {
    select.add(new Option(value, value, false, value === selected));
  }
  label.appendChild(select);
  return Object.freeze({ label, select });
};

export const createPersistentSceneViewer = (
  appRoot: HTMLElement,
  options: PersistentSceneViewerOptions = {},
): PersistentSceneViewer | null => {
  const initialWeather = options.weather ?? "sunny";
  const initialPhase = options.phase ?? "simulation";

  appRoot.replaceChildren();

  const shell = document.createElement("main");
  shell.style.cssText =
    "width:100dvw;height:100dvh;display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,320px);background:#000;";

  const sceneHost = document.createElement("div");
  sceneHost.style.cssText = "min-width:0;min-height:0;position:relative;";

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:100%;height:100%;display:block;";
  sceneHost.appendChild(canvas);

  const sidebar = document.createElement("aside");
  sidebar.setAttribute("aria-label", "Scene viewer controls");
  sidebar.style.cssText =
    "min-height:0;overflow:auto;padding:16px;background:rgb(0 0 0 / 94%);border-left:2px solid #ffff00;color:#fff;font:12px monospace;";

  const heading = document.createElement("h1");
  heading.textContent = "Scene Viewer";
  heading.style.cssText = "font-size:14px;margin:0 0 12px;color:#ffff00;";
  sidebar.appendChild(heading);

  const weatherControl = createSelect(
    "Weather",
    ["sunny", "cloudy", "hot-and-dry", "thunderstorm"] as const,
    initialWeather,
  );
  const phaseControl = createSelect(
    "Phase",
    ["forecast", "idle", "simulation"] as const,
    initialPhase,
  );
  sidebar.append(weatherControl.label, phaseControl.label);

  const exit = document.createElement("button");
  exit.type = "button";
  exit.textContent = "Exit viewer";
  exit.style.cssText =
    "min-height:44px;width:100%;margin-top:16px;border:1px solid #ffff00;background:#111;color:#ffff00;";
  exit.addEventListener("click", () => {
    disableSceneViewer();
    window.location.reload();
  });
  sidebar.appendChild(exit);

  shell.append(sceneHost, sidebar);
  appRoot.appendChild(shell);

  let weather: SceneWeather = initialWeather;
  let phase: ScenePhase = initialPhase;
  const scene = createLemonsvilleScene(canvas, makeState(weather, phase), {
    enableGizmo: options.enableGizmo === true,
  });
  if (scene === null) {
    sceneHost.textContent = "Unable to initialize the 3D scene.";
    return null;
  }

  const update = (): void => {
    scene.update(makeState(weather, phase));
  };

  weatherControl.select.addEventListener("change", () => {
    const value = weatherControl.select.value;
    if (
      value === "sunny" ||
      value === "cloudy" ||
      value === "hot-and-dry" ||
      value === "thunderstorm"
    ) {
      weather = value;
      update();
    }
  });

  phaseControl.select.addEventListener("change", () => {
    const value = phaseControl.select.value;
    if (value === "forecast" || value === "idle" || value === "simulation") {
      phase = value;
      update();
    }
  });

  const observer = new ResizeObserver(() => {
    scene.resize(sceneHost.clientWidth, sceneHost.clientHeight);
  });
  observer.observe(sceneHost);
  scene.resize(sceneHost.clientWidth, sceneHost.clientHeight);

  return Object.freeze({
    dispose(): void {
      observer.disconnect();
      scene.dispose();
    },
  });
};

declare global {
  interface Window {
    enableSceneViewer?: typeof enableSceneViewer;
    disableSceneViewer?: typeof disableSceneViewer;
  }
}

if (typeof window !== "undefined") {
  window.enableSceneViewer = enableSceneViewer;
  window.disableSceneViewer = disableSceneViewer;
}
