export type AudioCue =
  | "forecast:sunny"
  | "forecast:cloudy"
  | "forecast:hot-and-dry"
  | "forecast:thunderstorm"
  | "day:submit"
  | "day:profit"
  | "day:loss"
  | "progression:unlock";

export type ScheduledTone = Readonly<{
  midiNote: number;
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
}>;

const MOTIFS: Record<AudioCue, readonly MotifNote[]> = {
  "forecast:sunny": [
    { note: 72, beats: 1, waveform: "triangle" },
    { note: 76, beats: 1, waveform: "triangle" },
    { note: 79, beats: 2, waveform: "triangle" },
  ],
  "forecast:cloudy": [
    { note: 67, beats: 1, waveform: "sine" },
    { note: 70, beats: 1, waveform: "sine" },
    { note: 65, beats: 2, waveform: "sine" },
  ],
  "forecast:hot-and-dry": [
    { note: 76, beats: 1, waveform: "square", gain: 0.055 },
    { note: 79, beats: 1, waveform: "square", gain: 0.055 },
    { note: 83, beats: 2, waveform: "square", gain: 0.055 },
  ],
  "forecast:thunderstorm": [
    { note: 48, beats: 1, waveform: "sawtooth", gain: 0.045 },
    { note: 43, beats: 2, waveform: "sawtooth", gain: 0.045 },
  ],
  "day:submit": [
    { note: 60, beats: 0.5, waveform: "square", gain: 0.05 },
    { note: 67, beats: 0.75, waveform: "square", gain: 0.05 },
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
};

const BEAT_SECONDS = 0.12;
const GAP_SECONDS = 0.018;

export const compileCue = (cue: AudioCue): readonly ScheduledTone[] => {
  let cursor = 0;
  const tones: ScheduledTone[] = [];

  for (const motifNote of MOTIFS[cue]) {
    const durationSeconds = motifNote.beats * BEAT_SECONDS;
    tones.push(
      Object.freeze({
        midiNote: motifNote.note,
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
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(tone.gain, start + Math.min(0.018, tone.durationSeconds / 3));
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

export const weatherCue = (
  weather: "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm",
): AudioCue => `forecast:${weather}`;
