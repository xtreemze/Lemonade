# Architecture

## Decision

Lemonade is a **web-first deterministic simulation** with optional platform capability adapters.

The web app owns composition and user experience. A pure TypeScript simulation package owns business rules. Rendering, audio, persistence, charts, and Tauri are consumers/adapters around that package.

Tauri is deliberately not the foundation. It may package the web app and expose native capabilities when those capabilities have a clear benefit, but the game remains fully playable in a browser.

## Proposed workspace

```text
apps/
  web/
    src/
      app/
      features/
      adapters/
  desktop/
    src-tauri/
packages/
  simulation/
    src/
      model/
      rules/
      progression/
      rng/
      persistence/
  ui/
    src/
      decisions/
      reports/
      charts/
  scene/
    src/
  audio/
    src/
  config/
```

`apps/desktop` is introduced only after the web application and package boundaries exist. It should be possible to delete the desktop package without changing a single simulation rule.

## Dependency direction

Dependencies point inward toward stable, pure contracts.

```text
simulation <- ui projections <- apps/web
simulation <- scene adapter  <- apps/web
simulation <- audio events   <- apps/web
simulation <- persistence adapter <- apps/web
apps/web <- optional native bridge <- apps/desktop
```

Forbidden dependency directions:

- `simulation -> React`
- `simulation -> DOM/browser`
- `simulation -> Three.js`
- `simulation -> Web Audio`
- `simulation -> Tauri`
- `simulation -> IndexedDB/localStorage`
- `simulation -> chart library`

## Domain API

The core day resolution should be representable by a small pure contract.

Illustrative TypeScript:

```ts
type DayDecision = Readonly<{
  glasses: GlassCount;
  signs: SignCount;
  price: MoneyCents;
}>;

type DayEnvironment = Readonly<{
  weather: Weather;
  sentiment: MarketSentiment;
  event: DayEvent;
}>;

type SimulateDay = (
  state: GameState,
  decision: DayDecision,
  environment: DayEnvironment,
  rng: RandomSource,
) => DayResolution;
```

The exact API may evolve, but the important properties do not:

- explicit inputs;
- immutable output;
- injected randomness;
- no ambient clock/device state;
- fixed-precision money;
- no presentation dependencies.

## Type model

Prefer types that encode business invariants.

Useful opaque/branded primitives include:

- `MoneyCents`
- `GlassCount`
- `SignCount`
- `DayNumber`
- `Seed`
- `BasisPoints` or another fixed-precision rate representation

Variant concepts should be closed discriminated unions where practical:

```ts
type Weather =
  | { kind: "sunny" }
  | { kind: "cloudy"; rainRisk: Percent }
  | { kind: "hot-and-dry" }
  | { kind: "thunderstorm" };
```

Use exhaustive handling rather than catch-all defaults. When persisted or external data enters the application, validate it at the boundary before converting it into these domain types.

## Accounting

Accounting must be exact at the unit we display.

Default representation: integer cents.

A daily ledger entry records named components rather than only a final profit number:

```text
revenue
- production
- advertising
- operating fees
- taxes
+ savings interest
- loan interest
= net change
```

If later mechanics require fractional-cent accrual, keep a documented fixed-precision internal representation and define the point at which rounding occurs. Never introduce binary floating-point dollars into the authoritative ledger.

Historical ledger entries are immutable. A future balance patch must not cause old chart history to be recomputed under new rates.

## Determinism and randomness

Simulation randomness is a dependency.

A seedable generator should support:

- deterministic replay tests;
- shareable challenge seeds;
- bug reproduction;
- simulation/balance analysis;
- fixed UI/story fixtures.

Do not use the same random stream for presentation variation. 3D ambient motion, customer appearance, and procedural music should receive their own presentation seed(s).

The ordering of random draws is part of a simulation version's deterministic contract. Prefer deriving named substreams or precomputing typed environment events so unrelated code changes do not silently perturb all future results.

## Simulation versioning

Game-state persistence should contain at least:

- save schema version;
- simulation/ruleset version;
- seed or environment-sequence identity;
- current state;
- immutable daily ledger;
- decisions or sufficient event log for diagnostics/replay.

Schema migration and ruleset migration are different concerns. An old save can be structurally migrated without pretending that a changed balance model produces the same historical simulation.

## State machine

