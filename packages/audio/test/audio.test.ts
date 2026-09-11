import { describe, expect, it } from "vitest";

import { compileCue, type AudioCue } from "../src/index.js";

const cues: readonly AudioCue[] = [
  "forecast:sunny",
  "forecast:cloudy",
  "forecast:hot-and-dry",
  "forecast:thunderstorm",
  "day:submit",
  "day:profit",
  "day:loss",
  "progression:unlock",
];

describe("procedural cue compiler", () => {
  it("is deterministic without an audio device", () => {
    for (const cue of cues) {
      expect(compileCue(cue)).toEqual(compileCue(cue));
    }
  });

  it("produces bounded playable events for every semantic cue", () => {
    for (const cue of cues) {
      const tones = compileCue(cue);
      expect(tones.length).toBeGreaterThan(0);

      for (const tone of tones) {
        expect(tone.midiNote).toBeGreaterThanOrEqual(0);
        expect(tone.midiNote).toBeLessThanOrEqual(127);
        expect(tone.startSeconds).toBeGreaterThanOrEqual(0);
        expect(tone.durationSeconds).toBeGreaterThan(0);
        expect(tone.gain).toBeGreaterThan(0);
        expect(tone.gain).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it("schedules tones monotonically within a cue", () => {
    for (const cue of cues) {
      let previousStart = -1;
      for (const tone of compileCue(cue)) {
        expect(tone.startSeconds).toBeGreaterThan(previousStart);
        previousStart = tone.startSeconds;
      }
    }
  });
});
