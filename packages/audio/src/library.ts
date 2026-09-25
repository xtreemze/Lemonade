import type { AudioCue } from "./contracts.js";

export type SoundLibraryCategory =
  | "forecast"
  | "gameplay"
  | "purchase"
  | "weather"
  | "ambient"
  | "neighborhood"
  | "customer";

export type SoundLibraryStatus = "available" | "missing";

export type SoundImplementation =
  | "historical-procedural"
  | "procedural-tonal"
  | "procedural-noise"
  | "procedural-hybrid";

export type ContinuousSoundId = "weather:rain" | "weather:wind-bed";

export type MissingSoundId =
  | "ambient:hot-insects"
  | "neighborhood:resident-footsteps"
  | "neighborhood:vehicle-engine"
  | "neighborhood:bicycle-passby"
  | "neighborhood:pet-walk"
  | "neighborhood:mailbox"
  | "neighborhood:gardening"
  | "neighborhood:sprinkler"
  | "neighborhood:door"
  | "neighborhood:window-activity"
  | "customer:price-reject"
  | "customer:stockout"
  | "purchase:pour"
  | "purchase:ice-clink";

export type SoundLibraryId = AudioCue | ContinuousSoundId | MissingSoundId;

export type SoundLibraryEntry = Readonly<{
  id: SoundLibraryId;
  label: string;
  category: SoundLibraryCategory;
  status: SoundLibraryStatus;
  implementation: SoundImplementation;
  triggerSource: string;
  description: string;
}>;

const available = (
  id: AudioCue | ContinuousSoundId,
  label: string,
  category: SoundLibraryCategory,
  implementation: SoundImplementation,
  triggerSource: string,
  description: string,
): SoundLibraryEntry =>
  Object.freeze({
    id,
    label,
    category,
    status: "available",
    implementation,
    triggerSource,
    description,
  });

const missing = (
  id: MissingSoundId,
  label: string,
  category: SoundLibraryCategory,
  implementation: SoundImplementation,
  triggerSource: string,
  description: string,
): SoundLibraryEntry =>
  Object.freeze({
    id,
    label,
    category,
    status: "missing",
    implementation,
    triggerSource,
    description,
  });

export const AVAILABLE_SOUND_LIBRARY: Readonly<Record<AudioCue, SoundLibraryEntry>> = Object.freeze(
  {
    "forecast:sunny": available(
      "forecast:sunny",
      "Sunny forecast motif",
      "forecast",
      "historical-procedural",
      "forecast lifecycle + sunny weather",
      "Apple II weather excerpt synthesized with square-wave tones.",
    ),
    "forecast:cloudy": available(
      "forecast:cloudy",
      "Cloudy forecast motif",
      "forecast",
      "historical-procedural",
      "forecast lifecycle + cloudy weather",
      "Apple II weather excerpt synthesized with square-wave tones.",
    ),
    "forecast:hot-and-dry": available(
      "forecast:hot-and-dry",
      "Hot and dry forecast motif",
      "forecast",
      "historical-procedural",
      "forecast lifecycle + hot-and-dry weather",
      "Apple II weather excerpt synthesized with square-wave tones.",
    ),
    "forecast:thunderstorm": available(
      "forecast:thunderstorm",
      "Thunderstorm forecast motif",
      "forecast",
      "historical-procedural",
      "forecast lifecycle + thunderstorm weather",
      "Apple II weather excerpt synthesized with square-wave tones.",
    ),
    "day:submit": available(
      "day:submit",
      "Open stand",
      "gameplay",
      "procedural-tonal",
      "planning submit",
      "Short ascending cue when the day is submitted.",
    ),
    "day:profit": available(
      "day:profit",
      "Profit result",
      "gameplay",
      "procedural-tonal",
      "DayResolution.entry.net >= 0",
      "Ascending result cue for a non-negative day.",
    ),
    "day:loss": available(
      "day:loss",
      "Loss result",
      "gameplay",
      "procedural-tonal",
      "DayResolution.entry.net < 0",
      "Descending result cue for a negative day.",
    ),
    "progression:unlock": available(
      "progression:unlock",
      "Progression unlock",
      "gameplay",
      "procedural-tonal",
      "tier or operating-scale increase",
      "Short fanfare for newly unlocked progression.",
    ),
    "purchase:serve": available(
      "purchase:serve",
      "Serve lemonade",
      "purchase",
      "procedural-tonal",
      "purchase feedback schedule",
      "Bright swept cue synchronized to the serve beat.",
    ),
    "purchase:payment": available(
      "purchase:payment",
      "Payment",
      "purchase",
      "procedural-tonal",
      "purchase feedback schedule",
      "High-register payment confirmation cue.",
    ),
    "purchase:drink": available(
      "purchase:drink",
      "Drink",
      "purchase",
      "procedural-tonal",
      "purchase feedback schedule",
      "Short upward sweeps synchronized to drinking.",
    ),
    "storm:thunder": available(
      "storm:thunder",
      "Thunder",
      "weather",
      "procedural-tonal",
      "thunder environment occurrence",
      "Low descending layered sweeps used for thunder.",
    ),
    "storm:gust": available(
      "storm:gust",
      "Wind gust",
      "weather",
      "procedural-tonal",
      "gust environment occurrence",
      "Low-gain descending sweeps used for discrete gusts.",
    ),
    "ambient:birdsong": available(
      "ambient:birdsong",
      "Birdsong",
      "ambient",
      "procedural-tonal",
      "sunny ambient-life occurrence",
      "Light high-register chirp motif for sunny presentation.",
    ),
  },
);