Model the primary app flow explicitly:

```text
forecast/deciding
  -> resolving
  -> report
  -> forecast/deciding
```

Optional secondary surfaces (history, settings, finance) do not alter the day phase unless they explicitly commit a finance action.

Avoid loose booleans that can create contradictory states such as a report being visible while decisions are still editable.

## UI package

The UI package owns accessible presentation primitives, not business rules.

Primary day controls:

- glasses;
- signs;
- price;
- one submit action.

The UI receives validated ranges and affordability information from projections/domain services. It should not reproduce the core demand or accounting formula.

Sliders should have precise numeric alternatives. Validation should be inline and predictable. A player should understand why a decision cannot be submitted without being interrupted by a modal/toast sequence.

## Scene package

The 3D scene consumes a compact typed render model. Example concepts:

```text
weatherAppearance
trafficIntensity
customerActivity
standTier
visibleSigns
sellThroughBand
resolutionPhase
```

The scene may interpolate between those values for animation, but it cannot decide how many glasses were sold.

Performance strategy:

- simple low-poly/vector geometry;
- instancing for repeated objects;
- bounded device-pixel ratio;
- explicit quality tiers;
- minimal post-processing;
- static/vector fallback when WebGL is unavailable;
- no gameplay-significant information exclusively inside the canvas.

## Audio package

Core web audio should use a small procedural engine built on Web Audio primitives.

It receives semantic events such as:

```text
forecast:sunny
forecast:cloudy
day:submit
day:profit
day:loss
event:thunderstorm
progression:unlock
```

and schedules original motifs/effects. The audio package does not receive mutable game objects and cannot make simulation decisions.

MIDI/SoundFont support is an adapter boundary. Browser Web MIDI can target external devices where supported. OS General MIDI/SoundFont access is not assumed in the web baseline.

## Persistence

Start with an interface rather than binding UI code directly to IndexedDB.

```ts
interface SaveRepository {
  load(slot: SaveSlot): Promise<UnknownSavePayload | null>;
  save(slot: SaveSlot, payload: SerializedSave): Promise<void>;
}
```

The browser adapter may use IndexedDB. A future Tauri adapter may use a native application-data file or database. Both pass through the same validation/migration layer.

## Charts

Charts consume projections of the immutable ledger.

Prefer lightweight SVG components first. The required data set is small and known, and bespoke charts can be both faster and more accessible than adopting a large general-purpose chart package.

Each chart needs:

- a title/question it answers;
- accessible values independent of hover;
- keyboard navigation when interactive;
- a data table or equivalent representation;
- deterministic fixture rendering.

## Optional Tauri shell

Introduce Tauri only for specific capabilities such as:

- desktop packaging/update integration;
- reliable local-file persistence/export;
- native menus/shortcuts;
- MIDI/native audio or SoundFont access where browser APIs are insufficient;
- platform notifications or integrations that have a real game-design purpose.

Do not duplicate browser capabilities in Rust merely because Tauri is present.

Tauri commands must be narrow, permission-minimized, validated, and versioned at the IPC boundary. Native code should not become a parallel game engine by accident.

## Tooling baseline

As of September 10, 2026, the target stack for the migration tracked by #1 is:

- Node 24 LTS;
- pnpm workspaces;
- TypeScript 6 strict mode, with TypeScript 7 migration compatibility treated as a design constraint;
- React 19.3;
- Vite 8.1;
- Vitest 5;
- Playwright;
- ESLint flat configuration;
- Three.js-compatible renderer;
- Tauri 2.11.x/Rust only when native capability work begins.

TypeScript 6 is intentionally the current baseline: it is the stable transition release for the upcoming native TypeScript 7 compiler. Resolve its documented deprecations instead of relying on settings TypeScript 7 removes.

Use exact versions from the generated lockfile, not README prose, as the reproducible source of package versions.

## CI contract

The eventual required CI sequence should contain separate, diagnosable checks:

```text
format/check
lint
typecheck
unit + property tests
web build
browser smoke/accessibility-critical flows
```

Native/Tauri checks can be added when the desktop package exists rather than making every early web PR pay the platform build cost.

PRs should not claim tests were run when the connector environment cannot execute them. CI is the source of truth for GitHub-only changes; local executors are used when a generated transaction or hardware/runtime measurement is required.
