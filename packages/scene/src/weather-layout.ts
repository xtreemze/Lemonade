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
    position: [0, 15, -16.5] as const,
    scale: 3.2,
  }),
  "hot-and-dry": Object.freeze({
    position: [17, 4, -97] as const,
    scale: 11,
  }),
  thunderstorm: Object.freeze({
    position: [-3, 15.5, -18.5] as const,
    scale: 3.2,
  }),
});

export type CloudLayerLayout = Readonly<{
  position: readonly [number, number, number];
  scale: number;
}>;

export const HOT_DRY_CLOUD_LAYOUT: CloudLayerLayout = Object.freeze({
  position: [-1.1, 1, 7.23] as const,
  scale: 0.29,
});

export type TownCloudLayout = Readonly<{
  position: readonly [number, number, number];
  scale: number;
  driftPhase: number;
}>;

export const CLOUDY_TOWN_CLOUD_LAYOUT: readonly TownCloudLayout[] = Object.freeze([
  Object.freeze({
    position: [-3.5, 0.35, -0.25] as const,
    scale: 1,
    driftPhase: 0.25,
  }),
  Object.freeze({
    position: [-2.15, 0.55, -1.15] as const,
    scale: 0.96,
    driftPhase: 0.92,
  }),
  Object.freeze({
    position: [-0.75, 0.4, -0.7] as const,
    scale: 1.04,
    driftPhase: 1.7,
  }),
  Object.freeze({
    position: [0.85, 0.65, -1.55] as const,
    scale: 0.98,
    driftPhase: 2.38,
  }),
  Object.freeze({
    position: [2.25, 0.3, -0.45] as const,
    scale: 1.06,
    driftPhase: 3.05,
  }),
  Object.freeze({
    position: [3.55, 0.5, -1.2] as const,
    scale: 0.94,
    driftPhase: 4.12,
  }),
] as const);
