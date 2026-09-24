export type HapticCue =
  | "purchase:serve"
  | "purchase:payment"
  | "purchase:drink"
  | "storm:thunder"
  | "storm:gust";

const HAPTIC_PATTERNS: Readonly<Record<HapticCue, readonly number[]>> = Object.freeze({
  "purchase:serve": Object.freeze([12, 18, 10]),
  "purchase:payment": Object.freeze([18, 18, 34]),
  "purchase:drink": Object.freeze([10, 14, 8]),
  "storm:thunder": Object.freeze([70, 32, 120, 45, 180]),
  "storm:gust": Object.freeze([24, 34, 30, 42, 36]),
});

export const hapticPattern = (cue: HapticCue): readonly number[] => HAPTIC_PATTERNS[cue];

export type HapticEngineOptions = Readonly<{
  vibrate?: (pattern: number[]) => boolean;
  activeDocument?: () => boolean;
}>;

export type HapticEngine = Readonly<{
  play(cue: HapticCue): boolean;
  cancel(): void;
  dispose(): void;
}>;

const browserVibrate = (pattern: number[]): boolean => {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  return navigator.vibrate(pattern);
};

const browserDocumentActive = (): boolean =>
  typeof document === "undefined" || document.visibilityState === "visible";

export const createHapticEngine = (
  options: HapticEngineOptions = {},
): HapticEngine => {
  const vibrate = options.vibrate ?? browserVibrate;
  const activeDocument = options.activeDocument ?? browserDocumentActive;
  let disposed = false;
  let used = false;

  return Object.freeze({
    play(cue): boolean {
      if (disposed || !activeDocument()) return false;
      const pattern = [...hapticPattern(cue)];
      try {
        const accepted = vibrate(pattern);
        used ||= accepted;
        return accepted;
      } catch {
        return false;
      }
    },
    cancel(): void {
      if (!used) return;
      try {
        vibrate([0]);
      } catch {
        // Native vibration is progressive enhancement; cancellation remains best-effort.
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (!used) return;
      try {
        vibrate([0]);
      } catch {
        // Native vibration is progressive enhancement; disposal remains best-effort.
      }
    },
  });
};
