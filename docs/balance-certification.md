# Balance and gameplay certification

Balance changes are evaluated with deterministic evidence rather than intuition alone.

The certification harness lives in `packages/simulation` and calls only the pure simulation API. It does not depend on DOM state, browser timing, audio, storage, rendering, or network data.

Run the human-reviewable report with:

```sh
pnpm certify
```

The command builds the simulation package, executes the fixed certification corpus, fails on violated guardrails, and prints a deterministic Markdown report.

## Fixture corpus

The baseline corpus runs seven strategy profiles across sixteen fixed seeds for up to 90 simulated days:

- `conservative` — low price, no advertising, modest inventory;
- `aggressive-inventory` — commits most available working capital to stock;
- `advertising-heavy` — sustains five signs and inventory for the induced demand;
- `high-price` — tests high-margin, low-volume play;
- `poor-decisions` — deliberately combines excessive signs with a demand-suppressing price;
- `adaptive` — changes all three decisions from visible weather and sentiment;
- `progression` — a growth policy intended to exercise every finance tier.

Strategies are affordability-clamped through the same simulation finance constraints. A run is considered bankrupt when even the day's predictable fixed obligations cannot be funded from available cash and credit.

The corpus is intentionally not an optimizer. It represents distinct, understandable player behaviors so changes in relative outcomes remain visible.

## Hard invariants

These are correctness properties. CI must fail immediately if any simulated day violates them:

- sold glasses never exceed prepared glasses;
- revenue equals sold quantity multiplied by price;
- named operating ledger lines reconcile to reported expenses;
- revenue plus finance income minus expenses equals net result;
- cash delta reconciles to opening and ending cash;
- loan-interest settlement stays within accrued-interest bounds;
- cash flow reconciles after borrowing, operating cash expenses, interest, and repayment;
- next-state cash and debt match the ledger entry;
- day numbers advance exactly once;
- the ledger appends exactly one immutable entry per resolved day.

These invariants are not balance targets and should not be weakened to make a tuning change pass.

## Design guardrails

Guardrails are intentionally broad. They detect clearly implausible regressions while leaving room for deliberate tuning:

- conservative, advertising-heavy, adaptive, and progression profiles survive the fixed 90-day corpus;
- conservative and adaptive play retain positive growth floors;
- the progression profile reaches every current finance tier and has sufficient equity to exercise late finance mechanics;
- intentionally poor play does not outperform adaptive play at the median;
- high-price play retains a material sell-through penalty;
- advertising-heavy and conservative fixtures continue to exercise meaningfully different advertising regimes;
- median strategy outcomes retain a substantial equity spread;
- sell-through outcomes retain a substantial spread;
- controlled price probes remain demand-decreasing;
- controlled advertising probes retain positive but non-increasing marginal demand benefit;
- controlled weather and sentiment probes retain their intended demand ordering.

Changing a guardrail is a design decision. The PR should explain why the old range is no longer desirable and what player behavior the new range is intended to permit.

## Human-review metrics

The report deliberately includes metrics that should be reviewed rather than automatically optimized:

- survival and bankruptcy timing;
- final equity distribution (`min`, `p50`, `p90`, `max`);
- sell-through and waste;
- average price and advertising level;
- isolated weather and sentiment demand contribution;
- exceptional-event frequency and realized impact;
- maximum tier and earliest tier-entry days;
- aggregate taxes, supplier fees, bank fees, debt interest, borrowing, repayment, and savings interest;
- controlled price, advertising, weather, and sentiment demand probes.

A metric moving is not automatically a defect. The purpose is to make large distribution shifts visible and reviewable.

## Ruleset changes and replay compatibility

The certification report records the simulation schema version. Any change to balance constants or random-draw ordering that alters deterministic outcomes must be reviewed together with persistence/replay compatibility.

Do not update expected behavior merely because a fixture changed. First determine whether the change is:

1. a correctness regression;
2. an intentional balance change within existing guardrails;
3. an intentional design change that requires guardrail revision; or
4. a simulation-schema change requiring replay/persistence treatment.

The fixed seed corpus should remain stable unless there is a documented reason to change the sampling contract.
