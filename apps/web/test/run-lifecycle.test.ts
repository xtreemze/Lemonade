import { describe, expect, it } from "vitest";

import {
  isLegalRunLifecycleState,
  restoreRunLifecycle,
  transitionRunLifecycle,
  type RunLifecycleEvent,
  type RunLifecycleState,
} from "../src/run-lifecycle.js";

const sequence = (
  initial: RunLifecycleState,
  events: readonly RunLifecycleEvent[],
): RunLifecycleState =>
  events.reduce((current, event) => {
    const transition = transitionRunLifecycle(current, event);
    expect(transition.accepted).toBe(true);
    return transition.state;
  }, initial);

describe("run lifecycle", () => {
  it("restores deciding runs into forecast and reports into report presentation", () => {
    expect(restoreRunLifecycle("deciding")).toEqual({
      runPhase: "deciding",
      presentation: "forecast",
    });
    expect(restoreRunLifecycle("report")).toEqual({
      runPhase: "report",
      presentation: "report",
    });
  });

  it("accepts the canonical daily presentation sequence", () => {
    const finalState = sequence(restoreRunLifecycle("deciding"), [
      { type: "forecast-completed" },
      { type: "sale-submitted" },
      { type: "simulation-completed" },
      { type: "history-requested" },
      { type: "next-day-started" },
    ]);

    expect(finalState).toEqual({
      runPhase: "deciding",
      presentation: "forecast",
    });
  });

  it("emits semantic effects rather than performing presentation work", () => {
    const planning = transitionRunLifecycle(restoreRunLifecycle("deciding"), {
      type: "forecast-completed",
    }).state;
    const submitted = transitionRunLifecycle(planning, { type: "sale-submitted" });

    expect(submitted).toEqual({
      state: {
        runPhase: "report",
        presentation: "simulation",
      },
      accepted: true,
      effects: ["simulate-day", "persist-report", "start-simulation-presentation"],
    });
  });

  it("rejects duplicate and out-of-order events without changing state", () => {
    const forecast = restoreRunLifecycle("deciding");
    const rejected = transitionRunLifecycle(forecast, { type: "sale-submitted" });

    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(forecast);
    expect(rejected.effects).toEqual([]);

    const planning = transitionRunLifecycle(forecast, {
      type: "forecast-completed",
    }).state;
    const duplicate = transitionRunLifecycle(planning, {
      type: "forecast-completed",
    });

    expect(duplicate.accepted).toBe(false);
    expect(duplicate.state).toBe(planning);
  });

  it("defines only legal persisted-phase and presentation-phase combinations", () => {
    const candidates: readonly RunLifecycleState[] = [
      { runPhase: "deciding", presentation: "forecast" },
      { runPhase: "deciding", presentation: "planning" },
      { runPhase: "report", presentation: "simulation" },
      { runPhase: "report", presentation: "report" },
      { runPhase: "report", presentation: "history" },
    ];

    for (const candidate of candidates) {
      expect(isLegalRunLifecycleState(candidate)).toBe(true);
    }

    expect(
      isLegalRunLifecycleState({ runPhase: "deciding", presentation: "report" }),
    ).toBe(false);
    expect(
      isLegalRunLifecycleState({ runPhase: "report", presentation: "forecast" }),
    ).toBe(false);
  });

  it("never accepts a transition from an impossible state", () => {
    const impossible: RunLifecycleState = {
      runPhase: "deciding",
      presentation: "simulation",
    };

    const transition = transitionRunLifecycle(impossible, {
      type: "simulation-completed",
    });

    expect(transition.accepted).toBe(false);
    expect(transition.state).toBe(impossible);
    expect(transition.effects).toEqual([]);
  });

  it("is deterministic for the same state and event", () => {
    const current: RunLifecycleState = {
      runPhase: "report",
      presentation: "report",
    };
    const event = { type: "history-requested" } as const;

    expect(transitionRunLifecycle(current, event)).toEqual(
      transitionRunLifecycle(current, event),
    );
  });
});
