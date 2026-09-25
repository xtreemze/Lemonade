# Sound library

Lemonade uses procedural Web Audio rather than shipping recorded sound files. The typed inventory in
`packages/audio/src/library.ts` is the canonical catalog for playable cues and known coverage gaps.

The sound layer is presentation-only. It must not alter simulation outcomes, authoritative occurrence
ordering, customer behavior, or accounting. New cues should consume semantic events from the simulation,
scene presentation contracts, or renderer-neutral occurrence schedules instead of inventing their own
timers.

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
| `purchase:serve` | Serve lemonade | Purchase | Procedural tonal | Purchase serve beat |
| `purchase:payment` | Payment | Purchase | Procedural tonal | Purchase payment beat |
| `purchase:drink` | Drink | Purchase | Procedural tonal | Purchase drinking beat |
| `storm:thunder` | Thunder | Weather | Procedural tonal | Thunder occurrence |
| `storm:gust` | Wind gust | Weather | Procedural tonal | Gust occurrence |
| `ambient:birdsong` | Birdsong | Ambient | Procedural tonal | Sunny ambient-life occurrence |
| `weather:rain` | Rain / precipitation | Weather | Procedural noise | Environment precipitation frame |
| `weather:wind-bed` | Continuous wind | Weather | Procedural noise | Environment wind-intensity frame |

Total available: **16**.

The four forecast cues reproduce the historical Apple II weather excerpts already documented in
`docs/weather-audio.md`. The remaining cues are original procedural motifs/effects.

## Missing sounds

These are not currently playable. They are cataloged because the product already has a corresponding
semantic state, occurrence, customer outcome, or visible action that can own the trigger.

| Proposed cue | Sound | Trigger source | Recommended synthesis |
| --- | --- | --- | --- |
| `ambient:hot-insects` | Hot-weather insects | Hot-and-dry environment | Sparse hybrid procedural |
| `neighborhood:resident-footsteps` | Resident footsteps | Resident departure/arrival | Surface-aware noise transients |
| `neighborhood:vehicle-engine` | Vehicle engine/pass-by | Vehicle departure/arrival | Oscillator + filtered noise |
| `neighborhood:bicycle-passby` | Bicycle pass-by | Bicycle pass-through | Mechanical hybrid procedural |
| `neighborhood:pet-walk` | Pet movement | Pet-walk occurrence | Sparse paw/collar transients |
| `neighborhood:mailbox` | Mail delivery | Mail-delivery occurrence | Flap/paper hybrid procedural |
| `neighborhood:gardening` | Gardening | Gardening occurrence | Sparse clipping/rustle |
| `neighborhood:sprinkler` | Sprinkler | Sprinkler occurrence | Rhythmic filtered noise |
| `neighborhood:door` | House door | Resident/pet entry/exit | Creak/latch hybrid procedural |
| `neighborhood:window-activity` | Household window activity | Window-activity occurrence | Quiet, distance-limited texture |
| `customer:price-reject` | Price rejection | Authoritative customer outcome | Brief non-verbal tonal cue |
| `customer:stockout` | Stockout reaction | Authoritative customer outcome | Brief non-verbal tonal cue |
| `purchase:pour` | Lemonade pour | Purchase pour stage | Liquid-like filtered noise |
| `purchase:ice-clink` | Ice/cup/straw handling | Purchase preparation stage | Short metallic/glass transients |

Total missing: **14**.

## Implementation order

The next audio implementation should prioritize semantic synchronization and avoid creating a second
timing authority.

1. Environment synchronization: rain and continuous wind now consume the renderer-neutral environment
   frame, and thunder, gusts, and birdsong consume its occurrence schedule. Preserve that single semantic
   source as weather audio expands.
2. Purchase detail: pour and ice/cup handling, synchronized to the existing purchase storyboard.
3. Neighborhood occurrences: footsteps, vehicles, bicycles, pets, mail, gardening, sprinklers, doors, and
   window activity, driven by the deterministic neighborhood occurrence ledger.
4. Customer outcomes: price rejection and stockout cues, driven only by authoritative customer outcomes.
5. Hot-weather ambience: add sparse insects only after environment voice limits and distance attenuation
   are in place.

## Runtime constraints

- Keep audio optional and gesture-enabled.
- Prefer procedural generation; do not add recorded assets by default.
- Use deterministic semantic scheduling, but presentation synthesis may vary timbrally without consuming
  simulation RNG.
- Cap simultaneous ambient voices and attenuate/distance-gate neighborhood details on mobile.
- Suspend/resume with page lifecycle and do not replay already-consumed occurrences after visibility
  changes.
- Preserve the historical forecast excerpts exactly unless a cited source justifies a transcription change.
