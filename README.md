# Lemonade

> A modern revival of the classic Lemonade Stand business simulation: three decisions, one day of sales, immediate consequences.

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

The presentation should feel like a remembered Apple II game rather than a literal pixel-art clone.

- **Vector 3D Lemonsville:** a lightweight low-poly neighborhood and lemonade stand communicate weather, customer traffic, signs, inventory, and sales activity.
- **Procedural audio:** original short motifs and effects are generated with the browser's Web Audio API. Optional MIDI/SoundFont capability stays behind platform adapters.
- **Data visualization:** accessible SVG charts show cash, debt, sell-through, and inventory history without crowding the main play surface.
- **Progressive finance:** later tiers introduce operating costs, taxes, banking charges, savings/loan interest, and working-capital credit gradually.
- **Accessibility by design:** keyboard play, native form controls, reduced motion, non-color state cues, and textual equivalents for scene/chart information are core requirements.

## Architecture

Lemonade is web-first and native-platform-first: use browser standards directly when they express the requirement cleanly, and introduce libraries only where they remove substantial complexity.

```text
apps/
  web/          native HTML + DOM + CSS, composed with TypeScript and Vite
  desktop/      optional Tauri capability shell, only when justified
packages/
  simulation/   pure deterministic business rules
  ui/           DOM/SVG reports, projections and accessible charts
  scene/        Three.js low-poly neighborhood/weather renderer
  audio/        native Web Audio + optional platform adapters
```

There is no application UI framework at runtime. The web application uses semantic HTML, native controls, DOM events, `ResizeObserver`, `matchMedia`, SVG, Canvas/WebGL through the scene adapter, and Web Audio directly. Three.js remains because replacing a compact 3D scene graph with hand-written WebGL would increase complexity without improving the game architecture.

The simulation accepts state, a three-variable decision, environment, and an injected random source, then returns immutable next state and a typed result. Rendering, audio, persistence, browser APIs, and any future Tauri shell are adapters around that core.

See [`docs/architecture.md`](docs/architecture.md).

## Tooling

The workspace deliberately keeps build tooling small and current:

- **Node 24 LTS** for automation and development.
- **pnpm 12 workspaces** for deterministic monorepo dependency management.
- **TypeScript 6** in strict mode, with migration compatibility for the upcoming native TypeScript compiler treated as a design constraint.
- **Vite 8** as the thin development/build layer for native browser modules and CSS.
- **Vitest 5** for deterministic unit and invariant tests.
- **Playwright** for browser acceptance and accessibility-critical flows.
- **ESLint flat config** with type-aware strict rules.
- **Three.js** only for the 3D rendering problem it materially simplifies.
- **Tauri + Rust** only if a native capability later provides a measured benefit.

CI uses the current `pnpm/setup` standalone action to provision both pnpm and Node, then performs a frozen-lockfile install. Exact resolved dependency versions live in `pnpm-lock.yaml`; generated dependency state is never hand-edited.

## Development

Requirements: Node 24 and pnpm 12.4.0, or a compatible environment that honors the repository's `packageManager` metadata.

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

## Engineering rules

This repository is intended to remain understandable and safely modifiable by both people and AI executors. The codebase therefore optimizes for explicit invariants, deterministic behavior, narrow boundaries, standards-first implementation, and reviewable changes.

Key rules:

- Prefer native HTML, CSS, DOM and browser APIs over UI abstractions when the native platform is sufficient.
- Do not add a framework or dependency to avoid writing a small amount of straightforward platform code.
- No `Math.random()` in simulation code; inject a seedable RNG.
- No floating-point dollars in accounting; use integer cents/fixed precision.
- No DOM, UI runtime, Three.js, Web Audio, storage, or Tauri imports in the simulation package.
- Prefer discriminated unions, branded/domain types, exhaustive checks, and runtime validation at untrusted boundaries.
- Do not weaken types with `any`, broad casts, or optional fields merely to make a change compile.
- Keep side effects at adapters and make domain transformations pure.
- Every game-balance constant must have a name, purpose, and test.
- Tests must prove deterministic replay and accounting invariants.
- Lockfiles and other generated outputs are regenerated by tooling, never manually edited.

AI-specific contribution guidance is in [`AGENTS.md`](AGENTS.md).

## Implemented revival slices

The current revival includes:

- strict pnpm/TypeScript workspace and CI;
- deterministic Apple II-inspired simulation engine;
- the invariant three-control + one-Sell daily loop;
- low-poly vector 3D Lemonsville and weather states;
- procedural Web Audio cues;
- accessible native SVG history charts and ledger tables;
- progressive supplier fees, taxes, bank fees, interest, debt and credit.

The project plan and design record remain under [`docs/`](docs/).

## Historical references

Lemonade Stand was created by Bob Jamison at MECC in 1973 and adapted for the Apple II by Charlie Kellner in 1979. The released Apple II source is the primary reference for the revival's classic rule analysis:

- Apple II Applesoft BASIC source: https://gist.github.com/badvision/16b74ade3a8b2fa2e87d
- Background: https://en.wikipedia.org/wiki/Lemonade_Stand

The revival uses original presentation and audio rather than copying the original game's artwork or musical excerpts.

## License

This repository is licensed under the **GNU General Public License v3.0**. See [`LICENSE`](LICENSE).
