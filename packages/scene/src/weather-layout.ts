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
    position: [-2.1, 0.72, 4.25] as const,
    scale: 0.3,
    driftPhase: 0.25,
  }),
  Object.freeze({
    position: [0.35, 0.95, 5.65] as const,
    scale: 0.24,
    driftPhase: 1.7,
  }),
  Object.freeze({
    position: [2.15, 0.56, 3.75] as const,
    scale: 0.34,
    driftPhase: 3.05,
  }),
] as const);
