# Architecture

## Decision

Lemonade is a **web-first deterministic simulation** with optional platform capability adapters.

The browser application owns composition and user experience. A pure TypeScript simulation package owns business rules. Rendering, audio, persistence, charts, and any future Tauri shell are consumers/adapters around that package.

The default implementation rule is **standards first**: use semantic HTML, CSS, native form controls, SVG, Web Audio, and browser lifecycle APIs directly when they solve the problem cleanly. Lit is used selectively for interactive presentation components where declarative rendering materially reduces repetitive DOM synchronization. Renderer-neutral scene contracts are isolated from engine code; Babylon.js is the target production 3D engine while Three.js remains a temporary compatibility/reference renderer during migration.

Tauri is deliberately not the foundation. It may package the web app and expose native capabilities when those capabilities have a clear benefit, but the game remains fully playable in a browser.

## Workspace

```text
apps/
  web/
    src/
      app.ts         application controller and orchestration
      components.ts  light-DOM Lit presentation components
      scene.ts       browser-to-scene adapter
      main.ts        bootstrap
packages/
  simulation/      deterministic business model
  ui/              ledger projections + native DOM/SVG reporting
  scene-contracts/ renderer-neutral scene/storyboard/layout contracts
  scene/           temporary Three.js compatibility renderer
  scene-babylon/   target Babylon.js renderer
  audio/           procedural Web Audio engine
```

`apps/desktop` should be introduced only if a native capability earns the additional platform surface. It must be possible to delete a future desktop package without changing a simulation rule.

## Dependency direction

Dependencies point inward toward stable, pure contracts.

```text
simulation <- ui projections/renderers <- apps/web
simulation <- scene adapter           <- apps/web
simulation <- audio events            <- apps/web
simulation <- persistence adapter      <- apps/web
apps/web   <- optional native bridge   <- apps/desktop
```

Forbidden dependency directions:

- `simulation -> DOM/browser APIs`
- `simulation -> UI framework/runtime`
- `simulation -> scene engine (Three.js/Babylon.js)`
- `simulation -> Web Audio`
- `simulation -> Tauri`
- `simulation -> IndexedDB/localStorage`
- `simulation -> chart library`

## Native web application

`LemonadeApp` owns browser-side mutable presentation state, calls the pure simulation, coordinates persistence/audio/scene adapters, and projects immutable view models into a narrow Lit component layer. The current Lit components own run portability controls, the three-decision form, and the day report; they emit typed DOM events back to the controller.

Use browser primitives before adding abstractions:

- `<form>`, `<label>`, `<input type="range">`, `<output>`, `<button>`, `<table>`, `<dl>` for interaction and data;
- DOM events for user input;
- `hidden`, ARIA attributes, semantic headings and live regions for state presentation;
- `matchMedia()` for user preferences;
- `ResizeObserver` for canvas sizing;
- native SVG DOM for charts;
- Web Audio for procedural cues;
- Canvas/WebGL through the scene adapter.

Do not expand Lit across the codebase merely for uniformity. Use it where reactive rendering replaces meaningful imperative synchronization. Static composition, the history SVG/table renderer, persistence, audio, and scene adapters stay outside Lit unless a concrete maintenance problem justifies movement.

Lit components use standard Custom Elements and native events. Current components intentionally render to light DOM so established CSS, semantic structure, and accessibility tests remain stable.

## Domain API

The core day resolution is a small pure contract:

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
```

The exact public API may evolve, but the important properties do not:

- explicit inputs;
- immutable output;
- injected randomness;
- no ambient clock/device state;
- fixed-precision money;
- no presentation dependencies.

### Audience/customer contract for ruleset v4

The v4 market model adds explicit renderer-neutral customer outcomes to the pure simulation boundary.

```text
run seed + business state + environment + three decisions
  -> simulation
  -> DayResolution
       - accounting
       - aggregate market funnel
       - CustomerOutcome[]
       - next compact MarketMemory
  -> browser projections
       -> report/accessibility
       -> scene storyboard
       -> audio cues
