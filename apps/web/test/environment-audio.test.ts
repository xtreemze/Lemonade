import type { AudioEnvironmentFrame, ProceduralAudioEngine } from "@lemonade/audio";
import { environmentPresentationFrameAt } from "@lemonade/scene/environment-presentation";
import { describe, expect, it } from "vitest";

import { createEnvironmentAudioController } from "../src/environment-audio.js";

const fakeAudio = (frames: AudioEnvironmentFrame[]): ProceduralAudioEngine =>
  Object.freeze({
    enable: async () => true,
    play: () => undefined,
    setEnvironmentFrame: (frame: AudioEnvironmentFrame) => frames.push(frame),
    setMuted: () => undefined,
    suspend: async () => undefined,
    resume: async () => undefined,
    dispose: async () => undefined,
  });

describe("environment audio controller", () => {
  it("publishes renderer-neutral wind and precipitation frames", () => {
    const frames: AudioEnvironmentFrame[] = [];
    let now = 0;
    const callbacks: FrameRequestCallback[] = [];
    const controller = createEnvironmentAudioController(fakeAudio(frames), {
      now: () => now,
      requestFrame: (next) => {
        callbacks.push(next);
        return callbacks.length;
      },
      cancelFrame: () => undefined,
    });

    controller.start("thunderstorm", "simulation", 1000);
    expect(frames.at(-1)).toEqual({
      windIntensity: environmentPresentationFrameAt(
        "thunderstorm",
        "simulation",
        0,
        1000,
        false,
      ).windIntensity,
      precipitation: 1,
    });

    now = 500;
    callbacks.shift()?.(now);
    const expected = environmentPresentationFrameAt(
      "thunderstorm",
      "simulation",
      500,
      1000,
      false,
    );
    expect(frames.at(-1)).toEqual({
      windIntensity: expected.windIntensity,
      precipitation: expected.precipitation,
    });

    controller.stop();
    expect(frames.at(-1)).toEqual({ windIntensity: 0, precipitation: 0 });
  });

  it("does not advance presentation time while paused", () => {
    const frames: AudioEnvironmentFrame[] = [];
    let now = 0;
    const callbacks: FrameRequestCallback[] = [];
    const controller = createEnvironmentAudioController(fakeAudio(frames), {
      now: () => now,
      requestFrame: (next) => {
        callbacks.push(next);
        return callbacks.length;
      },
      cancelFrame: () => undefined,
    });

    controller.start("cloudy", "simulation", 1000);
    now = 200;
    callbacks.shift()?.(now);
    controller.pause();

    now = 800;
    controller.resume();
    const expected = environmentPresentationFrameAt("cloudy", "simulation", 200, 1000, false);
    expect(frames.at(-1)).toEqual({
      windIntensity: expected.windIntensity,
      precipitation: expected.precipitation,
    });
  });
});
