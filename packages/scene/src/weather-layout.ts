export type WeatherBackdropKind =
  | "sunny"
  | "cloudy"
  | "hot-and-dry"
  | "thunderstorm";

export type WeatherBackdropLayout = Readonly<{
  position: readonly [number, number, number];
  scale: number;
}>;

export const WEATHER_BACKDROP_LAYOUT: Readonly<
  Record<WeatherBackdropKind, WeatherBackdropLayout>
> = Object.freeze({
  sunny: Object.freeze({
    position: [24, 3, -98] as const,
    scale: 12,
  }),
  cloudy: Object.freeze({
    position: [-20, 4, -96] as const,
    scale: 10.5,
  }),
  "hot-and-dry": Object.freeze({
    position: [17, 4, -97] as const,
    scale: 11,
  }),
  thunderstorm: Object.freeze({
    position: [-12, 6.2, -64] as const,
    scale: 7.8,
  }),
});


export type TownCloudLayout = Readonly<{
  position: readonly [number, number, number];
  scale: number;
  driftPhase: number;
}>;

export const CLOUDY_TOWN_CLOUD_LAYOUT: readonly TownCloudLayout[] = Object.freeze([
  Object.freeze({
    position: [-2.8, 0.82, 4.4] as const,
    scale: 0.3,
    driftPhase: 0.25,
  }),
  Object.freeze({
    position: [-1.35, 1.18, 5.95] as const,
    scale: 0.22,
    driftPhase: 0.92,
  }),
  Object.freeze({
    position: [0.35, 0.95, 5.65] as const,
    scale: 0.24,
    driftPhase: 1.7,
  }),
  Object.freeze({
    position: [1.55, 1.32, 6.45] as const,
    scale: 0.2,
    driftPhase: 2.38,
  }),
  Object.freeze({
    position: [2.65, 0.7, 4.05] as const,
    scale: 0.34,
    driftPhase: 3.05,
  }),
  Object.freeze({
    position: [3.8, 1.08, 5.35] as const,
    scale: 0.25,
    driftPhase: 4.12,
  }),
] as const);
