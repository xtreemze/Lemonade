import { describe, expect, it } from "vitest";

import {
  type AudioCue,
  availableSounds,
  compileCue,
  missingSounds,
  soundLibrary,
  soundLibraryEntry,
} from "../src/index.js";

const PLAYABLE_CUE_IDS: readonly AudioCue[] = [
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
  "purchase:pour",
  "purchase:ice-clink",
  "storm:thunder",
  "storm:gust",
  "ambient:birdsong",
];

const CONTINUOUS_IDS = ["weather:rain", "weather:wind-bed"] as const;

describe("sound library", () => {
  it("catalogs every playable AudioCue as available", () => {
    expect(availableSounds.map((entry) => entry.id)).toEqual([
      ...PLAYABLE_CUE_IDS,
      ...CONTINUOUS_IDS,
    ]);
    for (const cue of PLAYABLE_CUE_IDS) {
      expect(soundLibraryEntry(cue)?.status).toBe("available");
      expect(compileCue(cue).length).toBeGreaterThan(0);
    }
  });

  it("keeps missing coverage targets explicit and non-playable", () => {
    expect(missingSounds.length).toBeGreaterThan(0);
    expect(missingSounds.every((entry) => entry.status === "missing")).toBe(true);
    expect(soundLibraryEntry("weather:rain")?.status).toBe("available");
    expect(soundLibraryEntry("weather:wind-bed")?.status).toBe("available");
    expect(missingSounds.some((entry) => entry.id === "neighborhood:sprinkler")).toBe(true);
    expect(soundLibraryEntry("purchase:pour")?.status).toBe("available");
    expect(soundLibraryEntry("purchase:ice-clink")?.status).toBe("available");
  });

  it("uses unique stable IDs across the complete inventory", () => {
    const ids = soundLibrary.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(soundLibrary).toHaveLength(availableSounds.length + missingSounds.length);
  });
});
