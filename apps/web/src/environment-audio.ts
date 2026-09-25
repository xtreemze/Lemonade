import type { ProceduralAudioEngine } from "@lemonade/audio/contracts";
import {
  type EnvironmentPresentationPhase,
  type EnvironmentWeatherKind,
  environmentPresentationFrameAt,
} from "@lemonade/scene/environment-presentation";

export type EnvironmentAudioController = Readonly<{
  start: (
    weather: EnvironmentWeatherKind,
    phase: EnvironmentPresentationPhase,
    durationMs: number,
  ) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  dispose: () => void;
}>;

type EnvironmentAudioControllerOptions = Readonly<{
  now?: () => number;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
}>;

const zeroFrame = Object.freeze({ windIntensity: 0, precipitation: 0 });

export const createEnvironmentAudioController = (
  audio: ProceduralAudioEngine,
  options: EnvironmentAudioControllerOptions = {},
): EnvironmentAudioController => {
  const now = options.now ?? (() => performance.now());
  const requestFrame =
    options.requestFrame ??
    ((callback: FrameRequestCallback) => window.requestAnimationFrame(callback));
  const cancelFrame =
    options.cancelFrame ?? ((handle: number) => window.cancelAnimationFrame(handle));

  let disposed = false;
  let active = false;
  let paused = false;
  let frameHandle: number | null = null;
  let weather: EnvironmentWeatherKind = "sunny";
  let phase: EnvironmentPresentationPhase = "idle";
  let durationMs = 1;
  let elapsedBeforePause = 0;
  let startedAt = 0;

  const cancelScheduledFrame = (): void => {
    if (frameHandle !== null) {
      cancelFrame(frameHandle);
      frameHandle = null;
    }
  };

  const publishFrame = (elapsedMs: number): void => {
    const frame = environmentPresentationFrameAt(weather, phase, elapsedMs, durationMs, false);
    audio.setEnvironmentFrame({
      windIntensity: frame.windIntensity,
      precipitation: frame.precipitation,
    });
  };

  const tick: FrameRequestCallback = () => {
    frameHandle = null;
    if (disposed || !active || paused) {
      return;
    }
    const elapsed = Math.min(durationMs, elapsedBeforePause + Math.max(0, now() - startedAt));
    publishFrame(elapsed);
    if (elapsed >= durationMs) {
      active = false;
      audio.setEnvironmentFrame(zeroFrame);
      return;
    }
    frameHandle = requestFrame(tick);
  };

  const start = (
    nextWeather: EnvironmentWeatherKind,
    nextPhase: EnvironmentPresentationPhase,
    nextDurationMs: number,
  ): void => {
    if (disposed) {
      return;
    }
    cancelScheduledFrame();
    weather = nextWeather;
    phase = nextPhase;
    durationMs = Math.max(1, Number.isFinite(nextDurationMs) ? nextDurationMs : 1);
    elapsedBeforePause = 0;
    startedAt = now();
    active = phase !== "idle";
    paused = false;
    if (!active) {
      audio.setEnvironmentFrame(zeroFrame);
      return;
    }
    publishFrame(0);
    frameHandle = requestFrame(tick);
  };

  const pause = (): void => {
    if (disposed || !active || paused) {
      return;
    }
    elapsedBeforePause = Math.min(durationMs, elapsedBeforePause + Math.max(0, now() - startedAt));
    paused = true;
    cancelScheduledFrame();
  };

  const resume = (): void => {
    if (disposed || !active || !paused) {
      return;
    }
    paused = false;
    startedAt = now();
    publishFrame(elapsedBeforePause);
    frameHandle = requestFrame(tick);
  };

  const stop = (): void => {
    active = false;
    paused = false;
    elapsedBeforePause = 0;
    cancelScheduledFrame();
    audio.setEnvironmentFrame(zeroFrame);
  };

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    stop();
  };

  return Object.freeze({ start, pause, resume, stop, dispose });
};
