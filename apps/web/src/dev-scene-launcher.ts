/**
 * Dev Tool: Interactive 3D Scene Launcher
 *
 * Launch 3D scenes with different weather and phase combinations
 * for interactive testing and preview.
 *
 * Enable with: `localStorage.setItem('LEMONADE_DEV_SCENE_LAUNCHER', '1')`
 */

import type { SceneWeather, ScenePhase } from "@lemonade/scene";

export type ScenePreset = {
  name: string;
  weather: SceneWeather;
  phase: ScenePhase;
  confidence?: number;
  prepared?: number;
  sold?: number;
  visibleSigns?: number;
};

export const SCENE_PRESETS: ScenePreset[] = [
  // Forecast Presets
  {
    name: "☀️ Sunny Forecast",
    weather: "sunny",
    phase: "forecast",
  },
  {
    name: "☁️ Cloudy Forecast",
    weather: "cloudy",
    phase: "forecast",
  },
  {
    name: "🌤️ Partly Cloudy Forecast",
    weather: "hot-and-dry",
    phase: "forecast",
  },
  {
    name: "⛈️ Thunderstorm Forecast",
    weather: "thunderstorm",
    phase: "forecast",
  },

  // Idle Presets
  {
    name: "🌅 Sunny - Idle",
    weather: "sunny",
    phase: "idle",
  },
  {
    name: "🌄 Cloudy - Idle",
    weather: "cloudy",
    phase: "idle",
  },

  // Simulation Presets - Quiet
  {
    name: "☀️ Sunny - Quiet (0 confidence)",
    weather: "sunny",
    phase: "simulation",
    confidence: 0,
    prepared: 5,
    sold: 0,
    visibleSigns: 1,
  },
  {
    name: "☁️ Cloudy - Quiet",
    weather: "cloudy",
    phase: "simulation",
    confidence: 0,
    prepared: 5,
    sold: 0,
    visibleSigns: 1,
  },

  // Simulation Presets - Light
  {
    name: "☀️ Sunny - Light (1 confidence)",
    weather: "sunny",
    phase: "simulation",
    confidence: 1,
    prepared: 5,
    sold: 0,
    visibleSigns: 1,
  },
  {
    name: "☁️ Cloudy - Light",
    weather: "cloudy",
    phase: "simulation",
    confidence: 1,
    prepared: 5,
    sold: 1,
    visibleSigns: 2,
  },

  // Simulation Presets - Steady
  {
    name: "☀️ Sunny - Steady (2 confidence)",
    weather: "sunny",
    phase: "simulation",
    confidence: 2,
    prepared: 10,
    sold: 3,
    visibleSigns: 2,
  },
  {
    name: "☁️ Cloudy - Steady",
    weather: "cloudy",
    phase: "simulation",
    confidence: 2,
    prepared: 10,
    sold: 3,
    visibleSigns: 2,
  },
  {
    name: "⛈️ Thunderstorm - Steady",
    weather: "thunderstorm",
    phase: "simulation",
    confidence: 2,
    prepared: 8,
    sold: 2,
    visibleSigns: 1,
  },

  // Simulation Presets - Lively
  {
    name: "☀️ Sunny - Lively (3 confidence)",
    weather: "sunny",
    phase: "simulation",
    confidence: 3,
    prepared: 15,
    sold: 8,
    visibleSigns: 3,
  },
  {
    name: "🌤️ Partly Cloudy - Lively",
    weather: "hot-and-dry",
    phase: "simulation",
    confidence: 3,
    prepared: 15,
    sold: 7,
    visibleSigns: 3,
  },

  // Simulation Presets - Busy
  {
    name: "☀️ Sunny - Busy (4 confidence)",
    weather: "sunny",
    phase: "simulation",
    confidence: 4,
    prepared: 20,
    sold: 15,
    visibleSigns: 4,
  },
  {
    name: "☀️ Sunny - Very Busy (5 confidence)",
    weather: "sunny",
    phase: "simulation",
    confidence: 5,
    prepared: 25,
    sold: 22,
    visibleSigns: 5,
  },
];

