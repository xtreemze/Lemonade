# Lemonade

> A modern revival of the classic Lemonade Stand business simulation: three decisions, one day of sales, immediate consequences.

**MVP:** [Play Lemonade on GitHub Pages](https://xtreemze.github.io/Lemonade/)

Lemonade rebuilds the design strength of the 1979 Apple II game around a deliberately small operating surface. Each day, the player reads the conditions, chooses how many glasses to prepare, how much to advertise, and what price to charge, then commits the day and sees what happened.

The goal is not to turn Lemonade into a spreadsheet. The goal is to make three variables feel consequential.

## The daily loop

1. Read the **weather forecast** and **market sentiment**.
2. Adjust exactly three operating variables:
   - **Glasses** — how much lemonade to prepare.
   - **Signs** — how much to spend on advertising.
   - **Price** — what to charge per glass.
3. Press **Sell for the day**.
4. Watch the stand and neighborhood resolve the day.
5. Read the financial report: sold, revenue, costs, profit/loss, and ending assets.
6. Review trends, then make the next day's three decisions.

Weather and sentiment are conditions to reason about, not additional controls. Progression adds taxes, bank charges, interest, supplier costs, and other responsibilities without expanding the primary operating interface beyond three controls plus one submit action.

## Product in motion

CI captures the real application in Chromium with media chosen for the content rather than forcing every state through video. Forecast and simulation render the actual WebGL canvas at deterministic 1/60-second browser-time steps, and Chromium WebCodecs encodes every rendered source frame before FFmpeg sees the video. CI requires the exact native frame count for each scene, so a slower capture cannot pass through duplicated or padded frames. The application’s real procedural Web Audio is muxed into the recording, then encoded as high-quality H.264/AAC. Planning, day report, and sales history remain lossless PNG screenshots. Animated WebP derivatives preserve the 60 fps source cadence for Markdown and presentation surfaces.

### Desktop

<img src="https://xtreemze.github.io/Lemonade/showcase/reels/lemonade-desktop-highlight.webp" alt="Lemonade desktop visual highlight reel" width="960" />

#### Weather forecast

Read the day’s weather and neighborhood conditions before opening the stand.

<img src="https://xtreemze.github.io/Lemonade/showcase/desktop/01-weather-forecast.webp" alt="Lemonade weather forecast over the Lemonsville neighborhood" width="960" />

[Watch the source-resolution 60 fps weather scene](https://xtreemze.github.io/Lemonade/showcase/videos/desktop/01-weather-forecast.mp4)

#### Three-decision planning

Set glasses, advertising signs, and price on the compact daily planning surface.

<img src="https://xtreemze.github.io/Lemonade/showcase/desktop/02-three-decision-plan.png" alt="Lemonade daily planning controls for glasses, signs, and price" width="960" />

#### Live Lemonsville simulation

Watch the stand, neighborhood, customers, weather, and inventory resolve the business day.

<img src="https://xtreemze.github.io/Lemonade/showcase/desktop/03-lemonsville-simulation.webp" alt="Lemonsville 3D neighborhood simulation around the lemonade stand" width="960" />

[Watch the source-resolution 60 fps simulation](https://xtreemze.github.io/Lemonade/showcase/videos/desktop/03-lemonsville-simulation.mp4)

#### Day report

See sold glasses, revenue, costs, profit or loss, and ending assets immediately after the day.

<img src="https://xtreemze.github.io/Lemonade/showcase/desktop/04-day-report.png" alt="Lemonade end-of-day financial report" width="960" />

#### Sales history

Review accessible trends and ledger history before planning the next day.

<img src="https://xtreemze.github.io/Lemonade/showcase/desktop/05-sales-history.png" alt="Lemonade sales history charts and ledger" width="960" />

[Watch the source-resolution 60 fps desktop highlight reel](https://xtreemze.github.io/Lemonade/showcase/reels/lemonade-desktop-highlight.mp4)

### Mobile

<img src="https://xtreemze.github.io/Lemonade/showcase/reels/lemonade-mobile-highlight.webp" alt="Lemonade mobile visual highlight reel" width="390" />

#### Weather forecast

Read the day’s weather and neighborhood conditions before opening the stand.

<img src="https://xtreemze.github.io/Lemonade/showcase/mobile/01-weather-forecast.webp" alt="Lemonade weather forecast over the Lemonsville neighborhood" width="390" />

[Watch the source-resolution 60 fps weather scene](https://xtreemze.github.io/Lemonade/showcase/videos/mobile/01-weather-forecast.mp4)

#### Three-decision planning

Set glasses, advertising signs, and price on the compact daily planning surface.

<img src="https://xtreemze.github.io/Lemonade/showcase/mobile/02-three-decision-plan.png" alt="Lemonade daily planning controls for glasses, signs, and price" width="390" />

#### Live Lemonsville simulation

Watch the stand, neighborhood, customers, weather, and inventory resolve the business day.

<img src="https://xtreemze.github.io/Lemonade/showcase/mobile/03-lemonsville-simulation.webp" alt="Lemonsville 3D neighborhood simulation around the lemonade stand" width="390" />

[Watch the source-resolution 60 fps simulation](https://xtreemze.github.io/Lemonade/showcase/videos/mobile/03-lemonsville-simulation.mp4)

#### Day report

See sold glasses, revenue, costs, profit or loss, and ending assets immediately after the day.

<img src="https://xtreemze.github.io/Lemonade/showcase/mobile/04-day-report.png" alt="Lemonade end-of-day financial report" width="390" />

#### Sales history

Review accessible trends and ledger history before planning the next day.

<img src="https://xtreemze.github.io/Lemonade/showcase/mobile/05-sales-history.png" alt="Lemonade sales history charts and ledger" width="390" />

[Watch the source-resolution 60 fps mobile highlight reel](https://xtreemze.github.io/Lemonade/showcase/reels/lemonade-mobile-highlight.mp4)

The capture, rendering, frame-rate, resolution, payload-budget, and publication contract is documented in [`docs/showcase.md`](docs/showcase.md).

## Why the classic works

The original game compresses business strategy into a few understandable tensions:

- **Inventory risk:** every glass costs money before demand is known, and unsold stock is wasted.
- **Price elasticity:** lower prices attract more demand; high prices can destroy it nonlinearly.
- **Advertising with diminishing returns:** signs help, but each additional sign matters less.
- **External uncertainty:** weather and occasional events can amplify or erase otherwise reasonable plans.
- **Cash discipline:** the player cannot spend money they do not have.
- **Fast feedback:** every decision resolves into a concrete daily financial report.

The released Applesoft BASIC used a 10-cent reference price, a baseline demand of 30, inverse-square demand above the reference price, an exponential diminishing-return advertising term, inventory-capped sales, and weather/event multipliers. The revival preserves this recognizable economic shape while replacing opaque globals and accidental implementation quirks with a deterministic, documented simulation model.

See [`docs/game-design.md`](docs/game-design.md) for the reverse-engineered model and modernization rules.

## Presentation

The presentation should feel like a remembered Apple II game rather than a literal pixel-art clone. The CI-authored desktop and mobile media above is the durable visual evidence for this presentation surface.

- **Vector 3D Lemonsville:** a lightweight low-poly neighborhood and lemonade stand communicate weather, customer traffic, signs, inventory, and sales activity.
- **Procedural audio:** weather reports preserve the Apple II game's recognizable historical motifs exactly; no notes are added unless they are extracted from a cited MIDI/score source. Purchase/weather effects are synthesized with Web Audio. See [`docs/weather-audio.md`](docs/weather-audio.md). Optional MIDI/SoundFont capability stays behind platform adapters.
- **Data visualization:** accessible SVG charts show cash, debt, sell-through, and inventory history without crowding the main play surface.
- **Progressive finance:** later tiers introduce operating costs, taxes, banking charges, savings/loan interest, and working-capital credit gradually.
- **Accessibility by design:** keyboard play, native form controls, reduced motion, non-color state cues, and textual equivalents for scene/chart information are core requirements.

## Architecture

Lemonade is web-first and native-platform-first: use browser standards directly when they express the requirement cleanly, and introduce libraries only where they remove substantial complexity.

```text
apps/
  web/          semantic HTML/CSS with selective Lit components, TypeScript and Vite
  desktop/      optional Tauri capability shell, only when justified
packages/
  simulation/   pure deterministic business rules
  ui/           DOM/SVG reports, projections and accessible charts
  scene/        renderer-neutral world/scene contracts; Three reference during Babylon migration
  audio/        native Web Audio + optional platform adapters
```

Lit is used selectively for the run tools, daily decision form, and day report, where it removes repetitive DOM synchronization while preserving native semantic controls. The rest of the application continues to use browser APIs directly: DOM events, `ResizeObserver`, `matchMedia`, SVG, Canvas/WebGL through the scene adapter, IndexedDB, and Web Audio. Scene and world contracts remain renderer-neutral. Lemonade is actively migrating Lemonsville from Three.js to Babylon.js under #163; Three.js remains the temporary production/reference renderer until Babylon reaches certified parity and #200 completes the cutover and removal.

The simulation accepts state, a three-variable decision, environment, and an injected random source, then returns immutable next state and a typed result. Rendering, audio, persistence, browser APIs, and any future Tauri shell are adapters around that core.

See [`docs/architecture.md`](docs/architecture.md) and the current [`docs/tooling-2026-09.md`](docs/tooling-2026-09.md) decision record.

## Tooling

The workspace deliberately keeps build tooling small and current:

- **Node 24 LTS** for automation and development.
- **pnpm 12 workspaces** for deterministic monorepo dependency management.
- **TypeScript 6** in strict mode. TypeScript 7 is stable, but adoption is intentionally held until the typed-lint toolchain officially supports it.
- **Vite 8** as the thin development/build layer for browser modules and CSS.
- **Lit 3.3** for a small set of high-churn interactive presentation components.
- **Vitest 5** for deterministic unit and invariant tests.
- **Playwright** for browser acceptance and accessibility-critical flows.
- **Biome 2.5** for strict linting/formatting, supplemented by repository-specific anti-pattern and mobile-contract policy gates.
- **3D rendering:** Three.js remains the temporary reference/runtime while Babylon.js is the target production engine under #163/#200.
- **Tauri + Rust** only if a native capability later provides a measured benefit.

CI uses the current `pnpm/setup` standalone action to provision both pnpm and Node, then performs a frozen-lockfile install. Exact resolved dependency versions live in `pnpm-lock.yaml`; generated dependency state is never hand-edited.

## Development

Requirements: Node 24 and pnpm 12.5.1, or a compatible environment that honors the repository's `packageManager` metadata.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The complete non-browser validation suite is:

```sh
pnpm check
```

Browser acceptance tests are:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

The non-negotiable mobile full-viewport contract is enforced with one command:

```sh
pnpm verify:mobile
```

This runs both the static policy check and Playwright viewport matrices. It verifies planning, simulation, report, and forecast as full-width/full-height states with no document scrolling, nested scrolling, clipped or offscreen visible flow content, and no primary interaction target below 44×44 CSS pixels. Compact portrait/landscape touch viewports and fine-pointer desktop viewports are mandatory. Larger screens may recompose the interface, but they may never release the fullscreen/no-scroll shell. The contract suite may not use skip, fixme, expected-failure, or source exemption markers.

The deterministic gameplay/balance certification report is:

```sh
pnpm certify
```

## Engineering rules

This repository is intended to remain understandable and safely modifiable by both people and AI executors. The codebase therefore optimizes for explicit invariants, deterministic behavior, narrow boundaries, standards-first implementation, and reviewable changes.

Key rules:

- Prefer native HTML, CSS, DOM and browser APIs over UI abstractions when the native platform is sufficient.
- Do not add a framework or dependency to avoid writing a small amount of straightforward platform code.
- No `Math.random()` in simulation code; inject a seedable RNG.
- No floating-point dollars in accounting; use integer cents/fixed precision.
- No DOM, UI runtime, rendering-engine, Web Audio, storage, network I/O, ambient clocks, or Tauri imports in the simulation package.
- Responsive CSS is mobile-first: narrow layouts are the default; larger layouts use ascending relative-unit `width >= …` capability queries.
- Planning, simulation, report, and forecast must each occupy the complete dynamic viewport on every device class. No document scroll, nested scroll, or vertically clipped flow content is permitted; oversized content must be split into sequential screens.
- The primary mobile action is icon-led, accessible, horizontally centered, and safe-area-aware at the bottom edge.
- Do not mask responsive defects with desktop-first `max-width` queries, `overflow-x: hidden`, legacy `100vh/100vw`, `transition: all`, or `!important`.
- Gate hover-only decoration behind fine-pointer/hover capability queries so touch remains first-class.
- Prefer discriminated unions, branded/domain types, exhaustive checks, and runtime validation at untrusted boundaries.
- Do not weaken types with `any`, broad casts, or optional fields merely to make a change compile.
- Keep side effects at adapters and make domain transformations pure.
- Every game-balance constant must have a name, purpose, and test.
- Tests must prove deterministic replay and accounting invariants.
- Lockfiles and other generated outputs are regenerated by tooling, never manually edited.

AI-specific contribution guidance is in [`AGENTS.md`](AGENTS.md).

## MVP status

The web MVP is deployed on GitHub Pages and includes:

- strict pnpm/TypeScript workspace and CI;
- deterministic Apple II-inspired simulation engine;
- the invariant three-control + one-Sell daily loop;
- low-poly vector 3D Lemonsville and weather states;
- procedural Web Audio cues;
- accessible native SVG history charts and ledger tables;
- progressive supplier fees, taxes, bank fees, interest, debt and credit;
- versioned IndexedDB persistence with deterministic reload restoration;
- portable run export/import and explicit reset/recovery behavior;
- fixed-seed balance/gameplay certification across multiple strategies;
- Chromium acceptance coverage for the complete daily loop and persistence;
- automated project-page deployment with a verified `/Lemonade/` asset base.

The project plan and design record remain under [`docs/`](docs/). Post-MVP work should improve presentation, performance, balance, accessibility, and platform capability without expanding the daily decision surface unless evidence justifies it.

## Historical references

Lemonade Stand was created by Bob Jamison at MECC in 1973 and adapted for the Apple II by Charlie Kellner in 1979. The released Apple II source is the primary reference for the revival's classic rule analysis:

- Apple II Applesoft BASIC source: https://gist.github.com/badvision/16b74ade3a8b2fa2e87d
- Background: https://en.wikipedia.org/wiki/Lemonade_Stand

The revival uses original presentation and synthesizes the weather melodies procedurally from transcribed pitch/rhythm data; it ships no recorded music or copied artwork.

## License

Lemonade is proprietary software. **All rights reserved.** No permission is granted to use, copy, modify, distribute, host, deploy, or create derivative works without prior express written permission from the copyright holder. See [`LICENSE`](LICENSE) for the controlling terms.
