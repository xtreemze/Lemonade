import { describe, expect, it } from "vitest";

import {
  type AudioCue,
  availableSounds,
  compileCue,
  missingSounds,
  soundLibrary,
  soundLibraryEntry,
} from "../src/index.js";

const AVAILABLE_IDS: readonly AudioCue[] = [
  "forecast:sunny",
  "forecast:cloudy",
  "forecast:hot-and-dry",
  "forecast:thunderstorm",
  "day:submit",
  "day:profit",
  "day:loss",
  "progression:unlock",
  "purchase:serve",
  "purchase:payment",
  "purchase:drink",
  "storm:thunder",
  "storm:gust",
  "ambient:birdsong",
];

describe("sound library", () => {
  it("catalogs every playable AudioCue as available", () => {
    expect(availableSounds.map((entry) => entry.id)).toEqual(AVAILABLE_IDS);
    for (const cue of AVAILABLE_IDS) {
      expect(soundLibraryEntry(cue)?.status).toBe("available");
      expect(compileCue(cue).length).toBeGreaterThan(0);
    }
  });

  it("keeps missing coverage targets explicit and non-playable", () => {
    expect(missingSounds.length).toBeGreaterThan(0);
    expect(missingSounds.every((entry) => entry.status === "missing")).toBe(true);
    expect(missingSounds.some((entry) => entry.id === "weather:rain")).toBe(true);
    expect(missingSounds.some((entry) => entry.id === "neighborhood:sprinkler")).toBe(true);
    expect(missingSounds.some((entry) => entry.id === "purchase:pour")).toBe(true);
  });

  it("uses unique stable IDs across the complete inventory", () => {
    const ids = soundLibrary.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(soundLibrary).toHaveLength(availableSounds.length + missingSounds.length);
  });
});
