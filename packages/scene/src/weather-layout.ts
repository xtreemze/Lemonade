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
    position: [-12, 8, -64] as const,
    scale: 7.8,
  }),
});