export const isSceneLauncherEnabled = (): boolean => {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem("LEMONADE_DEV_SCENE_LAUNCHER") === "1";
};

export const enableSceneLauncher = (): void => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("LEMONADE_DEV_SCENE_LAUNCHER", "1");
    console.log("🎬 Scene launcher enabled! Refresh the page to activate.");
  }
};

export const disableSceneLauncher = (): void => {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("LEMONADE_DEV_SCENE_LAUNCHER");
    console.log("🎬 Scene launcher disabled. Refresh the page.");
  }
};

export const printSceneLauncherHelp = (): void => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║        Scene Launcher Dev Tool - Quick Start                   ║
╚════════════════════════════════════════════════════════════════╝

ENABLE:
  enableSceneLauncher()       # Enable launcher panel
  disableSceneLauncher()      # Disable launcher

Or use localStorage directly:
  localStorage.setItem('LEMONADE_DEV_SCENE_LAUNCHER', '1')
  localStorage.removeItem('LEMONADE_DEV_SCENE_LAUNCHER')

FEATURES:
  - Preset scene configurations for different weather
  - Multiple confidence levels (customer activity)
  - Forecast, Idle, and Simulation phases
  - One-click scene launch
  - Custom weather/phase/confidence selectors

PRESETS:
  The launcher includes pre-configured scenes for:
  ☀️  Sunny conditions (all confidence levels)
  ☁️  Cloudy conditions
  🌤️  Partly cloudy (hot-and-dry)
  ⛈️  Thunderstorm

  Each at different customer activity levels:
  0 = Quiet (no customers)
  1 = Light traffic
  2 = Steady flow
  3 = Lively activity
  4 = Busy (peak hours)
  5 = Very busy

USAGE:
  1. Enable: enableSceneLauncher() → Refresh
  2. Click a preset button to launch that scene
  3. Or use custom selectors (Weather, Phase, Confidence)
  4. Scene updates automatically

CUSTOM CONTROLS:
  Weather:     Select sunny, cloudy, hot-and-dry, thunderstorm
  Phase:       Choose forecast, idle, or simulation
  Confidence:  Set customer activity level (0-5)

CONSOLE COMMANDS:
  SCENE_PRESETS    # View all available presets

