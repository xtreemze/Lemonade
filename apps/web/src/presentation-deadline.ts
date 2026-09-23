export type PresentationDeadline = Readonly<{
  schedule(delayMs: number, callback: () => void): void;
  pause(): void;
  resume(): void;
  cancel(): void;
  readonly pending: boolean;
}>;

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

const safeDelay = (delayMs: number): number =>
  Math.max(0, Number.isFinite(delayMs) ? delayMs : 0);

export const createPresentationDeadline = (): PresentationDeadline => {
  let timer: TimerHandle | null = null;
  let callback: (() => void) | null = null;
  let remainingMs = 0;
  let startedAtMs = 0;
  let paused = false;

  const clearTimer = (): void => {
    if (timer === null) return;
    globalThis.clearTimeout(timer);
    timer = null;
  };

  const arm = (): void => {
    if (callback === null || paused) return;
    startedAtMs = performance.now();
    timer = globalThis.setTimeout(() => {
      timer = null;
      const next = callback;
      callback = null;
      remainingMs = 0;
      if (next !== null) next();
    }, remainingMs);
  };

  const cancel = (): void => {
    clearTimer();
    callback = null;
    remainingMs = 0;
    paused = false;
  };

  const schedule = (delayMs: number, next: () => void): void => {
    cancel();
    callback = next;
    remainingMs = safeDelay(delayMs);
    arm();
  };

  const pause = (): void => {
    if (paused || callback === null || timer === null) return;
    remainingMs = Math.max(0, remainingMs - (performance.now() - startedAtMs));
    clearTimer();
    paused = true;
  };

  const resume = (): void => {
    if (!paused || callback === null) return;
    paused = false;
    arm();
  };

  return Object.freeze({
    schedule,
    pause,
    resume,
    cancel,
    get pending(): boolean {
      return callback !== null;
    },
  });
};
