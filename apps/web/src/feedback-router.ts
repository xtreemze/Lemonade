export type SemanticFeedbackKind =
  | "forecast-started"
  | "day-submitted"
  | "day-profit"
  | "day-loss"
  | "progression-unlocked"
  | "purchase-served"
  | "purchase-payment"
  | "purchase-drink"
  | "thunder"
  | "gust"
  | "birdsong";

export type SemanticFeedbackEvent = Readonly<{
  id: string;
  kind: SemanticFeedbackKind;
  atMs: number;
}>;

export type FeedbackTransport = Readonly<{
  deliver(event: SemanticFeedbackEvent): void;
  accepts?(event: SemanticFeedbackEvent): boolean;
  cancel?(): void;
}>;

export type FeedbackRouterOptions = Readonly<{
  audio?: FeedbackTransport;
  haptic?: FeedbackTransport;
  accessibility?: FeedbackTransport;
}>;

export type FeedbackRouter = Readonly<{
  route(events: readonly SemanticFeedbackEvent[]): void;
  setVisible(visible: boolean): void;
  setAudioMuted(muted: boolean): void;
  setHapticsEnabled(enabled: boolean): void;
  dispose(): void;
}>;

const FEEDBACK_PRIORITY: Readonly<Record<SemanticFeedbackKind, number>> = Object.freeze({
  thunder: 50,
  "progression-unlocked": 40,
  "purchase-payment": 35,
  "purchase-served": 34,
  "purchase-drink": 33,
  "day-profit": 30,
  "day-loss": 30,
  "day-submitted": 25,
  "forecast-started": 20,
  gust: 10,
  birdsong: 0,
});

const safeAtMs = (value: number): number =>
  Math.max(0, Number.isFinite(value) ? value : 0);

export const compareSemanticFeedbackEvents = (
  left: SemanticFeedbackEvent,
  right: SemanticFeedbackEvent,
): number =>
  safeAtMs(left.atMs) - safeAtMs(right.atMs) ||
  FEEDBACK_PRIORITY[right.kind] - FEEDBACK_PRIORITY[left.kind] ||
  left.id.localeCompare(right.id);

const canDeliver = (
  transport: FeedbackTransport | undefined,
  event: SemanticFeedbackEvent,
): transport is FeedbackTransport =>
  transport !== undefined && (transport.accepts?.(event) ?? true);

export const createFeedbackRouter = (
  options: FeedbackRouterOptions = {},
): FeedbackRouter => {
  const consumed = new Set<string>();
  let visible = true;
  let audioMuted = false;
  let hapticsEnabled = true;
  let disposed = false;

  const cancelTransientOutput = (): void => {
    options.audio?.cancel?.();
    options.haptic?.cancel?.();
  };

  const routeTo = (
    transport: FeedbackTransport | undefined,
    event: SemanticFeedbackEvent,
  ): void => {
    if (canDeliver(transport, event)) transport.deliver(event);
  };

  return Object.freeze({
    route(events): void {
      if (disposed) return;

      const ordered = [...events].sort(compareSemanticFeedbackEvents);
      for (const event of ordered) {
        if (consumed.has(event.id)) continue;
        consumed.add(event.id);

        if (!visible) continue;

        if (!audioMuted) routeTo(options.audio, event);
        if (hapticsEnabled) routeTo(options.haptic, event);
        routeTo(options.accessibility, event);
      }
    },

    setVisible(nextVisible): void {
      if (disposed || visible === nextVisible) return;
      visible = nextVisible;
      if (!visible) cancelTransientOutput();
    },

    setAudioMuted(muted): void {
      if (disposed || audioMuted === muted) return;
      audioMuted = muted;
      if (audioMuted) options.audio?.cancel?.();
    },

    setHapticsEnabled(enabled): void {
      if (disposed || hapticsEnabled === enabled) return;
      hapticsEnabled = enabled;
      if (!hapticsEnabled) options.haptic?.cancel?.();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      options.audio?.cancel?.();
      options.haptic?.cancel?.();
      options.accessibility?.cancel?.();
      consumed.clear();
    },
  });
};
