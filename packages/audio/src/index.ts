export type WeatherKind = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";
export type WeatherAudioCue = `forecast:${WeatherKind}`;

export type AudioCue =
  | WeatherAudioCue
  | "day:submit"
  | "day:profit"
  | "day:loss"
  | "progression:unlock"
  | "purchase:serve"
  | "purchase:payment"
  | "purchase:drink"
  | "storm:thunder";

export type ScheduledTone = Readonly<{
  midiNote: number;
  endMidiNote?: number;
  startSeconds: number;
  durationSeconds: number;
  gain: number;
  waveform: OscillatorType;
}>;

export interface MusicalOutputAdapter {
  play(cue: AudioCue, tones: readonly ScheduledTone[]): void | Promise<void>;
  dispose(): void | Promise<void>;
}

export interface ProceduralAudioEngine {
  enable(): Promise<boolean>;
  play(cue: AudioCue): void;
  setMuted(muted: boolean): void;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  dispose(): Promise<void>;
}

type MotifNote = Readonly<{
  note: number;
  beats: number;
  waveform: OscillatorType;
  gain?: number;
  endNote?: number;
}>;

type AppleSpeakerStep = Readonly<{
  pitchValue: number | "rest";
  durationUnits: number;
}>;

type AppleWeatherMelody = Readonly<{
  secondsPerUnit: number;
  steps: readonly AppleSpeakerStep[];
}>;

const MOTIFS: Record<Exclude<AudioCue, WeatherAudioCue>, readonly MotifNote[]> = {
  "day:submit": [
    { note: 60, beats: 0.5, waveform: "square", gain: 0.05 },
    { note: 64, beats: 0.5, waveform: "square", gain: 0.05 },
    { note: 67, beats: 0.5, waveform: "square", gain: 0.05 },
    { note: 72, beats: 1, waveform: "square", gain: 0.05 },
    { note: 69, beats: 0.5, waveform: "triangle", gain: 0.055 },
    { note: 74, beats: 0.5, waveform: "triangle", gain: 0.055 },
    { note: 72, beats: 1.5, waveform: "triangle", gain: 0.055 },
  ],
  "day:profit": [
    { note: 64, beats: 0.75, waveform: "triangle" },
    { note: 67, beats: 0.75, waveform: "triangle" },
    { note: 72, beats: 0.75, waveform: "triangle" },
    { note: 76, beats: 1.5, waveform: "triangle" },
  ],
  "day:loss": [
    { note: 60, beats: 0.75, waveform: "sine" },
    { note: 57, beats: 0.75, waveform: "sine" },
    { note: 53, beats: 1.5, waveform: "sine" },
  ],
  "progression:unlock": [
    { note: 60, beats: 0.5, waveform: "square", gain: 0.045 },
    { note: 64, beats: 0.5, waveform: "square", gain: 0.045 },
    { note: 67, beats: 0.5, waveform: "square", gain: 0.045 },
    { note: 72, beats: 1.5, waveform: "square", gain: 0.045 },
  ],
  "purchase:serve": [
    { note: 76, endNote: 69, beats: 0.45, waveform: "sine", gain: 0.038 },
    { note: 91, beats: 0.18, waveform: "triangle", gain: 0.052 },
    { note: 84, beats: 0.16, waveform: "sine", gain: 0.045 },
    { note: 96, beats: 0.22, waveform: "sine", gain: 0.036 },
  ],
  "purchase:payment": [
    { note: 84, beats: 0.16, waveform: "triangle", gain: 0.048 },
    { note: 96, beats: 0.28, waveform: "sine", gain: 0.055 },
    { note: 91, beats: 0.8, waveform: "sine", gain: 0.038 },
  ],
  "purchase:drink": [
    { note: 64, endNote: 76, beats: 0.7, waveform: "sine", gain: 0.032 },
    { note: 69, endNote: 81, beats: 0.5, waveform: "triangle", gain: 0.026 },
    { note: 74, beats: 0.18, waveform: "sine", gain: 0.022 },
  ],
  "storm:thunder": [
    { note: 33, endNote: 25, beats: 5.5, waveform: "sawtooth", gain: 0.048 },
    { note: 28, endNote: 20, beats: 4.5, waveform: "sawtooth", gain: 0.04 },
    { note: 24, endNote: 16, beats: 5.5, waveform: "triangle", gain: 0.034 },
  ],
};

