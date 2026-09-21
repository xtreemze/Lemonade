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
| Lint | ESLint 10.11.x + typescript-eslint 8.70.x | Keeps strict type-aware rules while taking the latest supported ESLint improvements. |
| Unit/invariant tests | Vitest 5.0.x | Current stable major and aligned with Vite. |
| Browser acceptance | Playwright 1.63.x | Already current stable and directly certifies the production Pages artifact. |
| 3D | Three.js 0.186.x | Already current; specialized scene-graph/WebGL complexity justifies the dependency. Align its type package to the same release. |
| Styling | Native CSS | No Tailwind, CSS-in-JS, or PostCSS layer is justified at the current scale. |
| Charts | Native SVG + semantic tables | Current chart needs remain simple and deterministic. |

## Framework decision

Native platform remains the selected baseline. The current app controller is roughly 737 lines and contains about 43 explicit element bindings, 11 listener registrations, 29 direct text mutations, and multiple synchronized render paths. That is real complexity pressure, but it is better addressed first by module boundaries than by rewriting the entire application.

Lit 3.3.x is now used for the first three high-churn surfaces: run import/export/reset tools, the daily decision panel, and the day report. They render into light DOM so the existing semantic structure, global CSS, accessibility behavior, and browser tests remain stable. The controller passes immutable view models into components and receives typed DOM events back.

The history renderer remains native DOM/SVG because it is already deterministic and self-contained. Simulation, persistence codecs, audio, and Three.js adapters remain framework-independent.

Svelte 5.x is a strong compiler-first framework, but would add a compiler plugin, a new component file model, and broader rewrite cost. React 19.3 has an enormous ecosystem and stable View Transition integration, but Lemonade does not need React Server Components or a React-specific state layer. Vue 3.5 is similarly capable but adds a framework convention without a current capability gap. Solid remains attractive for fine-grained reactivity, but the app does not currently need a JSX/reactive-graph abstraction.

## Component-library decision

Continue using native controls for buttons, ranges, file inputs, tables, and simple dialogs/popovers where browser support is sufficient. Preserve the bespoke Lemonade visual language in CSS.

Web Awesome 3.x is the preferred external component-library candidate if the app later needs robust comboboxes, menus, drawers, complex dialogs, date/time widgets, tree views, or advanced selection controls. It is framework-agnostic and Web Component based, so it can coexist with native HTML or Lit. Import individual components; do not load an all-components bundle by default.

Framework-bound kits such as React/shadcn, Svelte-only kits, Vue-only kits, and Tailwind-dependent systems are not baseline choices because they would couple the visual system to a stack the product otherwise does not require.

## TypeScript 7 hold

TypeScript 7.0 is stable and attractive, but is intentionally not adopted in this transaction because the stable typescript-eslint support matrix currently documents TypeScript support only below 6.1.

Revisit TypeScript 7 when typescript-eslint officially supports it, strict typed linting passes without unsupported-version suppression, declaration/build output is stable across workspace packages, and CI/certification performance is measured before and after. Do not disable typed linting merely to reach TypeScript 7 sooner.

## Upgrade policy

- Track current stable releases inside selected major lines.
- Prefer LTS runtimes over Current releases for CI unless a concrete feature requires Current.
- Do not adopt beta or RC framework/tool releases in the production baseline.
- Dependency upgrades must regenerate the pnpm lockfile and pass pnpm check plus browser acceptance.
- Major UI migrations require a narrow architecture issue with rollback criteria.

Revisit this decision after a substantial UI expansion or when a native/platform limitation becomes concrete; do not migrate frameworks on cadence alone.
