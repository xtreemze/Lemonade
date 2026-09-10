# Lemonade

> A modern revival of the classic Lemonade Stand business simulation: three decisions, one day of sales, immediate consequences.

Lemonade is being rebuilt around the design strength of the 1979 Apple II game: an extremely small input surface that produces surprisingly rich economic trade-offs. Each day, the player reads the conditions, chooses how many glasses to prepare, how much to advertise, and what price to charge, then commits the day and sees what happened.

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

Weather and sentiment are conditions to reason about, not additional controls. Progression may add taxes, bank charges, interest, supplier costs, and other responsibilities, but the primary operating interface stays three controls plus one submit action.

## Why the classic works

The original game compresses business strategy into a few understandable tensions:

- **Inventory risk:** every glass costs money before demand is known, and unsold stock is wasted.
- **Price elasticity:** lower prices attract more demand; high prices can destroy it nonlinearly.
- **Advertising with diminishing returns:** signs help, but each additional sign matters less.
- **External uncertainty:** weather and occasional events can amplify or erase otherwise reasonable plans.
- **Cash discipline:** the player cannot spend money they do not have.
- **Fast feedback:** every decision resolves into a concrete daily financial report.

The released Applesoft BASIC used a 10-cent reference price, a baseline demand of 30, inverse-square demand above the reference price, an exponential diminishing-return advertising term, inventory-capped sales, and weather/event multipliers. The revival will preserve this recognizable economic shape while replacing opaque globals and accidental implementation quirks with a deterministic, documented simulation model.

See [`docs/game-design.md`](docs/game-design.md) for the reverse-engineered model and the modernization rules.

## Modern presentation

The new presentation should feel like a remembered Apple II game rather than a literal pixel-art clone.

- **Vector 3D Lemonsville:** a lightweight low-poly neighborhood and lemonade stand communicate weather, customer traffic, signs, inventory, and sales activity.
- **Procedural audio:** short original chiptune-like motifs and effects are generated with Web Audio. Optional MIDI/SoundFont capability may be added behind platform adapters.
- **Data visualization:** accessible vector charts show cash, profit, sell-through, price, and demand history without crowding the main play surface.
- **Progressive finance:** later tiers introduce operating costs, taxes, banking charges, savings/loan interest, and market cycles gradually.
- **Accessibility by design:** keyboard play, precise numeric entry, reduced motion/sensory modes, non-color state cues, and textual equivalents for scene/chart information are core requirements.

## Target architecture

Lemonade is web-first. Native packaging is optional and must never own the simulation rules.

```text
apps/
  web/          React + Vite browser/PWA game
  desktop/      optional Tauri 2 capability shell
packages/
  simulation/   pure deterministic business rules
  ui/           three-control loop, reports, charts, accessibility
  scene/        vector 3D neighborhood/weather renderer
  audio/        procedural Web Audio + platform adapters
  config/       shared TypeScript/lint/test configuration
```

The simulation accepts state, a three-variable decision, environment, and an injected random source, then returns immutable next state and a typed result. Rendering, audio, persistence, browser APIs, and Tauri are adapters around that core.

See [`docs/architecture.md`](docs/architecture.md).

## Tooling direction

The modernization work targets a current, conservative stack:

- **Node 24 LTS** for automation and development.
- **pnpm workspaces** for deterministic monorepo dependency management.
- **TypeScript 7** with strict compiler settings and advanced types where they encode real invariants.
- **React 19** for application UI.
- **Vite 8** for the web build.
- **Vitest 5** for unit/property tests.
- **Playwright** for browser acceptance and accessibility-critical flows.
- **Three.js-compatible rendering** for the vector 3D scene.
- **Tauri 2 + Rust**, only where native capabilities materially improve the game.

Exact patch versions belong in the generated lockfile during the workspace migration. Generated dependency files must never be hand-edited through a connector.

## Engineering rules

This repository is intended to be maintainable primarily by AI executors working through GitHub. The codebase therefore optimizes for explicit invariants, deterministic behavior, narrow boundaries, and reviewable changes.

Key rules:

- No `Math.random()` in simulation code; inject a seedable RNG.
- No floating-point dollars in accounting; use integer cents/fixed precision.
- No DOM, React, Three.js, Web Audio, storage, or Tauri imports in the simulation package.
- Prefer discriminated unions, branded/domain types, exhaustive checks, and runtime validation at untrusted boundaries.
- Do not weaken types with `any`, broad casts, or optional fields merely to make a change compile.
- Keep side effects at adapters and make domain transformations pure.
- Every game-balance constant must have a name, purpose, and test.
- Tests must prove deterministic replay and accounting invariants.
- Lockfiles and other generated outputs are regenerated by tooling, never manually edited.
- Work through focused issues and pull requests; document validation that could and could not be run.

AI-specific contribution guidance is in [`AGENTS.md`](AGENTS.md).

## Roadmap

The revival is tracked in [Epic #8](https://github.com/xtreemze/Lemonade/issues/8):

- [#1 — Modernize into a strict AI-friendly pnpm workspace](https://github.com/xtreemze/Lemonade/issues/1)
- [#2 — Deterministic Apple II-inspired simulation engine](https://github.com/xtreemze/Lemonade/issues/2)
- [#3 — Three controls + one Sell button](https://github.com/xtreemze/Lemonade/issues/3)
- [#4 — Vector 3D Lemonsville and weather](https://github.com/xtreemze/Lemonade/issues/4)
- [#5 — Procedural audio + optional MIDI/SoundFont adapters](https://github.com/xtreemze/Lemonade/issues/5)
- [#6 — Accessible charts + typed daily ledger](https://github.com/xtreemze/Lemonade/issues/6)
- [#7 — Taxes, banking costs, interest and progression](https://github.com/xtreemze/Lemonade/issues/7)

The delivery order is documented in [`docs/roadmap.md`](docs/roadmap.md).

## Current repository state

The existing implementation is a small browser game written in pre-module JavaScript with a 2017-era Webpack/Babel/Materialize toolchain. It already has the essential three inputs, weather, a sales calculation, confidence feedback, SVG animation, and progression based on accumulated profit. That implementation is useful product archaeology, but its game formula and architecture are not the target foundation.

The migration will preserve the legacy implementation until the modern daily loop reaches functional parity. Avoid destructive rewrites that make comparison impossible.

## Historical references

Lemonade Stand was created by Bob Jamison at MECC in 1973 and adapted for the Apple II by Charlie Kellner in 1979. The released Apple II source is the primary reference for the revival's classic rule analysis:

- Apple II Applesoft BASIC source: https://gist.github.com/badvision/16b74ade3a8b2fa2e87d
- Background: https://en.wikipedia.org/wiki/Lemonade_Stand

The revival uses original presentation and audio rather than copying the original game's artwork or musical excerpts.

## License

This repository is licensed under the **GNU General Public License v3.0**. See [`LICENSE`](LICENSE).