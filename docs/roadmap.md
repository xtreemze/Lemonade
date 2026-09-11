# Revival roadmap

The revival is organized around one invariant: preserve the classic game's tiny decision surface while making the simulation deterministic, inspectable, accessible, and maintainable with current tooling.

The 2017 Webpack application served as product archaeology during migration. Functional parity has now been reached by the modern implementation, so the duplicate legacy source/build output has been removed from the active tree and remains available through Git history.

## Phase 0 — product and engineering contract

Status: complete.

Delivered:

- reverse-engineered classic design model;
- target architecture;
- strict AI executor rules;
- scoped implementation issues;
- repository presentation that explains the actual game and engineering constraints.

## Phase 1 — workspace/tooling migration (#1)

Status: complete in the revival branch.

Current baseline:

- Node 24 LTS;
- pnpm 12 workspace with generated lockfile;
- TypeScript 6 strict mode;
- native HTML/DOM/CSS application UI;
- Vite 8 as a thin development/build layer;
- Vitest 5;
- Playwright;
- ESLint flat config with type-aware rules;
- `pnpm/setup@v1` CI provisioning for pnpm + Node;
- no Webpack, Babel, Travis, PostCSS compatibility layer, or runtime UI framework.

Dependency changes and `pnpm-lock.yaml` remain one generated transaction performed by tooling. Never hand-edit the lockfile.

## Phase 2 — deterministic simulation (#2)

Status: implemented.

The simulation package provides:

1. branded/fixed-precision primitives;
2. weather, sentiment, event and progression unions;
3. three-variable decision validation;
4. classic-inspired price and advertising curves;
5. seeded randomness/environment generation;
6. accounting and immutable daily ledger;
7. deterministic replay and invariant tests.

The package is independent of browser APIs and presentation code.

## Phase 3 — primary web loop (#3)

Status: implemented with native browser primitives.

The primary screen exposes only:

- glasses;
- signs;
- price;
- Sell for the day.

Before submit it presents weather, sentiment, assets, costs, projected spend, and affordability. After submit it presents the day report and material events. The flow is keyboard-operable and covered by Playwright.

## Phase 4 — ledger and charts (#6)

Status: ledger/history visualization and durable browser persistence implemented.

The current UI uses native DOM + SVG rather than a charting framework. Historical values are exposed in a semantic table so the chart is never the only representation. Completed ledger history is persisted immutably and restored without recomputing old days under current balance constants.

## Phase 5 — vector 3D Lemonsville (#4)

Status: initial implementation complete.

The scene communicates:

- weather variants;
- visible advertising signs;
- customer activity;
- sell-through/day-resolution state;
- reduced-motion preference;
- textual and non-WebGL fallback.

Three.js remains intentionally isolated to `packages/scene`; it solves meaningful scene-graph/WebGL complexity and does not own game rules.

## Phase 6 — procedural audio (#5)

Status: initial implementation complete.

The browser audio layer provides original event-driven Web Audio cues with explicit gesture enablement and lifecycle handling. MIDI/SoundFont support remains an optional platform adapter rather than a browser assumption.

## Phase 7 — progressive finance (#7)

Status: initial progression implemented.

Current finance progression includes named ledger treatment for supplier fees, taxes, banking costs, savings/loan interest, debt, repayment, and working-capital limits while preserving the three-control daily interface.

Further balance work should be driven by deterministic simulation fixtures rather than additional mandatory controls.

## Phase 8 — persistence and run portability (#21)

Status: implemented in the browser baseline.

Delivered:

- explicit portable save schema with independent save and simulation/ruleset versions;
- strict migration and validation boundary for all stored/imported data;
- immutable completed-day ledger preservation;
- deterministic seed/environment verification and RNG restoration;
- explicit `deciding` and `report` phase persistence so reloads do not alter the current day;
- native IndexedDB storage behind the web application boundary;
- portable JSON export/import and explicit reset controls outside the daily decision form;
- safe recovery for corrupt, unsupported, or future-version saves;
- playable degraded mode when durable browser storage is unavailable;
- unit fixtures plus Playwright coverage for reload persistence and clean-profile portability.

The simulation package remains storage-agnostic. Native file integration should be added only if a future desktop shell earns that capability surface.

## Phase 9 — optional Tauri/native capabilities

Begin only when a native capability has a measured product benefit.

Potential use cases:

- desktop packaging and updates;
- local save/export integration;
- native menus/shortcuts;
- MIDI/SoundFont backend;
- platform integrations that cannot be implemented reliably in the browser.

Do not port simulation code to Rust merely to justify Tauri. If shared logic ever exists in more than one language, require conformance fixtures across implementations.

## Balance and certification loop

For each ruleset version:

- run seeded strategy fixtures;
- inspect bankruptcy and runaway-growth rates;
- verify weather/sentiment uncertainty matters without dominating player decisions;
- verify advertising has diminishing returns;
- verify plausible price choices have meaningful trade-offs;
- verify new progression costs arrive only after preceding mechanics are understandable;
- verify accounting identities and rounding boundaries;
- run the complete keyboard/browser acceptance flow.

Changes to balance constants require tests/fixture updates and an explicit note that replay outcomes may differ under the new ruleset.
