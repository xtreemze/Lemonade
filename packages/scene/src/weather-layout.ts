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

export const PARTLY_CLOUD_TOWN_LAYOUT: readonly TownCloudLayout[] = Object.freeze([
  Object.freeze({
    position: [-3.8, 1.15, -0.9] as const,
    scale: 0.78,
    driftPhase: 0.4,
  }),
  Object.freeze({
    position: [0.2, 1.55, 1.3] as const,
    scale: 0.84,
    driftPhase: 1.8,
  }),
  Object.freeze({
    position: [3.7, 0.95, -0.4] as const,
    scale: 0.76,
    driftPhase: 3.2,
  }),
] as const);

export const CLOUDY_TOWN_CLOUD_LAYOUT: readonly TownCloudLayout[] = Object.freeze([
  Object.freeze({
    position: [-4.8, 0.7, -1.8] as const,
    scale: 0.92,
    driftPhase: 0.25,
  }),
  Object.freeze({
    position: [-2.5, 1.2, 1] as const,
    scale: 1.02,
    driftPhase: 0.92,
  }),
  Object.freeze({
    position: [0.1, 0.45, -0.4] as const,
    scale: 0.96,
    driftPhase: 1.7,
  }),
  Object.freeze({
    position: [2.6, 1.05, 1.6] as const,
    scale: 1.05,
    driftPhase: 2.38,
  }),
  Object.freeze({
    position: [4.9, 0.65, -1.1] as const,
    scale: 0.98,
    driftPhase: 3.05,
  }),
  Object.freeze({
    position: [1.2, 1.55, -2.2] as const,
    scale: 0.9,
    driftPhase: 4.12,
  }),
] as const);

export const THUNDERSTORM_TOWN_CLOUD_LAYOUT: readonly TownCloudLayout[] =
  Object.freeze([
    Object.freeze({
      position: [-4.9, 1.1, -1.4] as const,
      scale: 1.1,
      driftPhase: 0,
    }),
    Object.freeze({
      position: [-2.4, 0.6, 1.4] as const,
      scale: 1,
      driftPhase: 0.9,
    }),
    Object.freeze({
      position: [0.1, 1.4, -0.3] as const,
      scale: 1.2,
      driftPhase: 1.8,
    }),
    Object.freeze({
      position: [2.6, 0.75, 1.7] as const,
      scale: 1.05,
      driftPhase: 2.7,
    }),
    Object.freeze({
      position: [4.7, 1.3, -1] as const,
      scale: 1.12,
      driftPhase: 3.6,
    }),
  ] as const);
