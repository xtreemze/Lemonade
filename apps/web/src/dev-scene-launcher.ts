/**
 * Dev Tool: Interactive 3D Scene Launcher
 *
 * Enable with: localStorage.setItem("LEMONADE_DEV_SCENE_LAUNCHER", "1")
 */

import type { ScenePhase, SceneWeather } from "@lemonade/scene";

export interface ScenePreset {
  name: string;
  weather: SceneWeather;
  phase: ScenePhase;
  confidence?: number;
  prepared?: number;
  sold?: number;
  visibleSigns?: number;
}

export const SCENE_PRESETS: readonly ScenePreset[] = Object.freeze([
  { name: "Sunny Forecast", weather: "sunny", phase: "forecast" },
  { name: "Cloudy Forecast", weather: "cloudy", phase: "forecast" },
  { name: "Partly Cloudy Forecast", weather: "hot-and-dry", phase: "forecast" },
  { name: "Thunderstorm Forecast", weather: "thunderstorm", phase: "forecast" },
  { name: "Sunny - Idle", weather: "sunny", phase: "idle" },
  { name: "Cloudy - Idle", weather: "cloudy", phase: "idle" },
  { name: "Sunny - Quiet", weather: "sunny", phase: "simulation", confidence: 0, prepared: 5, sold: 0, visibleSigns: 1 },
  { name: "Cloudy - Light", weather: "cloudy", phase: "simulation", confidence: 1, prepared: 5, sold: 1, visibleSigns: 2 },
  { name: "Sunny - Steady", weather: "sunny", phase: "simulation", confidence: 2, prepared: 10, sold: 3, visibleSigns: 2 },
  { name: "Thunderstorm - Steady", weather: "thunderstorm", phase: "simulation", confidence: 2, prepared: 8, sold: 2, visibleSigns: 1 },
  { name: "Sunny - Lively", weather: "sunny", phase: "simulation", confidence: 3, prepared: 15, sold: 8, visibleSigns: 3 },
  { name: "Partly Cloudy - Lively", weather: "hot-and-dry", phase: "simulation", confidence: 3, prepared: 15, sold: 7, visibleSigns: 3 },
  { name: "Sunny - Busy", weather: "sunny", phase: "simulation", confidence: 4, prepared: 20, sold: 15, visibleSigns: 4 },
  { name: "Sunny - Very Busy", weather: "sunny", phase: "simulation", confidence: 5, prepared: 25, sold: 22, visibleSigns: 5 },
]);

const parseWeather = (value: string): SceneWeather => {
  switch (value) {
    case "sunny":
    case "cloudy":
    case "hot-and-dry":
    case "thunderstorm":
      return value;
    default:
      return "sunny";
  }
};

const parsePhase = (value: string): ScenePhase => {
  switch (value) {
    case "forecast":
    case "idle":
    case "simulation":
      return value;
    default:
      return "simulation";
  }
};

export const isSceneLauncherEnabled = (): boolean =>
  localStorage.getItem("LEMONADE_DEV_SCENE_LAUNCHER") === "1";

export const enableSceneLauncher = (): void => {
  localStorage.setItem("LEMONADE_DEV_SCENE_LAUNCHER", "1");
};

export const disableSceneLauncher = (): void => {
  localStorage.removeItem("LEMONADE_DEV_SCENE_LAUNCHER");
};

export const printSceneLauncherHelp = (): void => {
  console.log(
    'Scene launcher: enableSceneLauncher(), disableSceneLauncher(), SCENE_PRESETS',
  );
};

const applyButtonBaseStyle = (button: HTMLButtonElement): void => {
  button.style.cssText = `
    min-height: 44px;
    padding: 8px 12px;
    background: #1a1a2e;
    color: #00ffff;
    border: 1px solid #00ffff;
    border-radius: 4px;
    cursor: pointer;
    font-family: monospace;
    font-size: 11px;
    text-align: left;
    transition: background-color 0.2s, color 0.2s;
  `;
};

export const createSceneLauncherUI = (
  onPresetSelect: (preset: ScenePreset) => void,
): HTMLElement => {
  const panel = document.createElement("aside");
  panel.setAttribute("aria-label", "Scene launcher");
  panel.style.cssText = `
    position: fixed;
    right: 12px;
    bottom: 12px;
    width: min(320px, calc(100dvw - 24px));
    max-height: min(80dvh, 680px);
    overflow-y: auto;
    padding: 16px;
    background: rgb(0 0 0 / 94%);
    border: 2px solid #00ffff;
    border-radius: 8px;
    color: #fff;
    font: 11px monospace;
    z-index: 999;
  `;

  const title = document.createElement("strong");
  title.textContent = "Scene Launcher";
  panel.appendChild(title);

  const presets = document.createElement("div");
  presets.style.cssText = "display:grid;gap:6px;margin:12px 0;";
  for (const preset of SCENE_PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = preset.name;
    applyButtonBaseStyle(button);
    button.addEventListener("click", () => {
      onPresetSelect(preset);
    });
    presets.appendChild(button);
  }
  panel.appendChild(presets);

  const weather = document.createElement("select");
  for (const value of ["sunny", "cloudy", "hot-and-dry", "thunderstorm"] as const) {
    weather.add(new Option(value, value));
  }

  const phase = document.createElement("select");
  for (const value of ["forecast", "idle", "simulation"] as const) {
    phase.add(new Option(value, value));
  }

  const confidence = document.createElement("input");
  confidence.type = "range";
  confidence.min = "0";
  confidence.max = "5";
  confidence.value = "2";

  const custom = document.createElement("button");
  custom.type = "button";
  custom.textContent = "Launch custom scene";
  applyButtonBaseStyle(custom);
  custom.addEventListener("click", () => {
    onPresetSelect({
      name: "Custom",
      weather: parseWeather(weather.value),
      phase: parsePhase(phase.value),
      confidence: Number.parseInt(confidence.value, 10),
      prepared: 10,
      sold: 0,
      visibleSigns: 2,
    });
  });

  for (const [labelText, control] of [
    ["Weather", weather],
    ["Phase", phase],
    ["Confidence", confidence],
  ] as const) {
    const label = document.createElement("label");
    label.style.cssText = "display:grid;gap:4px;margin-block:8px;";
    label.append(labelText, control);
    panel.appendChild(label);
  }
  panel.appendChild(custom);
  return panel;
};

declare global {
  interface Window {
    enableSceneLauncher?: typeof enableSceneLauncher;
    disableSceneLauncher?: typeof disableSceneLauncher;
    sceneLauncherHelp?: typeof printSceneLauncherHelp;
    SCENE_PRESETS?: readonly ScenePreset[];
  }
}

if (typeof window !== "undefined") {
  window.enableSceneLauncher = enableSceneLauncher;
  window.disableSceneLauncher = disableSceneLauncher;
  window.sceneLauncherHelp = printSceneLauncherHelp;
  window.SCENE_PRESETS = SCENE_PRESETS;
}