/**
 * Weather melodies transcribed from the 1979 Applesoft BASIC weather-report
 * DATA tables. The original uses an Apple II speaker routine where lower
 * pitch-period values produce higher notes. Value 1 is explicitly a rest;
 * value 0 wraps like a 256-period delay in the original 8-bit routine.
 *
 * Sunny used a repeated short-tone loop rather than the direct duration
 * routine used by the other three melodies, so it has its own timing scale.
 */
const APPLE_WEATHER_MELODIES: Record<WeatherAudioCue, AppleWeatherMelody> = {
  "forecast:sunny": {
    secondsPerUnit: 1 / 24,
    steps: [
      { pitchValue: 96, durationUnits: 16 },
      { pitchValue: 85, durationUnits: 4 },
      { pitchValue: 128, durationUnits: 4 },
      { pitchValue: 96, durationUnits: 4 },
      { pitchValue: 76, durationUnits: 4 },
      { pitchValue: 128, durationUnits: 4 },
      { pitchValue: 96, durationUnits: 16 },
    ],
  },
  "forecast:hot-and-dry": {
    secondsPerUnit: 1 / 650,
    steps: [
      { pitchValue: 114, durationUnits: 120 },
      { pitchValue: 144, durationUnits: 60 },
      { pitchValue: 114, durationUnits: 255 },
      { pitchValue: "rest", durationUnits: 120 },
      { pitchValue: 128, durationUnits: 120 },
      { pitchValue: 144, durationUnits: 60 },
      { pitchValue: 128, durationUnits: 120 },
      { pitchValue: 114, durationUnits: 60 },
      { pitchValue: 144, durationUnits: 120 },
      { pitchValue: 171, durationUnits: 255 },
      { pitchValue: 228, durationUnits: 255 },
    ],
  },
  "forecast:cloudy": {
    secondsPerUnit: 1 / 650,
    steps: [
      { pitchValue: 152, durationUnits: 180 },
      { pitchValue: 152, durationUnits: 120 },
      { pitchValue: 152, durationUnits: 60 },
      { pitchValue: 144, durationUnits: 120 },
      { pitchValue: 152, durationUnits: 60 },
      { pitchValue: 171, durationUnits: 120 },
      { pitchValue: 192, durationUnits: 60 },
      { pitchValue: 152, durationUnits: 255 },
    ],
  },
  "forecast:thunderstorm": {
    secondsPerUnit: 1 / 650,
    steps: [
      { pitchValue: 0, durationUnits: 160 },
      { pitchValue: 128, durationUnits: 255 },
      { pitchValue: 152, durationUnits: 40 },
      { pitchValue: 171, durationUnits: 80 },
      { pitchValue: 192, durationUnits: 40 },
      { pitchValue: 228, durationUnits: 255 },
      { pitchValue: "rest", durationUnits: 40 },
      { pitchValue: 0, durationUnits: 160 },
      { pitchValue: 192, durationUnits: 255 },
      { pitchValue: 192, durationUnits: 40 },
      { pitchValue: 171, durationUnits: 80 },
      { pitchValue: 152, durationUnits: 40 },
      { pitchValue: 128, durationUnits: 255 },
    ],
  },
};

const BEAT_SECONDS = 0.12;
const GAP_SECONDS = 0.018;
const APPLE_SPEAKER_GAIN = 0.042;
const APPLE_SPEAKER_GAP_SECONDS = 0.012;

const isWeatherCue = (cue: AudioCue): cue is WeatherAudioCue => cue.startsWith("forecast:");

const applePitchToMidi = (pitchValue: number): number => {
  const effectivePitch = pitchValue === 0 ? 256 : pitchValue;
  return Math.round(60 + 12 * Math.log2(192 / effectivePitch));
};

