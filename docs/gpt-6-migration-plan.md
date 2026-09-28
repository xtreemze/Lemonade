# GPT-6 migration readiness plan

## Decision summary

Lemonade does not currently call the OpenAI API at runtime. The only model-sensitive
surface in this repository is the AI executor routing policy in
[`docs/ai-agent-team.md`](ai-agent-team.md), plus the supporting executor guidance in
`AGENTS.md` and `CLAUDE.md`. Consequently, this is an **executor-tooling migration**, not
a game, browser, simulation, persistence, or dependency migration.

Do not put a guessed `gpt-6` model identifier into repository policy. Start the
cutover only after OpenAI publishes a supported model ID and migration guidance for
the Codex surface used by the team. Until then, retain the current role-based routing.
The target is the appropriate published GPT-6-family model for each workload, not a
blanket replacement of every model name.

## Current evidence and constraints

- A repository-wide inventory found no OpenAI SDK dependency, API client, prompt
  template, model string, or production inference path. Occurrences of "model" in
  application code describe game, UI, or scene data models.
- The current routing contract assigns implementation-heavy and verification work to
  Codex, while architecture, product synthesis, UX, balance, release stewardship, and
  independent review default to Claude. The role contract explicitly matters more
  than the vendor.
- The existing cross-model review gate is a quality and independence control. A GPT-6
  migration must not silently turn author and reviewer into the same model family.
- No currently open issue or pull request discovered during this plan directly changes
  AI model routing. Recheck this immediately before implementation because repository
  state is time-sensitive.
- The official OpenAI documentation MCP server, official web lookup, and the local
  `codex` CLI were unavailable in the planning executor. The bundled OpenAI Docs skill
  fallback described GPT-5.5 as its provisional latest/default general model, not
  GPT-6. This fallback is explicitly non-authoritative until verified against current
  official documentation.

## Scope

### In scope

1. Verify the released GPT-6-family model IDs, availability, supported Codex surfaces,
   reasoning controls, context limits, tool behavior, and migration guidance from
   current official OpenAI documentation.
2. Evaluate GPT-6 candidates against Lemonade's existing specialist roles and checks.
3. Update only the model-routing and executor configuration that actually selects a
   model.
4. Preserve role ownership, package boundaries, deterministic validation, independent
   review, and an immediate rollback path.
5. Record measured quality, latency, token usage, tool-loop count, and failure modes.

### Out of scope

- Adding AI features to the Lemonade game.
- Adding an OpenAI SDK or API key to the application.
- Changing simulation rules, balance, save schemas, UI, rendering, audio, or generated
  showcase media.
- Rewriting prompts merely to modernize their style before an eval demonstrates a
  behavioral need.
- Replacing Claude in roles where it provides the required independent model-family
  review without a separately approved review-policy change.
- Changing SDKs, API surfaces, tool schemas, authentication, connectors, or provider
  infrastructure as part of a model-string-only pull request.

## Target selection gate

The Release & Repository Steward owns the gate, with the Architecture & Integration
Lead approving the mapping and the Verification & Performance Engineer owning the
evidence. Do not open the implementation PR until every required row is resolved.

| Question | Required evidence | Stop condition |
| --- | --- | --- |
| Is GPT-6 publicly documented for the team's Codex surface? | Current official OpenAI model and Codex documentation, including the exact model ID | Stop if the identifier or surface support is inferred, private, preview-only without approval, or undocumented |
| Which GPT-6 variant fits implementation and verification? | Official capability guidance plus repository task evals | Stop if a general model is being selected solely because its name is newer |
| Can the current host select it without integration changes? | A successful isolated configuration smoke test | Split API, SDK, auth, or tool rewiring into a prerequisite PR |
| Are reasoning and verbosity settings compatible? | Documented parameter support and an observed run | Preserve current settings initially; do not invent new settings |
| Does it preserve tool and terminal behavior? | Representative tool-heavy tasks with command/result auditing | Stop on malformed calls, missing validation, unsafe scope expansion, or repeated loops |
| Does independent review remain independent? | An explicit author/reviewer model-family mapping | Stop if one model family would author and solely approve material work |
| Is rollout access stable enough for required work? | Account/workspace availability and a documented fallback | Stop if required CI or executor paths cannot consistently select the model |

