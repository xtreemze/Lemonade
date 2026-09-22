import { describe, expect, it, vi } from "vitest";

import { createHapticEngine, hapticPattern, type HapticCue } from "../src/haptics.js";

const cues: readonly HapticCue[] = [
  "purchase:serve",
  "purchase:payment",
  "purchase:drink",
  "storm:thunder",
  "storm:gust",
];

describe("haptic feedback", () => {
  it("defines short bounded patterns for every semantic cue", () => {
    for (const cue of cues) {
      const pattern = hapticPattern(cue);
      expect(pattern.length).toBeGreaterThan(0);
      expect(pattern.every((duration) => Number.isInteger(duration) && duration >= 0)).toBe(true);
      expect(pattern.reduce((total, duration) => total + duration, 0)).toBeLessThanOrEqual(500);
    }
  });

  it("gives storm gusts a softer pattern than thunder", () => {
    const gust = hapticPattern("storm:gust").reduce((sum, duration) => sum + duration, 0);
    const thunder = hapticPattern("storm:thunder").reduce((sum, duration) => sum + duration, 0);
    expect(gust).toBeLessThan(thunder);
  });

  it("plays native vibration when active and allowed", () => {
    const vibrate = vi.fn(() => true);
    const engine = createHapticEngine({
      vibrate,
      reducedMotion: () => false,
      activeDocument: () => true,
    });

    expect(engine.play("purchase:payment")).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([...hapticPattern("purchase:payment")]);
  });

  it("suppresses vibration for reduced motion or inactive documents", () => {
    const vibrate = vi.fn(() => true);
    const reduced = createHapticEngine({
      vibrate,
      reducedMotion: () => true,
      activeDocument: () => true,
    });
    expect(reduced.play("purchase:serve")).toBe(false);

    const hidden = createHapticEngine({
      vibrate,
      reducedMotion: () => false,
      activeDocument: () => false,
    });
    expect(hidden.play("storm:thunder")).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("silently tolerates unsupported or failing vibration adapters", () => {
    const unsupported = createHapticEngine({
      vibrate: () => false,
      reducedMotion: () => false,
      activeDocument: () => true,
    });
    expect(unsupported.play("purchase:drink")).toBe(false);

    const failing = createHapticEngine({
      vibrate: () => {
        throw new Error("unsupported");
      },
      reducedMotion: () => false,
      activeDocument: () => true,
    });
    expect(failing.play("purchase:drink")).toBe(false);
  });
});
