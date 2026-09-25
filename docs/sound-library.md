# Sound library

Lemonade uses procedural Web Audio rather than shipping recorded sound files. The typed inventory in
`packages/audio/src/library.ts` is the canonical catalog for implemented cues and known coverage gaps.

The sound layer is presentation-only. It must not alter simulation outcomes, authoritative occurrence
ordering, customer behavior, or accounting. New cues consume semantic events from simulation or
renderer-neutral presentation contracts rather than inventing independent gameplay timers.

## Available sounds

| Cue | Sound | Category | Implementation | Trigger |
| --- | --- | --- | --- | --- |
| `forecast:sunny` | Sunny forecast motif | Forecast | Historical procedural | Sunny forecast |
| `forecast:cloudy` | Cloudy forecast motif | Forecast | Historical procedural | Cloudy forecast |
| `forecast:hot-and-dry` | Hot and dry forecast motif | Forecast | Historical procedural | Hot-and-dry forecast |
| `forecast:thunderstorm` | Thunderstorm forecast motif | Forecast | Historical procedural | Thunderstorm forecast |
| `day:submit` | Open stand | Gameplay | Procedural tonal | Planning submit |
| `day:profit` | Profit result | Gameplay | Procedural tonal | Non-negative day result |
| `day:loss` | Loss result | Gameplay | Procedural tonal | Negative day result |
| `progression:unlock` | Progression unlock | Gameplay | Procedural tonal | Tier or operating-scale increase |
| `purchase:ice-clink` | Ice and cup clink | Purchase | Procedural hybrid | Purchase preparation beat |
| `purchase:pour` | Lemonade pour | Purchase | Procedural hybrid | Purchase preparation beat |
| `purchase:serve` | Serve lemonade | Purchase | Procedural tonal | Purchase serve beat |
| `purchase:payment` | Payment | Purchase | Procedural tonal | Purchase payment beat |
| `purchase:drink` | Drink | Purchase | Procedural tonal | Purchase drinking beat |
| `weather:rain` | Rain / precipitation | Weather | Procedural noise | Environment precipitation state |
| `weather:wind-bed` | Continuous wind | Weather | Procedural noise | Environment wind intensity |
| `storm:thunder` | Thunder | Weather | Procedural tonal | Thunder occurrence |
| `storm:gust` | Wind gust | Weather | Procedural tonal | Gust occurrence |
| `ambient:birdsong` | Birdsong | Ambient | Procedural tonal | Sunny ambient-life occurrence |

Total available: **18**.

The four forecast cues reproduce the historical Apple II weather excerpts documented in
`docs/weather-audio.md`. Rain and continuous wind are persistent environment beds controlled by the
renderer-neutral environment frame. Thunder, gusts and birdsong remain discrete semantic occurrences.
Purchase preparation now follows the same deterministic sale schedule as serve, payment and drink.

## Missing sounds

| Proposed cue | Sound | Trigger source | Recommended synthesis |
| --- | --- | --- | --- |
| `ambient:hot-insects` | Hot-weather insects | Hot-and-dry environment presentation | Sparse hybrid procedural |
| `neighborhood:resident-footsteps` | Resident footsteps | Resident departure/arrival occurrences | Surface-aware noise transients |
| `neighborhood:vehicle-engine` | Vehicle engine/pass-by | Vehicle departure/arrival occurrences | Oscillator + filtered noise |
| `neighborhood:bicycle-passby` | Bicycle pass-by | Bicycle pass-through occurrence | Mechanical hybrid procedural |
| `neighborhood:pet-walk` | Pet movement | Pet-walk occurrence | Sparse paw/collar transients |
| `neighborhood:mailbox` | Mail delivery | Mail-delivery occurrence | Flap/paper hybrid procedural |
| `neighborhood:gardening` | Gardening | Gardening occurrence | Sparse clipping/rustle |
| `neighborhood:sprinkler` | Sprinkler | Sprinkler occurrence | Rhythmic filtered noise |
| `neighborhood:door` | House door | Resident/pet entry/exit | Creak/latch hybrid procedural |
| `neighborhood:window-activity` | Household window activity | Window-activity occurrence | Quiet, distance-limited texture |
| `customer:price-reject` | Price rejection | Authoritative customer outcome | Brief non-verbal tonal cue |
| `customer:stockout` | Stockout reaction | Authoritative customer outcome | Brief non-verbal tonal cue |

Total missing: **12**.

## Implementation order

1. Neighborhood occurrences: footsteps, vehicles, bicycles, pets, mail, gardening, sprinklers, doors and
   window activity should be driven by the deterministic neighborhood occurrence ledger, with distance
   attenuation and strict voice limits.
2. Customer outcomes: price rejection and stockout must wait for authoritative `CustomerOutcome[]` data
   to be present in `DayResolution`; the audio layer must not infer these outcomes from aggregate sales.
3. Hot-weather ambience: add sparse insects once environment voice limits and attenuation are shared with
   the rest of the ambient system.

## Runtime constraints

- Keep audio optional and gesture-enabled.
- Prefer procedural generation; do not add recorded assets by default.
- Use deterministic semantic scheduling, but presentation synthesis may vary timbrally without consuming
  simulation RNG.
- Cap simultaneous ambient voices and attenuate/distance-gate neighborhood details on mobile.
- Suspend/resume with page lifecycle and do not replay already-consumed occurrences after visibility
  changes.
- Preserve the historical forecast excerpts exactly unless a cited source justifies a transcription change.
