import { describe, expect, it } from "vitest";

import {
  WEATHER_FORECAST_DURATION_MS,
  compileCue,
  weatherMelodyMetadata,
  type AudioCue,
  type WeatherAudioCue,
} from "../src/index.js";

const cues: readonly AudioCue[] = [
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
        if (tone.endMidiNote !== undefined) {
          expect(tone.endMidiNote).toBeGreaterThanOrEqual(0);
          expect(tone.endMidiNote).toBeLessThanOrEqual(127);
        }
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

  it("uses frequency sweeps for drinking and thunder", () => {
    expect(compileCue("purchase:drink").some((tone) => tone.endMidiNote !== undefined)).toBe(true);
    expect(compileCue("storm:thunder").every((tone) => tone.endMidiNote !== undefined)).toBe(true);
  });

  it("reconstructs the Apple II weather melody contours", () => {
    for (const [cue, notes] of Object.entries(weatherMelodies) as readonly [
      WeatherAudioCue,
      readonly number[],
    ][]) {
      const historicalTones = compileCue(cue).filter(
        (tone) => tone.source === "historical-weather-excerpt",
      );
      expect(historicalTones.map((tone) => tone.midiNote)).toEqual(notes);
      expect(historicalTones.every((tone) => tone.waveform === "square")).toBe(true);
    }
  });

  it("fills the six-second forecast with a resolved original continuation", () => {
    expect(WEATHER_FORECAST_DURATION_MS).toBe(6_000);

    for (const cue of Object.keys(weatherMelodies) as WeatherAudioCue[]) {
      const tones = compileCue(cue);
      const historical = tones.filter(
        (tone) => tone.source === "historical-weather-excerpt",
      );
      const variation = tones.filter(
        (tone) => tone.source === "original-weather-variation",
      );
      const lastTone = tones.at(-1);
      const lastHistoricalTone = historical.at(-1);
      const firstVariationTone = variation[0];

      expect(lastTone).toBeDefined();
      expect(lastHistoricalTone).toBeDefined();
      expect(firstVariationTone).toBeDefined();
      if (
        lastTone === undefined ||
        lastHistoricalTone === undefined ||
        firstVariationTone === undefined
      ) {
        throw new Error("expected complete weather phrase");
      }

      const phraseEnd = lastTone.startSeconds + lastTone.durationSeconds;
      expect(phraseEnd).toBeGreaterThanOrEqual(5.5);
      expect(phraseEnd).toBeLessThanOrEqual(WEATHER_FORECAST_DURATION_MS / 1_000);
      expect(firstVariationTone.startSeconds).toBeGreaterThan(
        lastHistoricalTone.startSeconds + lastHistoricalTone.durationSeconds,
      );
      expect(variation.length).toBeGreaterThanOrEqual(6);
    }
  });

  it("documents the real tune behind every Apple II weather motif", () => {
    expect(weatherMelodyMetadata("forecast:sunny").title).toContain("Ranz des Vaches");
    expect(weatherMelodyMetadata("forecast:cloudy").title).toBe(
      "Raindrops Keep Fallin’ on My Head",
    );
    expect(weatherMelodyMetadata("forecast:hot-and-dry").title).toBe("Summertime");
    expect(weatherMelodyMetadata("forecast:thunderstorm").title).toBe("Singin’ in the Rain");

    for (const cue of Object.keys(weatherMelodies) as WeatherAudioCue[]) {
      const metadata = weatherMelodyMetadata(cue);
      expect(metadata.historicalSource).toContain("1979 Apple II Lemonade Stand");
      expect(metadata.continuation).toBe("original-variation");
    }
  });

  it("preserves the original rests as audible phrase gaps", () => {
    const hotAndDry = compileCue("forecast:hot-and-dry").filter(
      (tone) => tone.source === "historical-weather-excerpt",
    );
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
