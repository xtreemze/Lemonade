import type { AudioCue } from "./contracts.js";

export type CueMixRole =
  | "forecast"
  | "interface"
  | "result"
  | "purchase"
  | "weather-accent"
  | "ambient";

export type CueMixProfile = Readonly<{
  role: CueMixRole;
  trimDb: number;
}>;

export type CueMixTone = Readonly<{
  midiNote: number;
  endMidiNote?: number;
  durationSeconds: number;
  gain: number;
  waveform: OscillatorType;
}>;

export type CueMixMetrics = Readonly<{
  cue: AudioCue;
  role: CueMixRole;
  trimDb: number;
  peakGain: number;
  peakDbfs: number;
  approximatePerceptualDb: number;
}>;

export const CUE_MIX_PROFILES: Readonly<Record<AudioCue, CueMixProfile>> = Object.freeze({
  "forecast:sunny": Object.freeze({ role: "forecast", trimDb: -2 }),
  "forecast:cloudy": Object.freeze({ role: "forecast", trimDb: -2 }),
  "forecast:hot-and-dry": Object.freeze({ role: "forecast", trimDb: -2 }),
  "forecast:thunderstorm": Object.freeze({ role: "forecast", trimDb: -2 }),
  "day:submit": Object.freeze({ role: "interface", trimDb: -2 }),
  "day:profit": Object.freeze({ role: "result", trimDb: -3 }),
  "day:loss": Object.freeze({ role: "result", trimDb: 1.5 }),
  "progression:unlock": Object.freeze({ role: "result", trimDb: -2 }),
  "purchase:serve": Object.freeze({ role: "purchase", trimDb: -1 }),
  "purchase:payment": Object.freeze({ role: "purchase", trimDb: -4 }),
  "purchase:drink": Object.freeze({ role: "purchase", trimDb: 3 }),
  "purchase:pour": Object.freeze({ role: "purchase", trimDb: 6 }),
  "purchase:ice-clink": Object.freeze({ role: "purchase", trimDb: 1 }),
  "storm:thunder": Object.freeze({ role: "weather-accent", trimDb: -1 }),
  "storm:gust": Object.freeze({ role: "weather-accent", trimDb: 1 }),
  "ambient:birdsong": Object.freeze({ role: "ambient", trimDb: -1 }),
});

const MIN_DB = -120;

export const dbToGain = (db: number): number =>
  Number.isFinite(db) ? 10 ** (db / 20) : 0;

export const gainToDb = (gain: number): number =>
  gain > 0 && Number.isFinite(gain) ? 20 * Math.log10(gain) : MIN_DB;

export const cueMixProfile = (cue: AudioCue): CueMixProfile => CUE_MIX_PROFILES[cue];

export const cueMixGain = (cue: AudioCue): number => dbToGain(cueMixProfile(cue).trimDb);

const midiToFrequency = (note: number): number => 440 * 2 ** ((note - 69) / 12);

const aWeightDb = (frequency: number): number => {
  const f2 = frequency * frequency;
  const numerator = 12_200 ** 2 * f2 * f2;
  const denominator =
    (f2 + 20.6 ** 2) *
    Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) *
    (f2 + 12_200 ** 2);
  const ra = denominator > 0 ? numerator / denominator : 0;
  return ra > 0 ? 20 * Math.log10(ra) + 2 : MIN_DB;
};

const waveformRms = (waveform: OscillatorType): number => {
  switch (waveform) {
    case "square":
      return 1;
    case "sine":
      return Math.SQRT1_2;
    case "triangle":
    case "sawtooth":
      return 1 / Math.sqrt(3);
    default:
      return Math.SQRT1_2;
  }
};

const toneRepresentativeFrequency = (tone: CueMixTone): number => {
  const start = midiToFrequency(tone.midiNote);
  if (tone.endMidiNote === undefined) {
    return start;
  }
  return Math.sqrt(start * midiToFrequency(tone.endMidiNote));
};

/**
 * Static mix calibration estimate. This intentionally does not claim LUFS:
 * it applies oscillator RMS, cue trim, an envelope-energy approximation and
 * A-weighting to provide a stable relative signal for regression tests.
 */
export const analyzeCueMix = (
  cue: AudioCue,
  tones: readonly CueMixTone[],
): CueMixMetrics => {
  const profile = cueMixProfile(cue);
  const trimGain = cueMixGain(cue);
  const durationSeconds = Math.max(
    0.001,
    tones.reduce((sum, tone) => sum + Math.max(0, tone.durationSeconds), 0),
  );
  const peakGain = tones.reduce(
    (peak, tone) => Math.max(peak, tone.gain * trimGain),
    0,
  );

  let weightedEnergy = 0;
  for (const tone of tones) {
    const duration = Math.max(0, tone.durationSeconds);
    const frequency = toneRepresentativeFrequency(tone);
    const weight = dbToGain(aWeightDb(frequency));
    const rms = tone.gain * trimGain * waveformRms(tone.waveform) * 0.58;
    weightedEnergy += rms * rms * weight * weight * duration;
  }

  const approximateRms = Math.sqrt(weightedEnergy / durationSeconds);
  return Object.freeze({
    cue,
    role: profile.role,
    trimDb: profile.trimDb,
    peakGain,
    peakDbfs: gainToDb(peakGain),
    approximatePerceptualDb: gainToDb(approximateRms),
  });
};
