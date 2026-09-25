import { describe, expect, it } from "vitest";

import {
  type AudioCue,
  compileCue,
  cueMixTrimDb,
  environmentBedGainTargets,
  WEATHER_FORECAST_DURATION_MS,
  type WeatherAudioCue,
  weatherMelodyMetadata,
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
  "purchase:pour",
  "purchase:ice-clink",
  "storm:thunder",
  "storm:gust",
  "ambient:birdsong",
];

const weatherMelodies: Readonly<Record<WeatherAudioCue, readonly number[]>> = {
  "forecast:sunny": [72, 74, 67, 72, 76, 67, 72],
  "forecast:hot-and-dry": [69, 65, 69, 67, 65, 67, 69, 65, 62, 57],
  "forecast:cloudy": [64, 64, 64, 65, 64, 62, 60, 64],
  "forecast:thunderstorm": [55, 67, 64, 62, 60, 57, 55, 60, 60, 62, 64, 67],
};

describe("procedural cue compiler", () => {
  it("keeps continuous rain subordinate to foreground cues", () => {
    const dry = environmentBedGainTargets({ windIntensity: 0, precipitation: 0 });
    const moderate = environmentBedGainTargets({ windIntensity: 0, precipitation: 0.5 });
    const heavy = environmentBedGainTargets({ windIntensity: 0, precipitation: 1 });

    expect(dry.rain).toBeCloseTo(0.0001, 6);
    expect(moderate.rain).toBeLessThan(0.003);
    expect(heavy.rain).toBeLessThanOrEqual(0.0061);
    expect(moderate.rain).toBeLessThan(heavy.rain);
  });

  it("drops environment beds to their near-silent floor when muted", () => {
    expect(environmentBedGainTargets({ windIntensity: 1, precipitation: 1 }, true)).toEqual({
      wind: 0.0001,
      rain: 0.0001,
    });
  });

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

  it("keeps foreground purchase cue peaks within a four-decibel mix window", () => {
    const purchaseCues: readonly AudioCue[] = [
      "purchase:serve",
      "purchase:payment",
      "purchase:drink",
      "purchase:pour",
      "purchase:ice-clink",
    ];
    const peaks = purchaseCues.map((cue) =>
      Math.max(...compileCue(cue).map((tone) => tone.gain)),
    );
    const peakDb = peaks.map((gain) => 20 * Math.log10(gain));
    expect(Math.max(...peakDb) - Math.min(...peakDb)).toBeLessThanOrEqual(4);
  });

  it("uses explicit bounded per-cue trims rather than an implicit global loudness assumption", () => {
    for (const cue of cues) {
      expect(cueMixTrimDb(cue)).toBeGreaterThanOrEqual(-6);
      expect(cueMixTrimDb(cue)).toBeLessThanOrEqual(6);
    }
    expect(cueMixTrimDb("purchase:payment")).toBeLessThan(0);
    expect(cueMixTrimDb("purchase:pour")).toBeGreaterThan(0);
    expect(cueMixTrimDb("day:loss")).toBeGreaterThan(cueMixTrimDb("day:profit"));
  });

  it("adds small-speaker spectral support to thunder and gust without raising their bass peaks", () => {
    const thunder = compileCue("storm:thunder");
    const gust = compileCue("storm:gust");

    expect(thunder.some((tone) => tone.midiNote >= 57)).toBe(true);
    expect(gust.some((tone) => tone.midiNote >= 60)).toBe(true);
    expect(Math.max(...thunder.map((tone) => tone.gain))).toBeLessThanOrEqual(0.048);
    expect(Math.max(...gust.map((tone) => tone.gain))).toBeLessThanOrEqual(0.022);
  });

  it("uses a lightweight high-register motif for ambient birdsong", () => {
    const birdsong = compileCue("ambient:birdsong");
    expect(birdsong).toHaveLength(5);
    expect(birdsong.every((tone) => tone.midiNote >= 91)).toBe(true);
    expect(birdsong.every((tone) => tone.gain <= 0.022)).toBe(true);
  });

  it("uses frequency sweeps for drinking, thunder, and wind gusts", () => {
    expect(compileCue("purchase:drink").some((tone) => tone.endMidiNote !== undefined)).toBe(true);
    expect(compileCue("storm:thunder").every((tone) => tone.endMidiNote !== undefined)).toBe(true);
    const gust = compileCue("storm:gust");
    expect(gust.every((tone) => tone.endMidiNote !== undefined)).toBe(true);
    expect(gust.every((tone) => tone.gain <= 0.022)).toBe(true);
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

  it("does not append unverified notes after the Apple II weather excerpt", () => {
    expect(WEATHER_FORECAST_DURATION_MS).toBe(6000);

    for (const [cue, notes] of Object.entries(weatherMelodies) as readonly [
      WeatherAudioCue,
      readonly number[],
    ][]) {
      const tones = compileCue(cue);
      expect(tones.map((tone) => tone.midiNote)).toEqual(notes);
      expect(tones.every((tone) => tone.source === "historical-weather-excerpt")).toBe(true);

      const lastTone = tones.at(-1);
      expect(lastTone).toBeDefined();
      if (lastTone === undefined) {
        throw new Error("expected weather melody tone");
      }

      expect(lastTone.startSeconds + lastTone.durationSeconds).toBeLessThan(3);
    }
  });

  it("does not stretch the historical Apple II excerpt to fill the forecast", () => {
    const cloudy = compileCue("forecast:cloudy").filter(
      (tone) => tone.source === "historical-weather-excerpt",
    );
    const first = cloudy[0];
    const last = cloudy.at(-1);
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    if (first === undefined || last === undefined) {
      throw new Error("expected cloudy historical excerpt");
    }

    expect(first.durationSeconds).toBeCloseTo(180 / 650, 6);
    expect(last.durationSeconds).toBeCloseTo(255 / 650, 6);
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
      expect(metadata.referenceMidi).toMatch(/^https:\/\//);
      expect(metadata.phraseBoundary.length).toBeGreaterThan(0);
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

    const normalGap =
      secondTone.startSeconds - (firstTone.startSeconds + firstTone.durationSeconds);
    const restGap = afterRest.startSeconds - (beforeRest.startSeconds + beforeRest.durationSeconds);
    expect(restGap).toBeGreaterThan(normalGap + 0.15);
  });
});