export const AVAILABLE_CONTINUOUS_SOUND_LIBRARY: Readonly<
  Record<ContinuousSoundId, SoundLibraryEntry>
> = Object.freeze({
  "weather:rain": available(
    "weather:rain",
    "Rain / precipitation",
    "weather",
    "procedural-noise",
    "environment precipitation state",
    "Continuous deterministic filtered-noise rain texture scaled by precipitation intensity.",
  ),
  "weather:wind-bed": available(
    "weather:wind-bed",
    "Continuous wind",
    "weather",
    "procedural-noise",
    "environment windIntensity",
    "Continuous deterministic filtered-noise wind bed; discrete storm:gust remains layered above it.",
  ),
});

export const MISSING_SOUND_LIBRARY: readonly SoundLibraryEntry[] = Object.freeze([
  missing(
    "ambient:hot-insects",
    "Hot-weather insects",
    "ambient",
    "procedural-hybrid",
    "hot-and-dry environment presentation",
    "Sparse cicada/insect texture to distinguish hot-and-dry ambience from sunny weather.",
  ),
  missing(
    "neighborhood:resident-footsteps",
    "Resident footsteps",
    "neighborhood",
    "procedural-noise",
    "resident-departure / resident-arrival occurrences",
    "Surface-aware walking cadence synchronized to normal, relaxed, and hurried motion.",
  ),
  missing(
    "neighborhood:vehicle-engine",
    "Vehicle engine and pass-by",
    "neighborhood",
    "procedural-hybrid",
    "vehicle-departure / vehicle-arrival occurrences",
    "Low-cost engine/road texture with speed and distance variation.",
  ),
  missing(
    "neighborhood:bicycle-passby",
    "Bicycle pass-by",
    "neighborhood",
    "procedural-hybrid",
    "bicycle-pass-through occurrence",
    "Wheel/chain texture with optional sparse bell accent.",
  ),
  missing(
    "neighborhood:pet-walk",
    "Pet movement",
    "neighborhood",
    "procedural-noise",
    "pet-walk occurrence",
    "Subtle paw/collar movement; avoid repetitive barking as the default.",
  ),
  missing(
    "neighborhood:mailbox",
    "Mail delivery",
    "neighborhood",
    "procedural-hybrid",
    "mail-delivery occurrence",
    "Mailbox flap and paper handling synchronized to the mailbox anchor.",
  ),
  missing(
    "neighborhood:gardening",
    "Gardening",
    "neighborhood",
    "procedural-hybrid",
    "gardening occurrence",
    "Sparse clipping, brushing, and vegetation rustle rather than a constant loop.",
  ),
  missing(
    "neighborhood:sprinkler",
    "Sprinkler",
    "neighborhood",
    "procedural-noise",
    "sprinkler occurrence",
    "Rhythmic water spray bed synchronized to active yard sprinklers.",
  ),
  missing(
    "neighborhood:door",
    "House door",
    "neighborhood",
    "procedural-hybrid",
    "resident/pet house entry and exit",
    "Short open/close creak and latch aligned with the rendered door state.",
  ),
  missing(
    "neighborhood:window-activity",
    "Household window activity",
    "neighborhood",
    "procedural-hybrid",
    "window-activity occurrence",
    "Very quiet indoor activity texture, distance-limited and aggressively voice-capped.",
  ),
  missing(
    "customer:price-reject",
    "Price rejection",
    "customer",
    "procedural-tonal",
    "authoritative customer price-reject outcome",
    "Brief non-verbal cue that distinguishes rejection from pass-through without implying speech.",
  ),
  missing(
    "customer:stockout",
    "Stockout reaction",
    "customer",
    "procedural-tonal",
    "authoritative customer stockout outcome",
    "Brief cue for a customer who wanted lemonade but could not be served.",
  ),
  missing(
    "purchase:pour",
    "Lemonade pour",
    "purchase",
    "procedural-noise",
    "purchase storyboard serve/pour stage",
    "Liquid pour texture aligned with the visible pouring animation.",
  ),
  missing(
    "purchase:ice-clink",
    "Ice and cup clink",
    "purchase",
    "procedural-hybrid",
    "purchase storyboard cup preparation stage",
    "Sparse transient accents for ice, cup, and straw handling.",
  ),
]);

export const availableSounds: readonly SoundLibraryEntry[] = Object.freeze([
  ...Object.values(AVAILABLE_SOUND_LIBRARY),
  ...Object.values(AVAILABLE_CONTINUOUS_SOUND_LIBRARY),
]);

export const missingSounds: readonly SoundLibraryEntry[] = MISSING_SOUND_LIBRARY;

export const soundLibrary: readonly SoundLibraryEntry[] = Object.freeze([
  ...availableSounds,
  ...missingSounds,
]);

export const soundLibraryEntry = (id: SoundLibraryId): SoundLibraryEntry | undefined =>
  soundLibrary.find((entry) => entry.id === id);
