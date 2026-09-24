const safeDuration = (durationMs: number): number =>
  Math.max(0, Number.isFinite(durationMs) ? durationMs : 0);

export const clampPresentationElapsed = (elapsedMs: number, durationMs: number): number =>
  Math.min(safeDuration(durationMs), Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0));

export const animationElapsedAt = (
  timestampMs: number,
  epochMs: number,
  durationMs: number,
): number => clampPresentationElapsed(timestampMs - epochMs, durationMs);

export const stateUpdateElapsed = (
  presentationChanged: boolean,
  lastElapsedMs: number,
  durationMs: number,
): number => (presentationChanged ? 0 : clampPresentationElapsed(lastElapsedMs, durationMs));

export const resumedAnimationEpoch = (timestampMs: number, lastElapsedMs: number): number =>
  timestampMs - Math.max(0, Number.isFinite(lastElapsedMs) ? lastElapsedMs : 0);
