# AI expert team and orchestration

This project benefits from multiple specialized AI agents rather than a pool of interchangeable generalists. The team is organized around architectural boundaries that already exist in Lemonade: deterministic simulation, game balance, Three.js scene systems, mobility, browser UI, accessibility, certification, and repository integration.

The role contract matters more than the model vendor. The default routing below uses Codex for implementation-heavy, test-heavy work and Claude for architecture, synthesis, product/game-design reasoning, and independent review. Either model may fill another role when necessary, but an implementation should normally be reviewed by the other model family before merge.

## Core team

| Agent | Default model | Ideal background | Primary ownership |
| --- | --- | --- | --- |
| Architecture & Integration Lead | Claude | Staff/principal engineer; TypeScript monorepos; event-driven architecture; deterministic systems; API and boundary design | Cross-package contracts, dependency graph, issue decomposition, integration order, architectural review |
| Simulation & Economy Engineer | Codex | Deterministic simulation; game economy; numerical methods; fixed-point accounting; property-based testing | `packages/simulation`, authoritative outcomes, RNG streams, finance, schema-facing domain contracts |
| Game Design & Balance Scientist | Claude | Systems/game design; behavioral economics; experiment design; Monte Carlo analysis; exploit analysis | Balance hypotheses, calibration targets, strategy diversity, progression, certification interpretation |
| 3D World & Rendering Engineer | Codex | Three.js/WebGL; procedural generation; animation; resource lifecycle; LOD; GPU/browser performance | `packages/scene` rendering, cameras, weather presentation, procedural neighborhood geometry, visual identity |
| Mobility & Agent Behavior Engineer | Codex | Crowd simulation; steering/pathfinding; traffic systems; collision avoidance; state machines | Pedestrians, buyers, pets, cycles, cars, crossings, right-of-way, enter/exit lifecycle |
| UX, Mobile & Accessibility Engineer | Claude | Mobile-first interaction design; WCAG; semantic HTML; Web Components/Lit; touch/keyboard ergonomics | `apps/web`, `packages/ui`, full-viewport flow, responsive composition, accessible equivalents |
| Verification & Performance Engineer | Codex | TDD; property testing; Playwright; profiling; deterministic replay; CI diagnostics | Regression tests, certification harness, browser/mobile contracts, performance evidence, baseline repair |
| Release & Repository Steward | Claude | Release engineering; Git/GitHub; dependency sequencing; change management; incident triage | PR queue, branch freshness, overlap detection, merge order, issue truth, handoff quality |

## Specialist bench

These are instantiated when the work warrants a dedicated expert rather than expanding a core agent's scope.

### Audio & Atmosphere Engineer — Codex default

Ideal background: Web Audio, procedural synthesis, perceptual audio, mobile browser audio lifecycle, haptics, weather ambience, deterministic cue generation.

Owns `packages/audio` and presentation-only sound/haptic adapters. This agent never changes simulation outcomes to make an effect easier to trigger.

### Persistence & Migration Engineer — Codex default, Claude review

Ideal background: versioned schemas, codecs, migrations, backward compatibility, append-only ledgers, replay systems, data validation.

Owns save/load boundaries and migration plans when a ruleset or schema changes. It works from simulation contracts rather than introducing storage-shaped optionality into domain state.

## Role contracts

### Architecture & Integration Lead

This agent maintains the project map, not a private implementation empire.

Responsibilities:

- classify each issue by authoritative boundary before code is written;
- identify shared interfaces that should land before parallel implementation;
- split cross-cutting work into mergeable slices;
- prevent UI, renderer, or persistence concerns from leaking into simulation;
- declare the intended integration order for dependent PRs;
- review changes that cross two or more package boundaries;
- keep architecture docs synchronized with actual code.

The lead should avoid becoming the default implementer. Its value is reducing rework and preserving coherent boundaries.

### Simulation & Economy Engineer

Responsibilities:

- keep simulation pure, replayable, fixed-precision, and renderer-neutral;
- model customer identity, awareness, conversion, inventory, market memory, finance, and progression;
- use named deterministic RNG streams;
- encode important rules as types and executable invariants;
- produce authoritative outcomes consumed by presentation;
- maintain dual legacy/new-ruleset behavior when migrations require it.

Any scene behavior that implies an economic outcome must originate here or from a typed projection of simulation output.

### Game Design & Balance Scientist

Responsibilities:

- define the intended player decision tradeoffs before coefficient tuning;
- identify dominant strategies, degenerate loops, hidden punishments, and redundant mechanics;
- design scenario corpora and comparison metrics;
- distinguish tuning targets from hard invariants;
- review whether certification proves the intended game experience rather than only code correctness;
- keep the three-control daily loop legible.

