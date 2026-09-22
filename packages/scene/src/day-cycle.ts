export type DayCycleWeather =
  | "sunny"
  | "cloudy"
  | "hot-and-dry"
  | "thunderstorm";

export type DayCycleState = Readonly<{
  progress: number;
  skyColor: number;
  sunColor: number;
  hemisphereIntensity: number;
  sunlightIntensity: number;
  sunPosition: readonly [number, number, number];
}>;

type DayKeyframe = Readonly<{
  at: number;
  sky: number;
  sun: number;
  hemisphere: number;
  sunlight: number;
  position: readonly [number, number, number];
}>;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const colorChannels = (color: number): readonly [number, number, number] =>
  [color >> 16 & 0xff, color >> 8 & 0xff, color & 0xff] as const;

const mixColor = (from: number, to: number, progress: number): number => {
  const t = clamp01(progress);
  const [fr, fg, fb] = colorChannels(from);
  const [tr, tg, tb] = colorChannels(to);
  const r = Math.round(fr + (tr - fr) * t);
  const g = Math.round(fg + (tg - fg) * t);
  const b = Math.round(fb + (tb - fb) * t);
  return r << 16 | g << 8 | b;
};

const lerp = (from: number, to: number, progress: number): number =>
  from + (to - from) * clamp01(progress);

const weatherSky = (
  weather: DayCycleWeather,
): readonly [number, number, number, number] => {
  switch (weather) {
    case "sunny":
      return [0x91bfd0, 0x79cbe0, 0xe5a46d, 0x17243a];
    case "cloudy":
      return [0x899ca7, 0xaabcc3, 0x998c8b, 0x202936];
    case "hot-and-dry":
      return [0xa8b9bd, 0x9fc9d3, 0xe2a064, 0x1c2937];
    case "thunderstorm":
      return [0x485866, 0x536471, 0x434955, 0x151b25];
  }
};

const keyframesFor = (weather: DayCycleWeather): readonly DayKeyframe[] => {
  const [morning, midday, sunset, night] = weatherSky(weather);
  const stormFactor = weather === "thunderstorm" ? 0.68 : weather === "cloudy" ? 0.86 : 1;
  return Object.freeze([
    Object.freeze({
      at: 0,
      sky: morning,
      sun: 0xffd9a1,
      hemisphere: 1.35 * stormFactor,
      sunlight: 1.05 * stormFactor,
      position: [-8, 7, 5] as const,
    }),
    Object.freeze({
      at: 0.42,
      sky: midday,
      sun: 0xfff0c9,
      hemisphere: 1.9 * stormFactor,
      sunlight: 1.8 * stormFactor,
      position: [-1, 12, 4] as const,
    }),
    Object.freeze({
      at: 0.76,
      sky: sunset,
      sun: 0xffb66f,
      hemisphere: 1.25 * stormFactor,
      sunlight: 0.92 * stormFactor,
      position: [8, 4.4, 3] as const,
    }),
    Object.freeze({
      at: 1,
      sky: night,
      sun: 0x8da2c6,
      hemisphere: 0.52,
      sunlight: weather === "thunderstorm" ? 0.05 : 0.11,
      position: [12, -2.5, 2] as const,
    }),
  ]);
};

const interpolate = (
  from: DayKeyframe,
  to: DayKeyframe,
  progress: number,
): DayCycleState => {
  const span = Math.max(0.0001, to.at - from.at);
  const t = clamp01((progress - from.at) / span);
  return Object.freeze({
    progress,
    skyColor: mixColor(from.sky, to.sky, t),
    sunColor: mixColor(from.sun, to.sun, t),
    hemisphereIntensity: lerp(from.hemisphere, to.hemisphere, t),
    sunlightIntensity: lerp(from.sunlight, to.sunlight, t),
    sunPosition: [
      lerp(from.position[0], to.position[0], t),
      lerp(from.position[1], to.position[1], t),
      lerp(from.position[2], to.position[2], t),
    ] as const,
  });
};

export const dayCycleAt = (
  elapsedMs: number,
  durationMs: number,
  weather: DayCycleWeather,
): DayCycleState => {
  const duration = Math.max(1, Number.isFinite(durationMs) ? durationMs : 1);
  const elapsed = Math.min(
    duration,
    Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0),
  );
  const progress = elapsed / duration;
  const keyframes = keyframesFor(weather);

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const from = keyframes[index];
    const to = keyframes[index + 1];
    if (from !== undefined && to !== undefined && progress <= to.at) {
      return interpolate(from, to, progress);
    }
  }

  const finalFrame = keyframes.at(-1);
  if (finalFrame === undefined) throw new Error("day-cycle keyframes missing");
  return interpolate(finalFrame, finalFrame, 1);
};


export type AtmospherePhase = "idle" | "simulation" | "forecast";

export type AtmosphereTarget = Readonly<{
  setSky(color: number): void;
  setHemisphere(intensity: number): void;
  setSun(
    color: number,
    intensity: number,
    position: readonly [number, number, number],
  ): void;
  setProgress(progress: number | null): void;
}>;

export type AtmosphereController = Readonly<{
  update(
    phase: AtmospherePhase,
    weather: DayCycleWeather,
    elapsedMs: number,
    durationMs: number,
  ): void;
}>;

const staticSky = (
  weather: DayCycleWeather,
  earlyMorning: boolean,
): number => {
  const [morning, midday] = weatherSky(weather);
  return earlyMorning ? morning : midday;
};

export const createAtmosphereController = (
  target: AtmosphereTarget,
): AtmosphereController =>
  Object.freeze({
    update(phase, weather, elapsedMs, durationMs): void {
      if (phase === "simulation") {
        const cycle = dayCycleAt(elapsedMs, durationMs, weather);
        target.setSky(cycle.skyColor);
        target.setHemisphere(cycle.hemisphereIntensity);
        target.setSun(
          cycle.sunColor,
          cycle.sunlightIntensity,
          cycle.sunPosition,
        );
        target.setProgress(cycle.progress);
        return;
      }

      const forecast = phase === "forecast";
      target.setSky(staticSky(weather, forecast));
      target.setHemisphere(forecast ? 1.35 : 1.9);
      target.setSun(
        0xfff0c9,
        forecast ? 1.05 : 1.8,
        [-5, 10, 7],
      );
      target.setProgress(null);
    },
  });
