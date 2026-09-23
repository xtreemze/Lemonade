export type MobilityClockLifecycle = "active" | "completed";

export type MobilityClockState = Readonly<{
  distance: number;
  velocity: number;
  routeLength: number;
  maxAcceleration: number;
  lifecycle: MobilityClockLifecycle;
}>;

export type MobilityClockMotion = "move" | "yield" | "dwell";

export type MobilityClockStep = Readonly<{
  deltaMs: number;
  desiredSpeed: number;
  motion?: MobilityClockMotion;
}>;

const finiteNonNegative = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

const exactVelocityStep = (
  velocity: number,
  targetVelocity: number,
  maxAcceleration: number,
  deltaSeconds: number,
): Readonly<{ velocity: number; distance: number }> => {
  if (deltaSeconds <= 0) {
    return Object.freeze({ velocity, distance: 0 });
  }
  if (maxAcceleration <= 0 || velocity === targetVelocity) {
    return Object.freeze({
      velocity,
      distance: velocity * deltaSeconds,
    });
  }

  const deltaVelocity = targetVelocity - velocity;
  const direction = Math.sign(deltaVelocity);
  const timeToTarget = Math.abs(deltaVelocity) / maxAcceleration;

  if (timeToTarget >= deltaSeconds) {
    const nextVelocity =
      velocity + direction * maxAcceleration * deltaSeconds;
    return Object.freeze({
      velocity: nextVelocity,
      distance: (velocity + nextVelocity) * 0.5 * deltaSeconds,
    });
  }

  const acceleratedDistance =
    (velocity + targetVelocity) * 0.5 * timeToTarget;
  const cruiseDistance =
    targetVelocity * (deltaSeconds - timeToTarget);
  return Object.freeze({
    velocity: targetVelocity,
    distance: acceleratedDistance + cruiseDistance,
  });
};

export const createMobilityClock = (input: {
  routeLength: number;
  maxAcceleration: number;
  initialDistance?: number;
  initialVelocity?: number;
}): MobilityClockState => {
  const routeLength = finiteNonNegative(input.routeLength);
  const distance = Math.min(
    routeLength,
    finiteNonNegative(input.initialDistance ?? 0),
  );
  const completed = distance >= routeLength;

  return Object.freeze({
    distance,
    velocity: completed
      ? 0
      : finiteNonNegative(input.initialVelocity ?? 0),
    routeLength,
    maxAcceleration: finiteNonNegative(input.maxAcceleration),
    lifecycle: completed ? "completed" : "active",
  });
};

export const advanceMobilityClock = (
  state: MobilityClockState,
  step: MobilityClockStep,
): MobilityClockState => {
  if (state.lifecycle === "completed") return state;

  const deltaSeconds = finiteNonNegative(step.deltaMs) / 1_000;
  const motion = step.motion ?? "move";

  if (motion === "dwell") {
    return Object.freeze({
      ...state,
      velocity: 0,
    });
  }

  const targetVelocity =
    motion === "yield" ? 0 : finiteNonNegative(step.desiredSpeed);
  const advanced = exactVelocityStep(
    finiteNonNegative(state.velocity),
    targetVelocity,
    finiteNonNegative(state.maxAcceleration),
    deltaSeconds,
  );
  const distance = Math.min(
    state.routeLength,
    state.distance + Math.max(0, advanced.distance),
  );
  const completed = distance >= state.routeLength;

  return Object.freeze({
    ...state,
    distance,
    velocity: completed ? 0 : advanced.velocity,
    lifecycle: completed ? "completed" : "active",
  });
};
