export type PersistedRunPhaseKind = "deciding" | "report";

export type PresentationPhase = "forecast" | "planning" | "simulation" | "report" | "history";

export type RunLifecycleState = Readonly<{
  runPhase: PersistedRunPhaseKind;
  presentation: PresentationPhase;
}>;

export type RunLifecycleEvent =
  | Readonly<{ type: "forecast-completed" }>
  | Readonly<{ type: "sale-submitted" }>
  | Readonly<{ type: "simulation-completed" }>
  | Readonly<{ type: "history-requested" }>
  | Readonly<{ type: "next-day-started" }>;

export type RunLifecycleEffect =
  | "show-planning"
  | "simulate-day"
  | "persist-report"
  | "start-simulation-presentation"
  | "show-report"
  | "show-history"
  | "advance-day"
  | "persist-deciding"
  | "start-forecast";

export type RunLifecycleTransition = Readonly<{
  state: RunLifecycleState;
  accepted: boolean;
  effects: readonly RunLifecycleEffect[];
}>;

const state = (
  runPhase: PersistedRunPhaseKind,
  presentation: PresentationPhase,
): RunLifecycleState => Object.freeze({ runPhase, presentation });

const effects = (...values: RunLifecycleEffect[]): readonly RunLifecycleEffect[] =>
  Object.freeze(values);

const accepted = (
  nextState: RunLifecycleState,
  ...nextEffects: RunLifecycleEffect[]
): RunLifecycleTransition =>
  Object.freeze({
    state: nextState,
    accepted: true,
    effects: effects(...nextEffects),
  });

const rejected = (current: RunLifecycleState): RunLifecycleTransition =>
  Object.freeze({
    state: current,
    accepted: false,
    effects: effects(),
  });

export const restoreRunLifecycle = (phase: PersistedRunPhaseKind): RunLifecycleState =>
  phase === "report" ? state("report", "report") : state("deciding", "forecast");

export const isLegalRunLifecycleState = (candidate: RunLifecycleState): boolean => {
  switch (candidate.runPhase) {
    case "deciding":
      return candidate.presentation === "forecast" || candidate.presentation === "planning";
    case "report":
      return (
        candidate.presentation === "simulation" ||
        candidate.presentation === "report" ||
        candidate.presentation === "history"
      );
  }
};

export const transitionRunLifecycle = (
  current: RunLifecycleState,
  event: RunLifecycleEvent,
): RunLifecycleTransition => {
  if (!isLegalRunLifecycleState(current)) {
    return rejected(current);
  }

  switch (event.type) {
    case "forecast-completed":
      return current.runPhase === "deciding" && current.presentation === "forecast"
        ? accepted(state("deciding", "planning"), "show-planning")
        : rejected(current);

    case "sale-submitted":
      return current.runPhase === "deciding" && current.presentation === "planning"
        ? accepted(
            state("report", "simulation"),
            "simulate-day",
            "persist-report",
            "start-simulation-presentation",
          )
        : rejected(current);

    case "simulation-completed":
      return current.runPhase === "report" && current.presentation === "simulation"
        ? accepted(state("report", "report"), "show-report")
        : rejected(current);

    case "history-requested":
      return current.runPhase === "report" && current.presentation === "report"
        ? accepted(state("report", "history"), "show-history")
        : rejected(current);

    case "next-day-started":
      return current.runPhase === "report" && current.presentation === "history"
        ? accepted(
            state("deciding", "forecast"),
            "advance-day",
            "persist-deciding",
            "start-forecast",
          )
        : rejected(current);
  }
};
