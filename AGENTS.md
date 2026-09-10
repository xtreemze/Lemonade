# AI Executor Contract

Lemonade is maintained primarily by AI executors operating either through GitHub-connected tools or, when execution is required, through a local clone. Optimize every change for deterministic review, explicit invariants, and safe concurrent work.

## Working model

1. Inspect relevant open issues and pull requests before editing overlapping areas.
2. Prefer one focused issue per coherent change and a narrow PR that can be reviewed independently.
3. Branch from the current default branch. Do not force-push shared work or rewrite another executor's branch history.
4. Make source-of-truth changes, not generated-output substitutions.
5. State validation precisely in the PR. If a command could not be executed through the current environment, say so rather than implying it passed.
6. Merge only after required checks and review concerns are satisfied. Documentation-only changes may use proportionate validation.

## Connector-first contributions

GitHub connector work should be sufficient for most documentation, source, configuration, issue, and review changes.

Use a local executor when a change genuinely requires execution, especially:

- regenerating `pnpm-lock.yaml` after dependency changes;
- running build/test commands that cannot be represented by existing CI;
- producing generated artifacts;
- measuring browser, GPU, audio, or native performance;
- validating Tauri/Rust platform behavior.

Never hand-edit a lockfile or fabricate generated output simply to avoid local execution.

## TypeScript rules

TypeScript is a modeling tool, not an annotation tax.

- Enable strict compiler behavior across the workspace, including `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`, `noImplicitOverride`, and `noFallthroughCasesInSwitch` where applicable.
- Do not introduce `any` unless an external type definition makes it unavoidable; isolate and document that boundary.
- Avoid broad type assertions. Validate unknown external data, then narrow it.
- Use discriminated unions for state machines and variant-rich domain concepts.
- Use branded/opaque types when two primitives have materially different meanings, especially money, counts, seeds, day numbers, percentages, and IDs.
- Prefer exhaustive `switch` handling with a `never` assertion for closed unions.
- Make impossible states unrepresentable when the resulting types remain understandable.
- Do not make properties optional to avoid constructing a complete domain state.
- Parse at boundaries; operate on validated domain types internally.

## Simulation rules

`packages/simulation` is the authoritative business model and must remain pure.

It may not import browser globals, DOM APIs, React, Three.js, Web Audio, persistence implementations, analytics services, or Tauri.

Required invariants:

- Money is integer cents or another explicitly documented fixed-precision type. Never account in floating-point dollars.
- Quantities such as glasses and signs are validated non-negative integers.
- Randomness is injected. `Math.random()` is forbidden in domain logic.
- Simulation outputs depend only on explicit inputs.
- A game can be replayed from initial state, seed/environment sequence, and player decisions.
- Inventory caps sales.
- Every expense/revenue/adjustment is named in the ledger.
- Every clamp, multiplier, rounding policy, and unlock condition is documented and tested.
- Presentation timing can never alter simulation results.

## State and persistence

Persisted data is untrusted input.

- Every save payload has an explicit schema version.
- Validate and migrate at the storage boundary.
- Do not leak storage-specific optionality into domain types.
- Keep an append-only or reproducible daily financial ledger so charts and reports do not recompute historical rules using new balance constants.

## UI rules

The core daily decision surface has exactly three player-controlled variables:

1. glasses to prepare;
2. advertising signs;
3. price per glass.

It has one primary submit action. Weather, market sentiment, financial obligations, progression, charts, and scene state provide information or consequences; they do not casually become new mandatory daily controls.

- Preserve precise keyboard entry in addition to sliders/ranges.
- Do not rely on color, animation, hover, or audio as the sole carrier of gameplay information.
- Honor reduced-motion/reduced-sensory preferences.
- Canvas/WebGL gameplay information requires a textual equivalent.
- Charts require keyboard-accessible values and a table or equivalent textual representation.

## Rendering rules

- 3D is an adapter driven by typed render state derived from the domain.
- Favor low-poly/vector geometry, instancing, simple materials, bounded DPR, and explicit quality tiers.
- Provide a usable fallback if WebGL is unavailable.
- Do not put economic rules in shaders, render loops, animation callbacks, or React components.
- Visual randomness uses a presentation seed separate from simulation randomness.

## Audio rules

- Core browser audio uses Web Audio and original procedural motifs/effects.
- Audio starts only after a user gesture and must recover from suspend/resume.
- Audio must be optional and cannot change game results.
- MIDI and SoundFont support are platform adapters. Do not assume browsers can access an operating system's General MIDI soundbank.
- Avoid copying copyrighted musical phrases from the 1979 game.

## Rust/Tauri rules

Tauri is optional capability infrastructure, not the application architecture.

Introduce Rust only when it materially provides a native capability, reliability, performance, storage, MIDI/audio, or packaging advantage that the web layer cannot provide cleanly.

- Keep Tauri commands narrow and typed.
- Validate all IPC payloads.
- Minimize permissions/capabilities.
- Keep the deterministic simulation in the shared domain package unless a measured reason justifies a separate native implementation.
- If logic exists in more than one language, establish conformance fixtures so implementations cannot drift silently.

## Testing expectations

Domain changes require tests proportional to their invariants.

Minimum categories:

- golden examples for documented classic-demand behavior;
- deterministic replay tests;
- property tests for accounting conservation and inventory limits;
- progression boundary/rounding tests;
- component tests for decision validation;
- Playwright coverage for a complete keyboard-only day;
- reduced-motion and non-WebGL fallbacks for presentation work.

Bug fixes should include a regression test whenever the bug is representable deterministically.

## Pull request standard

A PR should answer:

- What invariant or user outcome changes?
- Which issue does it advance?
- Which package/boundary owns the behavior?
- What tests or checks were run?
- What could not be run in the current executor environment?
- Does it change game balance or persisted data?
- Does it introduce or modify generated files?
- Are there follow-up tasks deliberately excluded from scope?

Prefer small, explicit diffs over clever generalization. A future AI executor should be able to understand why the code exists from types, tests, names, and nearby documentation without reconstructing hidden context.