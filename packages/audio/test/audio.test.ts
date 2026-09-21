import { describe, expect, it } from "vitest";

import { compileCue, type AudioCue, type WeatherAudioCue } from "../src/index.js";

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

const weatherMelodies: Readonly<Record<WeatherAudioCue, readonly number[]>> = {
  "forecast:sunny": [72, 74, 67, 72, 76, 67, 72],
  "forecast:hot-and-dry": [69, 65, 69, 67, 65, 67, 69, 65, 62, 57],
  "forecast:cloudy": [64, 64, 64, 65, 64, 62, 60, 64],
  "forecast:thunderstorm": [55, 67, 64, 62, 60, 57, 55, 60, 60, 62, 64, 67],
};

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

  it("reconstructs the Apple II weather melody contours", () => {
    for (const [cue, notes] of Object.entries(weatherMelodies) as readonly [
      WeatherAudioCue,
      readonly number[],
    ][]) {
      const tones = compileCue(cue);
      expect(tones.map((tone) => tone.midiNote)).toEqual(notes);
      expect(tones.every((tone) => tone.waveform === "square")).toBe(true);
    }
  });

  it("keeps each weather melody inside the three-second forecast scene", () => {
    for (const cue of Object.keys(weatherMelodies) as WeatherAudioCue[]) {
      const tones = compileCue(cue);
      const lastTone = tones.at(-1);
      expect(lastTone).toBeDefined();
      if (lastTone === undefined) throw new Error("expected weather melody tone");
      expect(lastTone.startSeconds + lastTone.durationSeconds).toBeLessThanOrEqual(3);
    }
  });

  it("preserves the original rests as audible phrase gaps", () => {
    const hotAndDry = compileCue("forecast:hot-and-dry");
    const firstTone = hotAndDry[0];
    const secondTone = hotAndDry[1];
    const beforeRest = hotAndDry[2];
    const afterRest = hotAndDry[3];
    if (
      firstTone === undefined ||
      secondTone === undefined ||
      beforeRest === undefined ||
      afterRest === undefined
    ) {
      throw new Error("expected hot-and-dry melody phrase");
    }

    const normalGap = secondTone.startSeconds - (
      firstTone.startSeconds + firstTone.durationSeconds
    );
    const restGap = afterRest.startSeconds - (
      beforeRest.startSeconds + beforeRest.durationSeconds
    );
    expect(restGap).toBeGreaterThan(normalGap + 0.15);
  });
});