═══════════════════════════════════════════════════════════════════
  `);
};

export const createSceneLauncherUI = (
  onPresetSelect: (preset: ScenePreset) => void,
): HTMLElement => {
  const panel = document.createElement("div");
  panel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.95);
    border: 2px solid #00ffff;
    border-radius: 8px;
    padding: 16px;
    font-family: monospace;
    font-size: 11px;
    color: #fff;
    z-index: 999;
    max-width: 320px;
    max-height: 80vh;
    overflow-y: auto;
  `;

  const title = document.createElement("div");
  title.textContent = "🎬 Scene Launcher";
  title.style.cssText = `
    font-weight: bold;
    margin-bottom: 12px;
    color: #00ffff;
    font-size: 13px;
  `;
  panel.appendChild(title);

  const presetsContainer = document.createElement("div");
  presetsContainer.style.cssText = `
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
    margin-bottom: 16px;
  `;

  SCENE_PRESETS.forEach((preset) => {
    const btn = document.createElement("button");
    btn.textContent = preset.name;
    btn.onclick = () => onPresetSelect(preset);
    btn.style.cssText = `
      padding: 8px 12px;
      background: #1a1a2e;
      color: #00ffff;
      border: 1px solid #00ffff;
      border-radius: 4px;
      cursor: pointer;
      font-family: monospace;
      font-size: 11px;
      text-align: left;
      transition: all 0.2s;
    `;

    btn.onmouseover = () => {
      btn.style.background = "#00ffff";
      btn.style.color = "#000";
    };
    btn.onmouseout = () => {
      btn.style.background = "#1a1a2e";
      btn.style.color = "#00ffff";
    };

    presetsContainer.appendChild(btn);
  });

  panel.appendChild(presetsContainer);

  // Custom controls
  const customSection = document.createElement("div");
  customSection.style.cssText = `
    border-top: 1px solid #00ffff;
    padding-top: 12px;
    margin-top: 12px;
  `;

  const customTitle = document.createElement("div");
  customTitle.textContent = "Custom Scene:";
  customTitle.style.cssText = `
    font-weight: bold;
    color: #00ff00;
    margin-bottom: 8px;
  `;
  customSection.appendChild(customTitle);

  // Weather selector
  const weatherLabel = document.createElement("label");
  weatherLabel.textContent = "Weather: ";
  weatherLabel.style.cssText = "display: block; margin-bottom: 4px; color: #aaa;";

  const weatherSelect = document.createElement("select");
  weatherSelect.style.cssText = `
    width: 100%;
    padding: 4px;
    background: #1a1a2e;
    color: #00ffff;
    border: 1px solid #00ffff;
    border-radius: 2px;
    margin-bottom: 8px;
    font-family: monospace;
  `;
  const weatherOptions = ["sunny", "cloudy", "hot-and-dry", "thunderstorm"];
  weatherOptions.forEach((w) => {
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = w;
    weatherSelect.appendChild(opt);
  });
  weatherLabel.appendChild(weatherSelect);
  customSection.appendChild(weatherLabel);

  // Phase selector
  const phaseLabel = document.createElement("label");
  phaseLabel.textContent = "Phase: ";
  phaseLabel.style.cssText = "display: block; margin-bottom: 4px; color: #aaa;";

  const phaseSelect = document.createElement("select");
  phaseSelect.style.cssText = `
    width: 100%;
    padding: 4px;
    background: #1a1a2e;
    color: #00ffff;
    border: 1px solid #00ffff;
    border-radius: 2px;
    margin-bottom: 8px;
    font-family: monospace;
  `;
  const phaseOptions = ["forecast", "idle", "simulation"];
  phaseOptions.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    phaseSelect.appendChild(opt);
  });
  phaseLabel.appendChild(phaseSelect);
  customSection.appendChild(phaseLabel);

  // Confidence slider
  const confidenceLabel = document.createElement("label");
  confidenceLabel.textContent = "Confidence (Activity): ";
  confidenceLabel.style.cssText = "display: block; margin-bottom: 4px; color: #aaa;";

  const confidenceSlider = document.createElement("input");
  confidenceSlider.type = "range";
  confidenceSlider.min = "0";
  confidenceSlider.max = "5";
  confidenceSlider.value = "2";
  confidenceSlider.style.cssText = `
    width: 100%;
    margin-bottom: 4px;
  `;

  const confidenceValue = document.createElement("div");
  confidenceValue.textContent = "2";
  confidenceValue.style.cssText = `
    text-align: center;
    color: #00ff00;
    margin-bottom: 8px;
  `;

  confidenceSlider.oninput = () => {
    confidenceValue.textContent = confidenceSlider.value;
  };

  confidenceLabel.appendChild(confidenceSlider);
  confidenceLabel.appendChild(confidenceValue);
  customSection.appendChild(confidenceLabel);

  // Launch button
  const launchBtn = document.createElement("button");
  launchBtn.textContent = "🎬 Launch Custom Scene";
  launchBtn.style.cssText = `
    width: 100%;
    padding: 8px;
    background: #00ff00;
    color: #000;
    border: 1px solid #00ff00;
    border-radius: 4px;
    cursor: pointer;
    font-family: monospace;
    font-weight: bold;
    margin-top: 8px;
  `;

  launchBtn.onclick = () => {
    const customPreset: ScenePreset = {
      name: "Custom",
      weather: weatherSelect.value as SceneWeather,
      phase: phaseSelect.value as ScenePhase,
      confidence: parseInt(confidenceSlider.value),
      prepared: 10,
      sold: 0,
      visibleSigns: 2,
    };
    onPresetSelect(customPreset);
  };

  customSection.appendChild(launchBtn);
  panel.appendChild(customSection);

  return panel;
};

// Make dev tools globally available
if (typeof window !== "undefined") {
  (window as any).enableSceneLauncher = enableSceneLauncher;
  (window as any).disableSceneLauncher = disableSceneLauncher;
  (window as any).sceneLauncherHelp = printSceneLauncherHelp;
  (window as any).SCENE_PRESETS = SCENE_PRESETS;
}