### Provisional role mapping

Use this only as a hypothesis for evaluation; replace placeholders with exact published
model IDs after the target-selection gate.

| Workload | Candidate | Initial posture |
| --- | --- | --- |
| Production implementation, tests, repository fixes, performance work | Published GPT-6 coding/Codex model, if OpenAI documents one for this surface | Primary candidate; compare with the current Codex baseline |
| Architecture or cross-package synthesis | Published GPT-6 general reasoning model | Trial only; retain the current Claude default until it wins the role eval and review independence is preserved |
| UX, game design, balance, and release planning | Published GPT-6 general reasoning model | Trial only; judge domain outcomes rather than generic benchmark claims |
| Low-cost triage or repetitive maintenance | Published smaller GPT-6 variant, if any | Use only after cost/latency and correctness thresholds pass |
| Cross-model review | A model family different from the authoring family | Mandatory for material changes; do not route both sides to GPT-6 by default |

## Phased migration

### Phase 0: establish a reproducible baseline

1. Record the base commit, current executor surface, current selected model IDs,
   reasoning settings, and any organization-level model constraints outside this repo.
2. Capture a small versioned eval corpus from real Lemonade work. Remove secrets and
   avoid using unresolved issue content that could leak private context.
3. Run each task once with the incumbent route and retain the artifact, commands,
   elapsed time, token usage when exposed, tool calls, retries, and reviewer score.
4. Mark unrelated baseline failures before the GPT-6 trial. The migration must not
   claim regressions or improvements caused by an already-red repository.

Recommended corpus:

- a pure simulation bug requiring a deterministic regression test;
- a strict TypeScript boundary change with `noUncheckedIndexedAccess` and exact
  optional properties;
- a mobile-layout diagnosis governed by the no-scroll viewport contract;
- a renderer/resource-lifecycle defect;
- an issue-decomposition and dependency-ordering exercise;
- a review exercise seeded with boundary leakage, a weakened test, and an unsupported
  success claim.

### Phase 1: compatibility spike

1. Enable the exact candidate only in an isolated personal or branch-scoped executor
   configuration; do not change shared defaults.
2. Run one low-risk repository task and one tool-heavy task without changing prompts.
3. Confirm command execution, patch application, Git behavior, connector use,
   intermediate updates, final-answer formatting, and preservation of any assistant
   item phase metadata used by the host.
4. Classify the result as one of:
   - **model selection only** — host and prompts work unchanged;
   - **model selection plus targeted prompt update** — the host is compatible, but a
     measured behavior needs a narrow instruction change;
   - **blocked by integration change** — SDK, API, parameter, schema, tool wiring,
     authentication, or host behavior must change first.
5. End the spike without committing generated output or a speculative shared model ID.

### Phase 2: shadow evaluation

Run incumbent and candidate routes on the same corpus from the same base commit. Keep
the candidate's changes unmerged. Score each result on:

- task completion and acceptance-criteria coverage;
- correctness of package/boundary ownership;
- deterministic test quality and regression sensitivity;
- compliance with `AGENTS.md` and repository-specific mobile/accessibility rules;
- tool-call validity, redundant loops, and scope discipline;
- unsupported claims in the PR summary;
- review defects found and false positives;
- elapsed time, total tokens when observable, and retry count.

The candidate passes a role only if it has no critical regression, does not weaken
required checks, and is at least as reliable as the incumbent on that role's core
contract. Cost or speed alone cannot compensate for correctness or review-independence
failures.

### Phase 3: canary rollout

1. Open one narrow routing-policy PR owned by the Release & Repository Steward.
2. Change one Codex-default specialist role first; implementation or verification is
   preferable because those roles have the strongest executable evidence.
