export type WeatherKind = "sunny" | "cloudy" | "hot-and-dry" | "thunderstorm";
export type WeatherAudioCue = `forecast:${WeatherKind}`;

export type AudioCue =
  | WeatherAudioCue
  | "day:submit"
  | "day:profit"
  | "day:loss"
  | "progression:unlock"
  | "purchase:serve"
  | "purchase:payment"
  | "purchase:drink"
  | "purchase:pour"
  | "purchase:ice-clink"
  | "storm:thunder"
  | "storm:gust"
  | "ambient:birdsong";

export type AudioEnvironmentFrame = Readonly<{
  windIntensity: number;
  precipitation: number;
}>;

export interface ProceduralAudioEngine {
  enable: () => Promise<boolean>;
  play: (cue: AudioCue) => void;
  setEnvironmentFrame: (frame: AudioEnvironmentFrame) => void;
  setMuted: (muted: boolean) => void;
  suspend: () => Promise<void>;
  resume: () => Promise<void>;
  dispose: () => Promise<void>;
}

export const WEATHER_FORECAST_DURATION_MS = 6000;

export const weatherCue = (weather: WeatherKind): WeatherAudioCue => `forecast:${weather}`;