```

The simulation owns customer identity, awareness source, price acceptance, purchase/stockout outcome, and compact market memory. The scene owns geometry and animation only.

Do not pass only `sold` and ask the renderer to synthesize a plausible crowd. If the scene shows a sign glance, price rejection, purchase, stockout, or recurring customer, that semantic event must originate in `DayResolution`.

The renderer may pool or instance visual rigs, but logical customer identity must remain stable for the complete event lifecycle.

## Type model

Prefer types that encode business invariants.

Useful opaque/branded primitives include:

- `MoneyCents`
- `GlassCount`
- `SignCount`
- `DayNumber`
- `Seed`
- `BasisPoints`

Variant concepts should be closed discriminated unions where practical. Use exhaustive handling rather than catch-all defaults. Validate persisted or external data at the boundary before converting it into domain types.

## Accounting

Accounting must be exact at the unit displayed. The default representation is integer cents.

A daily ledger records named components rather than only a final profit number:

```text
revenue
- production
- advertising
- supplier/bank obligations
- taxes
+ savings interest
- loan interest
= operating net
```

Borrowing and principal repayment are balance-sheet movements and do not masquerade as profit or loss. Historical ledger entries are immutable; a future balance patch must not cause old chart history to be recomputed under new rates.

If future mechanics require fractional-cent accrual, retain a documented fixed-precision internal representation and define the rounding boundary explicitly.

## Determinism and randomness

Simulation randomness is a dependency.

A seedable generator supports:

- deterministic replay tests;
- shareable challenge seeds;
- bug reproduction;
- simulation/balance analysis;
- fixed UI/story fixtures.

Do not use the same random stream for presentation variation. 3D ambient motion, customer appearance, and procedural music should receive separate presentation seeds if randomness is introduced there.

The ordering of random draws is part of a simulation version's deterministic contract. Prefer named substreams or precomputed typed environment events when unrelated features might otherwise perturb future results.

Ruleset v4 should make this stronger by deriving named market substreams for audience selection, customer traits, awareness, and conversion. Presentation seeds for Three.js/audio must be disjoint from simulation streams. Adding an umbrella variant or animation may never change who buys lemonade.

## Simulation versioning and persistence

Persisted data should contain at least:

- save schema version;
- simulation/ruleset version;
- seed or environment-sequence identity;
- current state;
- immutable daily ledger;
- decisions or sufficient event log for diagnostics/replay.

Schema migration and ruleset migration are separate concerns. Persisted data is untrusted input and must be validated before entering the domain model.

Persistence starts at an interface boundary rather than being embedded into UI code. The browser implementation may use IndexedDB; a future Tauri adapter may use an application-data file or database. Both pass through the same validation/migration layer.

## State machine

Model the primary flow explicitly:

```text
forecast/deciding
  -> report
  -> forecast/deciding
```

A day is resolved synchronously by the pure simulation when the player commits the form. Optional secondary surfaces such as history, settings, or finance must not create contradictory primary states.

## UI and charts

The primary day surface has exactly three player-controlled variables:

- glasses;
- signs;
- price;
- one primary submit action.

The browser receives validated ranges and affordability information from projections/domain services. It must not reproduce demand or accounting formulas.

Charts consume projections of the immutable ledger. Prefer native SVG first because the data set is small and known. Each quantitative chart requires a textual/semantic equivalent; the current history view includes a complete table alongside SVG series.

Avoid adding a general chart dependency until required interaction or scale exceeds what a small SVG renderer can express safely.

## Scene packages

The 3D scene consumes compact renderer-neutral contracts from `@lemonade/scene-contracts`. A renderer may interpolate presentation values, but it cannot decide how many glasses were sold or schedule authoritative occurrences.

Babylon.js is the production target. `@lemonade/scene-babylon` owns Babylon engine/scene resources and progressively replaces the Three projection. `@lemonade/scene` remains temporarily as the Three compatibility/reference renderer and re-exports shared contracts where required by existing callers. It will be removed after Babylon passes parity, browser, mobile, accessibility and performance gates.

Neither engine belongs in the critical application entry: both runtimes are lazy. New renderer-specific implementation targets Babylon unless it is strictly required to maintain the Three reference during migration.

Performance strategy:

- simple low-poly/vector geometry;
- instancing for repeated objects where useful;
- bounded device-pixel ratio;
- explicit resize and disposal behavior;
- minimal post-processing;
- static/textual fallback when WebGL is unavailable;
- no gameplay-significant information exclusively inside the canvas.

## Audio package

Core browser audio uses Web Audio primitives and original procedural motifs/effects. It receives semantic events such as weather, submit, profit/loss, and progression unlocks.

Audio starts only after a user gesture, handles suspend/resume, and cannot affect simulation results. MIDI/SoundFont support remains a platform adapter; browser access to an operating system General MIDI soundbank is not assumed.

## Optional Tauri shell

Introduce Tauri only for specific capabilities such as:

- desktop packaging/update integration;
- reliable local-file import/export;
- native menus/shortcuts;
- MIDI/native audio or SoundFont access where browser APIs are insufficient;
- platform integrations with a concrete game-design purpose.

Do not duplicate browser capabilities in Rust merely because Tauri is present. Native commands must be narrow, permission-minimized, validated, and versioned at the IPC boundary.

## Tooling baseline

The workspace baseline as of September 2026 is:

- Node 24 LTS;
- pnpm 12 workspaces;
- TypeScript 6 strict mode;
- native HTML/CSS application UI with selective Lit 3 components;
- Vite 8 as a thin web build/development layer;
- Vitest 5;
- Playwright;
- ESLint flat configuration with typed rules;
- Babylon.js for the target 3D renderer, with Three.js temporarily retained as a migration reference;
- Tauri/Rust only when native capability work begins.

CI uses `pnpm/setup@v1`, which provisions the standalone pnpm executable and Node runtime in one action. Dependency installation is frozen against the generated lockfile.

## CI contract

Required validation is split into diagnosable jobs:

```text
frozen dependency install
strict typecheck
lint
unit/invariant tests
web build
browser acceptance flows
```

Native/Tauri checks are added only if a desktop package is introduced. Generated dependency state is produced by package tooling and committed as generated output; it is never hand-authored.