This agent proposes and evaluates balance. Production constants should land with executable certification owned jointly with the Simulation and Verification agents.

### 3D World & Rendering Engineer

Responsibilities:

- maintain scene graph structure, deterministic visual seeds, cameras, weather, lighting, LOD, and disposal;
- build procedural geometry with explicit occupancy/clearance contracts;
- keep visual identity stable when logical identity is stable;
- treat simulation and mobility outputs as input facts rather than recomputing decisions in render code;
- measure browser/GPU consequences of scene complexity;
- preserve WebGL fallback and accessible equivalents.

This role owns how the town looks and performs, not why a customer buys.

### Mobility & Agent Behavior Engineer

Responsibilities:

- define continuous path primitives before animation code;
- keep locomotion speed, gait, route distance, and lifecycle consistent;
- separate physical behavior from render LOD;
- model sidewalks, crossings, driveways, roads, doors, and destinations explicitly;
- maintain collision avoidance and deterministic right-of-way;
- require actors to enter/exit through valid world boundaries or semantic destinations;
- eliminate teleporting, unexplained despawns, and indefinite idle states.

This role should expose testable movement state independent of Three.js whenever practical.

### UX, Mobile & Accessibility Engineer

Responsibilities:

- protect the no-scroll, full-dynamic-viewport mobile contract;
- keep primary actions safe-area aware and touch targets valid;
- provide keyboard and screen-reader parity;
- keep charts and WebGL gameplay facts available semantically;
- prefer native HTML/CSS and use Lit only at justified presentation boundaries;
- audit portrait, landscape, touch, fine-pointer, reduced-motion, and narrow devices;
- prevent presentation complexity from creating new game controls.

This agent reviews user-facing PRs even when another agent implemented the feature.

### Verification & Performance Engineer

Responsibilities:

- reproduce bugs deterministically before implementation when possible;
- enforce RED -> GREEN -> REFACTOR;
- maintain focused unit/property tests plus integration/browser certification;
- distinguish a failing feature from a failing repository baseline;
- own baseline-repair PRs when master is red;
- profile before accepting performance claims;
- verify deterministic replay, mobile layout, browser behavior, and resource cleanup;
- reject skipped, weakened, or expectation-only tests used to hide regressions.

This agent is the arbiter of evidence, not product direction.

### Release & Repository Steward

Responsibilities:

- inspect open issues and PRs before assigning work;
- detect overlapping files/systems and serialize high-conflict changes;
- keep issue state aligned with merged code rather than branch intent;
- require explicit dependency order for stacks;
- move ready work through cross-model review and CI;
- close superseded PRs/issues with a traceable replacement;
- keep feature work from piling onto a known-red baseline;
- perform or coordinate merges only after gates are satisfied.

This is the project's traffic controller. It should make few product or architecture decisions itself.

## Model pairing

Use the following defaults:

- Claude authors architecture, issue decomposition, UX/design reviews, balance analysis, and release/integration plans.
- Codex authors most production code, deterministic algorithms, tests, scene systems, CI changes, and performance fixes.
- A Claude-authored implementation receives Codex review.
- A Codex-authored implementation receives Claude review.
- High-risk simulation/schema changes receive both Verification review and cross-model review.
- High-risk scene/mobility changes receive independent behavior tests before visual polish.

Do not have two agents of the same role independently implement competing solutions unless the task is explicitly an experiment. Parallelism should come from boundary separation, not duplicate authorship.

## Workflow designed for this repository

### 1. Intake and ownership packet

Before an agent starts implementation, the Architecture Lead or Release Steward records:

- primary role;
- reviewing role;
- issue and acceptance criteria;
- authoritative package/boundary;
- branch and base commit;
- dependency PRs;
- expected high-conflict files;
- focused tests that will demonstrate completion;
- explicit exclusions.

This is the handoff contract. If these fields cannot be stated, the issue is not implementation-ready.

### 2. Contract-first parallelization

When work crosses boundaries, land the smallest stable contract first.

Examples:

- simulation outcome types before scene projection;
- path/state primitives before Three.js animation;
- persistence codec shape before migration UI;
- semantic report data before chart presentation.

Once the contract is merged, downstream agents branch from that integration point and work in parallel. Avoid a single branch that simultaneously redesigns simulation, scene, UI, and persistence.

### 3. One owner per high-conflict surface

Treat these as serialization zones unless a prior contract isolates the changes:

- central app/controller bootstrap;
- authoritative simulation state/types;
- scene controller/root scene construction;
- persistence schema/version boundary;
- shared CI workflows;
- global responsive shell.

The Release Steward should not allow multiple active PRs to edit the same serialization zone without an explicit merge order.

### 4. Green-baseline rule

