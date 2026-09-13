# MVP release certification

Lemonade uses an internal release-certification gate for the browser MVP. This is a repeatable engineering/product release standard, not a claim of third-party certification or formal conformance to every requirement of an external standard.

## Certified surface

The certified MVP is the static browser application deployed beneath the GitHub Pages project path `/Lemonade/`.

The release surface includes:

- the three operating decisions: glasses, signs, and price;
- the single daily Sell action and day report;
- deterministic weather, sentiment, exceptional events, and finance progression;
- the immutable financial ledger and accessible chart/table history;
- vector 3D presentation plus textual scene equivalence;
- procedural Web Audio with explicit user activation;
- IndexedDB run persistence, reload restoration, import/export, reset, recovery, and in-memory degradation when durable storage fails.

Optional Tauri/native capabilities are outside the browser MVP certification boundary until a concrete native product benefit is demonstrated.

## Required gates

A revision is release-certified only when all of the following pass for the same `master` revision:

1. `pnpm check`
   - strict TypeScript;
   - type-aware ESLint;
   - unit/invariant tests;
   - production workspace build.
2. `pnpm certify`
   - the fixed deterministic strategy/seed corpus;
   - accounting, inventory, progression, demand, environment, and finance guardrails;
   - deterministic human-reviewable balance output.
3. `pnpm test:e2e`
   - Playwright runs against a built Vite production bundle, not the development server;
   - the bundle and preview use the same `/Lemonade/` base path as GitHub Pages;
   - keyboard daily-loop completion;
   - affordability validation;
   - report and next-day reload restoration;
   - clean-profile export/import portability;
   - no uncaught page or console errors through the certified daily flow;
   - 360 px viewport containment without document-level horizontal overflow;
   - semantic table equivalents for historical charts;
   - reduced-motion media behavior;
   - playable in-memory degradation when IndexedDB fails.
4. GitHub Pages bundle verification
   - `apps/web/dist/index.html` exists;
   - generated asset URLs use `/Lemonade/assets/`.
5. Post-merge deployment
   - CI passes again on `master`;
   - the Pages publisher successfully builds and pushes that revision to `gh-pages`.

The exact `master` and deployment revisions for a certification event are recorded on the certification issue so the evidence cannot become ambiguous as development continues.

## Balance evidence

Balance certification is intentionally based on ranges and directional guardrails rather than one golden outcome. The corpus currently covers conservative, aggressive inventory, advertising-heavy, high-price, intentionally poor, adaptive, and progression strategies across sixteen fixed seeds and a 90-day horizon.

Changing a balance guardrail is a product decision. It must include the intended player-behavior rationale and note any simulation-schema or deterministic replay implications.

## Accessibility boundary

Release certification verifies the accessibility-critical behaviors implemented by the project: semantic native controls, keyboard operation, accessible chart/table equivalents, nonvisual scene text, reduced-motion behavior, responsive containment, and status/error messaging.

It does not represent an external WCAG audit or accessibility certification. If the project later claims a particular WCAG conformance level, that claim requires a separate criterion-by-criterion audit with documented evidence.

## Certification maintenance

Do not weaken a release assertion merely because a legitimate product regression makes CI fail. Fix the regression or explicitly revise the certification contract with rationale. New mandatory daily controls require product-level review because the three-decision operating surface is a core game invariant.
