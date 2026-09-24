export type EnvironmentWeatherKind = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";

export type EnvironmentPresentationPhase = "idle" | "forecast" | "simulation";

export type EnvironmentOccurrenceKind = "thunder" | "gust" | "birdsong";

export type EnvironmentOccurrence = Readonly<{
  id: string;
  kind: EnvironmentOccurrenceKind;
  atMs: number;
}>;

export type EnvironmentPresentationFrame = Readonly<{
  businessDayProgress: number;
  lightningFlash: number;
  windIntensity: number;
  precipitation: number;
  motionScale: number;
}>;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const safeDuration = (durationMs: number): number =>
  Math.max(1, Number.isFinite(durationMs) ? durationMs : 1);

const safeElapsed = (elapsedMs: number, durationMs: number): number =>
  Math.min(safeDuration(durationMs), Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0));

export const environmentBusinessDayProgressAt = (
  phase: EnvironmentPresentationPhase,
  elapsedMs: number,
  durationMs: number,
): number => {
  if (phase === "forecast") {
    return 0.04;
  }
  if (phase !== "simulation") {
    return 0.56;
  }
  return 0.06 + clamp01(safeElapsed(elapsedMs, durationMs) / safeDuration(durationMs)) * 0.9;
};

const flashPulse = (progress: number, center: number, width: number): number => {
  const distance = Math.abs(progress - center);
  if (distance >= width) {
    return 0;
  }
  const normalized = 1 - distance / width;
  return normalized * normalized;
};

export const environmentLightningFlashAt = (
  weather: EnvironmentWeatherKind,
  phase: EnvironmentPresentationPhase,
  elapsedMs: number,
  durationMs: number,
): number => {
  if (weather !== "thunderstorm" || phase === "idle") {
    return 0;
  }
  const progress = safeElapsed(elapsedMs, durationMs) / safeDuration(durationMs);
  return Math.max(
    flashPulse(progress, 0.2, 0.022),
    flashPulse(progress, 0.235, 0.012) * 0.62,
    flashPulse(progress, 0.57, 0.026),
    flashPulse(progress, 0.78, 0.018),
    flashPulse(progress, 0.805, 0.01) * 0.48,
  );
};

const WEATHER_WIND: Readonly<Record<EnvironmentWeatherKind, number>> = Object.freeze({
  sunny: 0.18,
  cloudy: 0.42,
  "hot-and-dry": 0.34,
  thunderstorm: 1,
});

const occurrence = (
  phase: EnvironmentPresentationPhase,
  weather: EnvironmentWeatherKind,
  kind: EnvironmentOccurrenceKind,
  index: number,
  atMs: number,
): EnvironmentOccurrence =>
  Object.freeze({
    id: `${phase}:${weather}:${kind}:${String(index)}`,
    kind,
    atMs,
  });

const atProgress = (durationMs: number, progress: number): number =>
  Math.round(safeDuration(durationMs) * progress);

export const environmentOccurrenceSchedule = (
  weather: EnvironmentWeatherKind,
  phase: EnvironmentPresentationPhase,
  durationMs: number,
): readonly EnvironmentOccurrence[] => {
  if (phase === "idle") {
    return Object.freeze([]);
  }

  const result: EnvironmentOccurrence[] = [];

  if (weather === "thunderstorm") {
    [0.2, 0.57, 0.78].forEach((progress, index) => {
      result.push(occurrence(phase, weather, "thunder", index, atProgress(durationMs, progress)));
    });
    [0.34, 0.72].forEach((progress, index) => {
      result.push(occurrence(phase, weather, "gust", index, atProgress(durationMs, progress)));
    });
  }

  if (weather === "sunny" && phase === "simulation") {
    [0.14, 0.43, 0.72].forEach((progress, index) => {
      result.push(occurrence(phase, weather, "birdsong", index, atProgress(durationMs, progress)));
    });
  }

  result.sort((left, right) => left.atMs - right.atMs || left.id.localeCompare(right.id));
  return Object.freeze(result);
};

export const environmentOccurrencesBetween = (
  weather: EnvironmentWeatherKind,
  phase: EnvironmentPresentationPhase,
  durationMs: number,
  fromExclusiveMs: number,
  toInclusiveMs: number,
): readonly EnvironmentOccurrence[] => {
  const from = Math.max(0, Number.isFinite(fromExclusiveMs) ? fromExclusiveMs : 0);
  const to = Math.max(from, Number.isFinite(toInclusiveMs) ? toInclusiveMs : from);
  return Object.freeze(
    environmentOccurrenceSchedule(weather, phase, durationMs).filter(
      (candidate) => candidate.atMs > from && candidate.atMs <= to,
    ),
  );
};

export const environmentPresentationFrameAt = (
  weather: EnvironmentWeatherKind,
  phase: EnvironmentPresentationPhase,
  elapsedMs: number,
  durationMs: number,
  reducedMotion: boolean,
): EnvironmentPresentationFrame => {
  const businessDayProgress = environmentBusinessDayProgressAt(phase, elapsedMs, durationMs);
  const activePresentation = phase === "idle" ? 0 : 1;
  const windPulse =
    phase === "idle" ? 0 : 0.88 + Math.sin(safeElapsed(elapsedMs, durationMs) * 0.000_63) * 0.12;

  return Object.freeze({
    businessDayProgress,
    lightningFlash: environmentLightningFlashAt(weather, phase, elapsedMs, durationMs),
    windIntensity: WEATHER_WIND[weather] * windPulse * activePresentation,
    precipitation: weather === "thunderstorm" && phase !== "idle" ? 1 : 0,
    motionScale: reducedMotion ? 0 : 1,
  });
};
