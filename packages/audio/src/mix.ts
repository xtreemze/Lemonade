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
  smallSpeakerPresenceDb: number;
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
  "purchase:pour": Object.freeze({ role: "purchase", trimDb: 9.5 }),
  "purchase:ice-clink": Object.freeze({ role: "purchase", trimDb: 1 }),
  "storm:thunder": Object.freeze({ role: "weather-accent", trimDb: -1 }),
  "storm:gust": Object.freeze({ role: "weather-accent", trimDb: 1 }),
  "ambient:birdsong": Object.freeze({ role: "ambient", trimDb: -1 }),
});

const MIN_DB = -120;

export const dbToGain = (db: number): number => (Number.isFinite(db) ? 10 ** (db / 20) : 0);

export const gainToDb = (gain: number): number =>
  gain > 0 && Number.isFinite(gain) ? 20 * Math.log10(gain) : MIN_DB;

export const cueMixProfile = (cue: AudioCue): CueMixProfile => CUE_MIX_PROFILES[cue];

export const cueMixGain = (cue: AudioCue): number => dbToGain(cueMixProfile(cue).trimDb);

const midiToFrequency = (note: number): number => 440 * 2 ** ((note - 69) / 12);

const aWeightDb = (frequency: number): number => {
  const f2 = frequency * frequency;
  const numerator = 12_200 ** 2 * f2 * f2;
  const denominator =
    (f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12_200 ** 2);
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
export const analyzeCueMix = (cue: AudioCue, tones: readonly CueMixTone[]): CueMixMetrics => {
  const profile = cueMixProfile(cue);
  const trimGain = cueMixGain(cue);
  const durationSeconds = Math.max(
    0.001,
    tones.reduce((sum, tone) => sum + Math.max(0, tone.durationSeconds), 0),
  );
  const peakGain = tones.reduce((peak, tone) => Math.max(peak, tone.gain * trimGain), 0);

  let weightedEnergy = 0;
  let smallSpeakerPresenceGain = 0;
  for (const tone of tones) {
    const duration = Math.max(0, tone.durationSeconds);
    const frequency = toneRepresentativeFrequency(tone);
    const weight = dbToGain(aWeightDb(frequency));
    const rms = tone.gain * trimGain * waveformRms(tone.waveform) * 0.58;
    weightedEnergy += rms * rms * weight * weight * duration;
    smallSpeakerPresenceGain = Math.max(smallSpeakerPresenceGain, tone.gain * trimGain * weight);
  }

  const approximateRms = Math.sqrt(weightedEnergy / durationSeconds);
  return Object.freeze({
    cue,
    role: profile.role,
    trimDb: profile.trimDb,
    peakGain,
    peakDbfs: gainToDb(peakGain),
    approximatePerceptualDb: gainToDb(approximateRms),
    smallSpeakerPresenceDb: gainToDb(smallSpeakerPresenceGain),
  });
};

const oscillatorSample = (waveform: OscillatorType, phase: number): number => {
  const unit = phase / (Math.PI * 2);
  switch (waveform) {
    case "square":
      return Math.sin(phase) >= 0 ? 1 : -1;
    case "triangle":
      return (2 / Math.PI) * Math.asin(Math.sin(phase));
    case "sawtooth":
      return 2 * (unit - Math.floor(unit + 0.5));
    case "sine":
    default:
      return Math.sin(phase);
  }
};

/**
 * Deterministic offline calibration renderer used by tests and tooling. It
 * mirrors cue timing, sweeps, gain trims and a simple attack/release envelope
 * without requiring an AudioContext or audio device.
 */
export const renderCueCalibrationPcm = (
  cue: AudioCue,
  tones: readonly (CueMixTone & Readonly<{ startSeconds?: number }>)[],
  sampleRate = 8_000,
): Float32Array => {
  const safeRate = Math.max(2_000, Math.min(48_000, Math.round(sampleRate)));
  const mixGain = cueMixGain(cue);
  const endSeconds = tones.reduce(
    (latest, tone) =>
      Math.max(latest, (tone.startSeconds ?? 0) + Math.max(0, tone.durationSeconds)),
    0,
  );
  const samples = new Float32Array(Math.max(1, Math.ceil((endSeconds + 0.01) * safeRate)));

  for (const tone of tones) {
    const startSeconds = Math.max(0, tone.startSeconds ?? 0);
    const duration = Math.max(0.001, tone.durationSeconds);
    const startSample = Math.floor(startSeconds * safeRate);
    const endSample = Math.min(samples.length, Math.ceil((startSeconds + duration) * safeRate));
    const startFrequency = midiToFrequency(tone.midiNote);
    const endFrequency =
      tone.endMidiNote === undefined ? startFrequency : midiToFrequency(tone.endMidiNote);
    let phase = 0;

    for (let index = startSample; index < endSample; index += 1) {
      const elapsed = (index - startSample) / safeRate;
      const progress = Math.min(1, elapsed / duration);
      const frequency =
        startFrequency === endFrequency
          ? startFrequency
          : startFrequency * (endFrequency / startFrequency) ** progress;
      phase += (Math.PI * 2 * frequency) / safeRate;

      const attack = Math.min(1, elapsed / Math.min(0.012, duration / 4));
      const release = Math.min(
        1,
        Math.max(0, (duration - elapsed) / Math.min(0.012, duration / 4)),
      );
      const envelope = Math.max(0, Math.min(attack, release));
      samples[index] =
        (samples[index] ?? 0) +
        oscillatorSample(tone.waveform, phase) * tone.gain * mixGain * envelope;
    }
  }

  return samples;
};

export const measureCalibrationPcm = (
  samples: Float32Array,
): Readonly<{ peak: number; rms: number; peakDbfs: number; rmsDbfs: number }> => {
  let peak = 0;
  let energy = 0;
  for (const sample of samples) {
    const magnitude = Math.abs(sample);
    peak = Math.max(peak, magnitude);
    energy += sample * sample;
  }
  const rms = samples.length > 0 ? Math.sqrt(energy / samples.length) : 0;
  return Object.freeze({
    peak,
    rms,
    peakDbfs: gainToDb(peak),
    rmsDbfs: gainToDb(rms),
  });
};
