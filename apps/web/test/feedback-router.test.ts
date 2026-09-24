import { describe, expect, it, vi } from "vitest";

import {
  compareSemanticFeedbackEvents,
  createFeedbackRouter,
  type FeedbackTransport,
  type SemanticFeedbackEvent,
} from "../src/feedback-router.js";

const event = (id: string, kind: SemanticFeedbackEvent["kind"], atMs = 0): SemanticFeedbackEvent =>
  Object.freeze({ id, kind, atMs });

const transport = (
  accepts?: (candidate: SemanticFeedbackEvent) => boolean,
): Readonly<{
  adapter: FeedbackTransport;
  delivered: SemanticFeedbackEvent[];
  cancel: ReturnType<typeof vi.fn>;
}> => {
  const delivered: SemanticFeedbackEvent[] = [];
  const cancel = vi.fn();
  return Object.freeze({
    delivered,
    cancel,
    adapter: Object.freeze({
      deliver(candidate: SemanticFeedbackEvent): void {
        delivered.push(candidate);
      },
      ...(accepts === undefined ? {} : { accepts }),
      cancel,
    }),
  });
};

describe("semantic feedback router", () => {
  it("delivers one semantic occurrence at most once per active transport", () => {
    const audio = transport();
    const haptic = transport();
    const accessibility = transport();
    const router = createFeedbackRouter({
      audio: audio.adapter,
      haptic: haptic.adapter,
      accessibility: accessibility.adapter,
    });
    const served = event("purchase:1:served", "purchase-served", 120);

    router.route([served]);
    router.route([served]);

    expect(audio.delivered).toEqual([served]);
    expect(haptic.delivered).toEqual([served]);
    expect(accessibility.delivered).toEqual([served]);
  });

  it("keeps audio mute independent from haptic delivery", () => {
    const audio = transport();
    const haptic = transport();
    const router = createFeedbackRouter({
      audio: audio.adapter,
      haptic: haptic.adapter,
    });

    router.setAudioMuted(true);
    router.route([event("storm:1", "thunder", 100)]);

    expect(audio.delivered).toEqual([]);
    expect(audio.cancel).toHaveBeenCalledTimes(1);
    expect(haptic.delivered.map((candidate) => candidate.id)).toEqual(["storm:1"]);
  });

  it("keeps haptic preference independent from audio delivery", () => {
    const audio = transport();
    const haptic = transport();
    const router = createFeedbackRouter({
      audio: audio.adapter,
      haptic: haptic.adapter,
    });

    router.setHapticsEnabled(false);
    router.route([event("sale:1", "purchase-payment", 200)]);

    expect(haptic.delivered).toEqual([]);
    expect(haptic.cancel).toHaveBeenCalledTimes(1);
    expect(audio.delivered.map((candidate) => candidate.id)).toEqual(["sale:1"]);
  });

  it("consumes hidden transient occurrences without replaying them on resume", () => {
    const audio = transport();
    const haptic = transport();
    const router = createFeedbackRouter({
      audio: audio.adapter,
      haptic: haptic.adapter,
    });
    const gust = event("storm:gust:1", "gust", 300);

    router.setVisible(false);
    router.route([gust]);
    router.setVisible(true);
    router.route([gust]);

    expect(audio.cancel).toHaveBeenCalledTimes(1);
    expect(haptic.cancel).toHaveBeenCalledTimes(1);
    expect(audio.delivered).toEqual([]);
    expect(haptic.delivered).toEqual([]);
  });

  it("lets transports explicitly reject unsupported semantic events", () => {
    const haptic = transport(
      (candidate) => candidate.kind === "thunder" || candidate.kind === "gust",
    );
    const router = createFeedbackRouter({ haptic: haptic.adapter });

    router.route([
      event("weather:bird:1", "birdsong", 100),
      event("weather:thunder:1", "thunder", 200),
    ]);

    expect(haptic.delivered.map((candidate) => candidate.kind)).toEqual(["thunder"]);
  });

  it("orders equal-time occurrences by explicit priority and stable id", () => {
    const accessibility = transport();
    const router = createFeedbackRouter({ accessibility: accessibility.adapter });

    router.route([
      event("z-bird", "birdsong", 500),
      event("b-purchase", "purchase-served", 500),
      event("a-thunder", "thunder", 500),
      event("a-purchase", "purchase-served", 500),
    ]);

    expect(accessibility.delivered.map((candidate) => candidate.id)).toEqual([
      "a-thunder",
      "a-purchase",
      "b-purchase",
      "z-bird",
    ]);
  });

  it("uses timestamp before priority for deterministic chronological delivery", () => {
    expect(
      [event("late-thunder", "thunder", 900), event("early-bird", "birdsong", 100)]
        .sort(compareSemanticFeedbackEvents)
        .map((candidate) => candidate.id),
    ).toEqual(["early-bird", "late-thunder"]);
  });

  it("makes all future transport calls inert after disposal", () => {
    const audio = transport();
    const haptic = transport();
    const accessibility = transport();
    const router = createFeedbackRouter({
      audio: audio.adapter,
      haptic: haptic.adapter,
      accessibility: accessibility.adapter,
    });

    router.dispose();
    router.route([event("after-dispose", "day-profit")]);

    expect(audio.delivered).toEqual([]);
    expect(haptic.delivered).toEqual([]);
    expect(accessibility.delivered).toEqual([]);
    expect(audio.cancel).toHaveBeenCalledTimes(1);
    expect(haptic.cancel).toHaveBeenCalledTimes(1);
    expect(accessibility.cancel).toHaveBeenCalledTimes(1);
  });
});
