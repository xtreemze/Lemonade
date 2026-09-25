import { describe, expect, it } from "vitest";

import {
  type AudioCue,
  CUE_MIX_PROFILES,
  compileCue,
  cueMixMetrics,
  measureCalibrationPcm,
  renderCueCalibrationPcm,
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

describe("perceptual audio mix", () => {
  it("requires an explicit semantic mix profile for every cue", () => {
    expect(Object.keys(CUE_MIX_PROFILES).sort()).toEqual([...cues].sort());
    for (const cue of cues) {
      expect(Number.isFinite(CUE_MIX_PROFILES[cue].trimDb)).toBe(true);
    }
  });

  it("keeps purchase feedback within one perceptual foreground band", () => {
    const purchaseCues: readonly AudioCue[] = [
      "purchase:serve",
      "purchase:payment",
      "purchase:drink",
      "purchase:pour",
      "purchase:ice-clink",
    ];
    const levels = purchaseCues.map((cue) => cueMixMetrics(cue).approximatePerceptualDb);
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThanOrEqual(4);
  });

  it("balances profit and loss by perception rather than raw oscillator gain", () => {
    const profit = cueMixMetrics("day:profit").approximatePerceptualDb;
    const loss = cueMixMetrics("day:loss").approximatePerceptualDb;
    expect(Math.abs(profit - loss)).toBeLessThan(2);
  });

  it("adds small-speaker presence to thunder and gusts without raising their bass bed", () => {
    const thunder = compileCue("storm:thunder");
    const gust = compileCue("storm:gust");
    expect(thunder.some((tone) => tone.midiNote >= 60)).toBe(true);
    expect(gust.some((tone) => tone.midiNote >= 60)).toBe(true);
    expect(cueMixMetrics("storm:thunder").smallSpeakerPresenceDb).toBeGreaterThan(-40);
    expect(cueMixMetrics("storm:gust").smallSpeakerPresenceDb).toBeGreaterThan(-45);
  });

  it("offline-renders every cue deterministically with foreground headroom", () => {
    for (const cue of cues) {
      const tones = compileCue(cue);
      const first = renderCueCalibrationPcm(cue, tones);
      const repeated = renderCueCalibrationPcm(cue, tones);
      expect(first).toEqual(repeated);

      const measured = measureCalibrationPcm(first);
      expect(measured.peak).toBeGreaterThan(0);
      expect(measured.rms).toBeGreaterThan(0);
      expect(measured.peak).toBeLessThan(0.1);
      expect(measured.rms).toBeLessThan(measured.peak);
    }
  });
});
