# Revival roadmap

The revival is organized to preserve a playable comparison target while moving business rules into deterministic, testable packages. The migration should not replace the legacy implementation all at once.

## Phase 0 — product and engineering contract

Status: started in Epic #8.

Deliverables:

- reverse-engineered classic design model;
- target architecture;
- strict AI executor rules;
- scoped implementation issues;
- repository README/presentation that explains the actual game rather than stale build badges.

Exit condition: future contributors can determine what must remain invariant without reconstructing the project from the 2017 implementation.

## Phase 1 — workspace/tooling migration (#1)

Introduce the modern workspace while preserving legacy source for comparison.

Target:

```text
apps/web
packages/simulation
packages/ui
packages/scene
packages/audio
packages/config
```

Tooling baseline:

- Node 24 LTS;
- pinned pnpm workspace;
- TypeScript 7 strict mode;
- React 19 + Vite 8;
- Vitest 5;
- Playwright;
- ESLint flat config and explicit formatting checks.

Migration rule: dependency changes and `pnpm-lock.yaml` are one generated transaction performed by tooling. Never hand-edit the lockfile through GitHub.

Exit condition: clean checkout -> one install -> typecheck/lint/test/build all have documented commands and CI jobs.

## Phase 2 — deterministic simulation (#2)

Implement the smallest pure engine capable of one complete classic-style day.

Order:

1. branded/fixed-precision primitives;
2. weather, sentiment, event and progression unions;
3. three-variable decision type and validation;
4. classic-inspired price and advertising curves;
5. seeded randomness/environment generation;
6. accounting and immutable daily ledger;
7. deterministic replay/golden/property tests.

Start with a neutral market-sentiment multiplier so classic conformance fixtures remain easy to understand, then introduce the bounded sentiment model as a separate tested rule.

Exit condition: a test can run an entire multi-day game without importing a browser API.

## Phase 3 — primary web loop (#3)

Build the real user experience around the simulation package.

Primary screen must expose only:

- glasses;
- signs;
- price;
- Sell for the day.

Before submit, show:

- weather forecast;
- qualitative market sentiment;
- current assets;
- current production/sign costs;
- projected spend and affordability.

After submit, show a single coherent report containing sales, revenue, costs, profit/loss, assets and material events.

Exit condition: a complete game day can be played with mouse/touch or keyboard and is covered by Playwright.

## Phase 4 — persistence, ledger and charts (#6)

Persist versioned state and the immutable ledger. Add small analytical views that answer gameplay questions rather than decorating the dashboard.

Initial charts:

- assets over time;
- revenue / expense / profit;
- prepared / sold / sell-through;
- price and demand history.

Exit condition: reload preserves the current run, old ledger results do not change after balance updates, and every chart has accessible values/table equivalence.

## Phase 5 — vector 3D Lemonsville (#4)

Introduce presentation only after simulation/UI fixtures exist.

Milestones:

1. static stand/neighborhood composition;
2. weather variants;
3. visible signs and stand progression;
4. customer/traffic intensity bands;
5. day-resolution animation;
6. reduced-motion and non-WebGL fallback;
7. measured quality tiers.

Exit condition: the 3D scene communicates state, stays inside frame budgets, and can be removed without affecting a simulation test.

## Phase 6 — procedural audio (#5)

Build original event-driven cues with Web Audio.

Milestones:

- audio context lifecycle and explicit user enablement;
- synth voices/envelopes/noise;
- tiny typed sequencer;
- forecast/day/result/progression cue families;
- suspend/resume and reduced-sensory handling;
- optional Web MIDI output where supported.

Native SoundFont/system MIDI support is deferred to a capability-specific Tauri issue if the web implementation proves insufficient.

Exit condition: audio can be disabled entirely and the simulation/UI remains behaviorally equivalent.

## Phase 7 — progressive finance (#7)

Add complexity through rule modules, not more daily sliders.

Suggested order:

1. production/input-cost changes;
2. fixed operating/permit fees;
3. predictable tax settlement;
4. banking fees;
5. savings interest;
6. optional borrowing and loan interest;
7. mature market cycles.

Every mechanic is previewed before first charge, appears as a named ledger line, and has deterministic rounding/boundary tests.

Exit condition: progression meaningfully changes strategy while the daily operating surface remains three controls plus submit.

## Phase 8 — optional Tauri/native capabilities

Only begin this phase when a native capability has a measured product benefit.

Potential use cases:

- desktop packaging and updates;
- local save/export integration;
- native menus/shortcuts;
- MIDI/SoundFont backend;
- platform integrations that cannot be implemented reliably in the browser.

Do not port simulation code to Rust just to justify Tauri. If a native implementation of any shared logic becomes necessary, require conformance fixtures across languages.

## Balance/certification loop

Once Phases 2-3 are functional, treat game balance as data backed by simulation rather than ad-hoc UI tweaking.

For each ruleset version:

- run seeded strategy fixtures;
- inspect bankruptcy and runaway-growth rates;
- verify that weather/sentiment uncertainty matters but does not dominate player decisions;
- verify advertising has diminishing returns;
- verify plausible price choices have meaningful trade-offs;
- verify new progression costs arrive only after the player has learned preceding mechanics.

Changes to balance constants require tests/fixture updates and an explicit PR note that replay outcomes may differ under the new ruleset.