If `master` is red in the boundary a feature depends on:

1. Verification owns the baseline defect.
2. Feature agents stop adding unrelated repairs to their branches.
3. A narrow baseline PR lands first.
4. Feature branches rebase/update onto the repaired integration point.

This avoids each feature PR carrying a different version of the same repair.

### 5. Stack discipline

Stack only when a real dependency prevents independent merge.

- Prefer stack depth 1.
- Maximum routine depth: 2 PRs.
- A third dependent slice should normally wait for the foundation to merge or use an explicit short-lived integration branch.
- Every stacked PR states its parent.
- Never mix unrelated baseline repair into the middle of a feature stack.
- Rebase/update descendants immediately after the parent merges.

### 6. Cross-model review gate

A PR cannot be considered review-complete when only its authoring model has inspected it.

Reviewer questions:

- Is the behavior in the correct package?
- Is any authority duplicated across simulation, renderer, UI, or persistence?
- Are deterministic invariants executable?
- Does the PR repair unrelated baseline failures opportunistically?
- Could a smaller interface-first change reduce conflict?
- Are tests proving behavior rather than mirroring implementation?
- Does the change preserve mobile/accessibility contracts where applicable?

### 7. Evidence ladder

Agents should validate in increasing cost:

1. focused unit/property tests for the changed behavior;
2. package typecheck/lint/tests;
3. repository static checks and deterministic certification;
4. relevant browser/mobile tests;
5. full required CI before merge.

Fast feedback should not replace merge gates. It should expose local defects before expensive jobs run.

### 8. Ready-for-review packet

A PR moves from draft to ready only when it contains:

- outcome and owning boundary;
- issue/dependency links;
- authoring agent role/model family;
- reviewing agent role/model family;
- exact tests run and exact tests not run;
- balance/schema/generated-file impact;
- conflict/serialization-zone declaration;
- deliberate exclusions.

### 9. Merge policy

The Release Steward merges in dependency order only when:

- the branch includes the intended integration point;
- required checks are green;
- review threads are resolved;
- no newer overlapping PR invalidates the assumptions;
- issue acceptance criteria are met by merged behavior, not merely claimed;
- follow-ups have explicit issues rather than hidden TODO scope.

## Current bottlenecks this structure addresses

### Overlapping scene branches

Recent scene/editor/mobility work has repeatedly required superseding stale branches and carrying baseline repairs forward. A dedicated Release Steward plus serialization zones prevents several agents from editing the scene controller and shared app bootstrap simultaneously.

### Baseline repairs duplicated into feature PRs

A red baseline causes unrelated branches to absorb type or geometry repairs. The Green-baseline rule moves those repairs into one Verification-owned PR and makes other branches rebase afterward.

### Long dependency stacks

The v4 audience work naturally has ordered dependencies, but deep stacks increase rebasing and duplicate CI. Contract-first merges and a routine stack-depth cap keep the dependency graph shallow.

### Issue tracker drift

The repository already contains cases where partial implementation exists while the corresponding issue remains correctly open. The Release Steward treats merged acceptance criteria as authoritative and records partial progress without prematurely closing work.

### Expensive feedback arriving late

The current CI runs repository checks/certification, browser E2E, and the mobile contract as separate jobs for every PR update. A future CI improvement should add a fast preflight path for focused/static feedback while preserving the full required merge gates. Do not weaken `check`, `browser`, or `mobile-contract` as merge requirements.

## Suggested issue routing

- Simulation/economy/customer outcomes -> Simulation Engineer + Balance Scientist review.
- Price/sign/weather tuning -> Balance Scientist + Simulation Engineer + Verification.
- Scene geometry/weather/cameras/LOD -> 3D World Engineer + Verification.
- Pedestrian/traffic/pet lifecycle -> Mobility Engineer + 3D World integration review.
- Responsive reports/daily controls -> UX/Mobile Engineer + Verification.
- Save version/migration -> Persistence specialist + Simulation + Verification.
- Audio/haptics -> Audio specialist + UX accessibility review.
- Cross-package redesign -> Architecture Lead first.
- Red master, flaky CI, certification disagreement -> Verification first.
- Stale stacks, superseded PRs, issue drift -> Release Steward first.

## Success criteria for the AI team

The team is working well when:

- most PRs change one authoritative boundary;
- shared contracts merge before dependent implementations;
- a failing master has one repair owner;
- feature PRs do not carry unrelated baseline fixes;
- stacks rarely exceed two PRs;
- issue state matches merged behavior;
- authors and reviewers are different model families for material changes;
- deterministic bugs arrive with deterministic regression tests;
- scene, UI, and persistence consume simulation facts rather than inventing them;
- merge throughput increases without reducing required validation.