const compileAppleWeatherCue = (cue: WeatherAudioCue): readonly ScheduledTone[] => {
  const melody = APPLE_WEATHER_MELODIES[cue];
  const tones: ScheduledTone[] = [];
  let cursor = 0;

  for (const step of melody.steps) {
    const durationSeconds = step.durationUnits * melody.secondsPerUnit;
    if (step.pitchValue !== "rest") {
      tones.push(
        Object.freeze({
          midiNote: applePitchToMidi(step.pitchValue),
          startSeconds: cursor,
          durationSeconds,
          gain: APPLE_SPEAKER_GAIN,
          waveform: "square",
        }),
      );
    }
    cursor += durationSeconds + APPLE_SPEAKER_GAP_SECONDS;
  }

  return Object.freeze(tones);
};

const compileModernCue = (
  cue: Exclude<AudioCue, WeatherAudioCue>,
): readonly ScheduledTone[] => {
  let cursor = 0;
  const tones: ScheduledTone[] = [];

  for (const motifNote of MOTIFS[cue]) {
    const durationSeconds = motifNote.beats * BEAT_SECONDS;
    tones.push(
      Object.freeze({
        midiNote: motifNote.note,
        ...(motifNote.endNote === undefined ? {} : { endMidiNote: motifNote.endNote }),
        startSeconds: cursor,
        durationSeconds,
        gain: motifNote.gain ?? 0.07,
        waveform: motifNote.waveform,
      }),
    );
    cursor += durationSeconds + GAP_SECONDS;
  }

  return Object.freeze(tones);
};

export const compileCue = (cue: AudioCue): readonly ScheduledTone[] =>
  isWeatherCue(cue) ? compileAppleWeatherCue(cue) : compileModernCue(cue);

const midiToFrequency = (note: number): number => 440 * 2 ** ((note - 69) / 12);

export const createProceduralAudioEngine = (): ProceduralAudioEngine => {
  let context: AudioContext | null = null;
  let muted = false;
  let disposed = false;

  const enable = async (): Promise<boolean> => {
    if (disposed) return false;

    if (context === null) {
      try {
        context = new AudioContext({ latencyHint: "interactive" });
      } catch {
        return false;
      }
    }

    if (context.state === "suspended") {
      await context.resume();
    }
    return context.state === "running";
  };

  const play = (cue: AudioCue): void => {
    const activeContext = context;
    if (muted || disposed || activeContext === null || activeContext.state === "closed") return;

    const baseTime = activeContext.currentTime + 0.012;
    for (const tone of compileCue(cue)) {
      const oscillator = activeContext.createOscillator();
      const envelope = activeContext.createGain();
      const start = baseTime + tone.startSeconds;
      const end = start + tone.durationSeconds;

      oscillator.type = tone.waveform;
      oscillator.frequency.setValueAtTime(midiToFrequency(tone.midiNote), start);
      if (tone.endMidiNote !== undefined && tone.endMidiNote !== tone.midiNote) {
        oscillator.frequency.exponentialRampToValueAtTime(
          midiToFrequency(tone.endMidiNote),
          end,
        );
      }
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(
        tone.gain,
        start + Math.min(0.012, tone.durationSeconds / 4),
      );
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(envelope);
      envelope.connect(activeContext.destination);
      oscillator.addEventListener("ended", () => {
        oscillator.disconnect();
        envelope.disconnect();
      });
      oscillator.start(start);
      oscillator.stop(end + 0.004);
    }
  };

  const setMuted = (value: boolean): void => {
    muted = value;
  };

  const suspend = async (): Promise<void> => {
    if (context !== null && context.state === "running") await context.suspend();
  };

  const resume = async (): Promise<void> => {
    if (!disposed && context !== null && context.state === "suspended") await context.resume();
  };

  const dispose = async (): Promise<void> => {
    disposed = true;
    if (context !== null && context.state !== "closed") await context.close();
    context = null;
  };

  return Object.freeze({ enable, play, setMuted, suspend, resume, dispose });
};

export const weatherCue = (weather: WeatherKind): WeatherAudioCue => `forecast:${weather}`;