3. Keep the incumbent model selectable through the existing configuration mechanism.
   Do not duplicate large instruction files just to support the canary.
4. Require the normal other-family review and all checks appropriate to the canary
   task.
5. Observe at least five representative completed tasks across more than one package
   boundary before expanding the route. Record failures as well as successes.

### Phase 4: controlled expansion

1. Expand one workload class at a time: implementation, verification, then optional
   reasoning/planning roles.
2. Use separate commits or PRs for host/integration changes and model-routing changes.
   Routine stacks remain no deeper than two PRs.
3. Make prompt changes only for observed regressions. Prefer outcome, acceptance
   criteria, constraints, output contract, validation, and stop rules over detailed
   prescriptions of the model's internal process.
4. After each expansion, compare production task evidence with the baseline and pause
   on critical regressions, repeated retries, or material cost/latency surprises.

### Phase 5: finalize and clean up

1. Update `docs/ai-agent-team.md`, `AGENTS.md`, `CLAUDE.md`, and any actual executor
   configuration together so prose and selection behavior agree.
2. Name exact model IDs only where the repository controls them. If selection occurs in
   an organization or user setting, document the owner and verification procedure
   instead of pretending the repo enforces it.
3. Remove temporary canary overrides, duplicate prompts, stale compatibility notes, and
   eval artifacts that contain task-specific working data.
4. Retain the reusable, sanitized eval corpus and decision record.
5. Create follow-up issues for intentionally excluded host, provider, or review-policy
   changes; do not hide them as TODO comments.

## Validation and acceptance criteria

For the final routing-policy PR:

- `rg -n -i 'openai|gpt-[0-9]|codex|claude' AGENTS.md CLAUDE.md docs .codex`
  (omit `.codex` if it does not exist) shows no stale or contradictory active routing.
- `pnpm format:check` passes for repository formatting.
- `pnpm typecheck` and the focused package tests pass if executable configuration or
  prompt-loading code changes; documentation-only changes do not require fabricated
  runtime evidence.
- The ready-for-review packet names the authoring role/model family and the genuinely
  independent reviewing role/model family.
- The PR states exact checks run, checks not run, access constraints, generated-file
  impact, game-balance impact, persisted-data impact, and rollback instructions.
- No production dependency, game asset, lockfile, or generated showcase output changes
  solely because of executor model routing.

## Rollback

Rollback is a routing/configuration revert, not a product rollback. Preserve the last
known-good model selection until the canary is complete. Revert immediately when a
candidate repeatedly violates repository boundaries, skips or weakens validation,
cannot use required tools, makes unsupported completion claims, or removes independent
review. Keep any safe, model-agnostic prompt clarification only if it independently
improves the incumbent baseline.

## Implementation issue template

When GPT-6 is documented and available, create a GitHub issue with:

- **Primary role:** Release & Repository Steward
- **Reviewing roles:** Architecture & Integration Lead; Verification & Performance
  Engineer
- **Boundary:** executor routing and repository guidance only
- **Base commit:** exact SHA
- **Official evidence:** exact OpenAI model, migration, prompting, and Codex-surface URLs
- **Candidate IDs:** exact published model IDs; no aliases unless the rollout semantics
  are documented and intentionally accepted
- **Current route:** actual incumbent IDs and reasoning settings
- **Eval corpus:** version/commit and privacy review
- **Pass thresholds:** role-specific correctness, critical-regression ceiling, latency,
  token, tool-loop, and retry limits
- **Conflict check:** active PRs touching `AGENTS.md`, `CLAUDE.md`,
  `docs/ai-agent-team.md`, or executor configuration
- **Rollback owner and command/config change**
- **Explicit exclusions:** application AI features, game behavior, dependencies,
  persistence, generated files, and review-policy replacement

This issue should advance implementation only after the target-selection gate has
authoritative evidence. Before that point, the correct repository state is readiness,
not a fictional model migration.
