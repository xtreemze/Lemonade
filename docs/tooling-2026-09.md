# Tooling re-evaluation — September 2026

This review rechecks the Lemonade web stack after the MVP, with two goals: use current supported tooling and avoid adding abstraction that does not pay for itself. Reviewed against stable releases available on 2026-09-21.

## Decision summary

| Area | Decision | Rationale |
| --- | --- | --- |
| Browser UI | Keep semantic HTML/CSS/DOM as the application baseline | The product still has a deliberately small interaction surface and benefits from native form semantics, low runtime overhead, and direct accessibility behavior. |
| UI framework | Use Lit 3.3.x selectively for interactive presentation components; do not migrate the whole application | The main pressure is imperative rendering/lifecycle boilerplate, not routing, SSR, server state, or a large component ecosystem. Lit addresses that pressure while staying on Web Components and requiring no Vite-specific compiler plugin. |
| Component library | Keep no external library by default; use Web Awesome 3.x only for genuinely complex widgets | The current controls are buttons, ranges, file input, tables, and report surfaces that native HTML already expresses well. |
| Build | Vite 8.3.x | Current stable Vite 8 line; Rolldown-based production build remains a good fit for a static GitHub Pages application. |
| Runtime | Node 24 LTS | Prefer the active LTS line over Node 26 Current for CI and contributor reproducibility. |
| Package manager | pnpm 12.5.x | Current stable pnpm 12 line. |
| Language | TypeScript 6.0.x for now | TypeScript 7 is stable, but stable typescript-eslint currently documents support below TypeScript 6.1. Keep supported typed linting rather than forcing an unsupported pairing. |
| Lint/format | Biome 2.5.x + repository policy gates | Biome is the workspace lint/format baseline; focused repository checks enforce simulation and responsive/mobile invariants that are more naturally expressed as project policy. |
| Unit/invariant tests | Vitest 5.0.x | Current stable major and aligned with Vite. |
| Browser acceptance | Playwright 1.63.x | Already current stable and directly certifies the production Pages artifact. |
| 3D | Three.js 0.186.x reference runtime -> Babylon.js target | #163 makes Babylon.js the production target. Keep Three.js only as temporary parity/reference infrastructure until #200 certifies cutover and removes it. |
| Styling | Native CSS, mobile-first | No Tailwind, CSS-in-JS, PostCSS, or Stylelint dependency is justified at the current scale; project-specific policy checks are small enough to keep native. |
| Charts | Native SVG + semantic tables | Current chart needs remain simple and deterministic. |

## Framework decision

Native platform remains the selected baseline. The current app controller is roughly 737 lines and contains about 43 explicit element bindings, 11 listener registrations, 29 direct text mutations, and multiple synchronized render paths. That is real complexity pressure, but it is better addressed first by module boundaries than by rewriting the entire application.

Lit 3.3.x is now used for the first three high-churn surfaces: run import/export/reset tools, the daily decision panel, and the day report. They render into light DOM so the existing semantic structure, global CSS, accessibility behavior, and browser tests remain stable. The controller passes immutable view models into components and receives typed DOM events back.

The history renderer remains native DOM/SVG because it is already deterministic and self-contained. Simulation, persistence codecs, audio, and renderer adapters remain framework-independent.

Svelte 5.x is a strong compiler-first framework, but would add a compiler plugin, a new component file model, and broader rewrite cost. React 19.3 has an enormous ecosystem and stable View Transition integration, but Lemonade does not need React Server Components or a React-specific state layer. Vue 3.5 is similarly capable but adds a framework convention without a current capability gap. Solid remains attractive for fine-grained reactivity, but the app does not currently need a JSX/reactive-graph abstraction.

## Component-library decision

Continue using native controls for buttons, ranges, file inputs, tables, and simple dialogs/popovers where browser support is sufficient. Preserve the bespoke Lemonade visual language in CSS.

Web Awesome 3.x is the preferred external component-library candidate if the app later needs robust comboboxes, menus, drawers, complex dialogs, date/time widgets, tree views, or advanced selection controls. It is framework-agnostic and Web Component based, so it can coexist with native HTML or Lit. Import individual components; do not load an all-components bundle by default.

Framework-bound kits such as React/shadcn, Svelte-only kits, Vue-only kits, and Tailwind-dependent systems are not baseline choices because they would couple the visual system to a stack the product otherwise does not require.

## Enforced lint policy

The lint contract intentionally combines the strictest practical type-aware TypeScript baseline with project-specific repository rules rather than adding another general-purpose dependency.

Biome is the baseline linter/formatter. Deterministic-domain and repository-specific architectural constraints that are not adequately represented by generic lint rules remain explicit project policy gates: browser/device globals, network I/O, ambient timers/clocks, `Math.random()`, rendering/UI imports, Node APIs, and platform runtimes are rejected from authoritative simulation code.

A dependency-free repository policy check scans authored CSS under `apps/` and `packages/`. It rejects:

- desktop-first `max-width`/descending width queries;
- legacy `min-width:` media syntax in favor of modern ascending range syntax;
- pixel-based responsive breakpoints;
- legacy `100vh/100vw` viewport sizing;
- `overflow-x: hidden/clip` used to conceal responsive defects;
- `transition: all`;
- `!important`;
- hover decoration outside `(hover: hover) and (pointer: fine)` capability queries.

The existing narrow-viewport Playwright certification remains the runtime backstop for overflow and accessible data presentation. Static policy prevents known regressions from being introduced; browser tests verify that the composed layout still behaves correctly.

## TypeScript baseline

TypeScript 6 remains the current workspace baseline. A TypeScript major upgrade should be evaluated against compiler behavior, Biome support, declaration/build output, repository policy checks, and CI/browser certification. Do not retain or reintroduce an ESLint/typescript-eslint dependency solely to justify a TypeScript version decision.

## Upgrade policy

- Track current stable releases inside selected major lines.
- Prefer LTS runtimes over Current releases for CI unless a concrete feature requires Current.
- Do not adopt beta or RC framework/tool releases in the production baseline.
- Dependency upgrades must regenerate the pnpm lockfile and pass pnpm check plus browser acceptance.
- Major UI migrations require a narrow architecture issue with rollback criteria.

Revisit this decision after a substantial UI expansion or when a native/platform limitation becomes concrete; do not migrate frameworks on cadence alone.


## CI feedback tiers for AI and draft work

Pull-request CI uses two explicit tiers so iteration can be fast without weakening release evidence.

### Draft preflight

A pull request that is still a draft runs only the `preflight` job on open, synchronize, reopen, or conversion back to draft. Preflight installs the frozen dependency graph, runs the complete TypeScript typecheck, and runs Biome plus the repository policy/mobile static lint gates. It deliberately does not install Playwright browsers, run unit/build certification, run the deterministic balance certification, or build the GitHub Pages artifact.

This tier is feedback only. A draft cannot use preflight as merge evidence.

### Ready and master certification

The existing merge-facing job names remain stable:

- `check`: `pnpm check`, deterministic `pnpm certify`, and GitHub Pages bundle verification;
- `browser`: full Playwright E2E plus browser certification evidence upload;
- `mobile-contract`: the complete `pnpm verify:mobile` contract.

These three jobs run when a pull request becomes ready for review, on every subsequent synchronization while it remains ready, and on pushes to `master`. The `ready_for_review` activity is explicitly subscribed so moving a green draft to ready always produces a fresh full-certification run for that exact head SHA.

PR workflow runs use per-PR concurrency with cancellation of superseded runs. Pushes to `master` are not cancelled. This avoids spending CI capacity on obsolete draft/PR commits while preserving complete evidence for the current merge candidate.

Branch/ruleset protection tracked in #61 must require the stable `check`, `browser`, and `mobile-contract` contexts. `preflight` is intentionally not a merge requirement.
