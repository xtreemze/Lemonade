# Balance and gameplay certification

Balance changes are evaluated with deterministic evidence rather than intuition alone.

The certification harness lives in `packages/simulation` and calls only the pure simulation API. It does not depend on DOM state, browser timing, audio, storage, rendering, or network data.

Run the human-reviewable report with:

```sh
pnpm certify
```

The command builds the simulation package, executes the fixed certification corpus, fails on violated guardrails, and prints a deterministic Markdown report.

## Fixture corpus

The baseline corpus runs seven understandable strategy profiles across sixteen fixed seeds for up to 90 simulated days. The profiles explore small conservative stands, aggressive inventory, advertising-heavy play, high unlocked prices, deliberately poor below-cost choices, weather-adaptive play, and growth-oriented progression.

The corpus is not an optimizer. Its purpose is to expose distribution changes while every strategy remains constrained by the same 2017 stand levels and affordability rules as a player.

## Hard invariants

These are correctness properties. CI must fail if a simulated day violates them:

- sold cups never exceed prepared cups;
- revenue equals sold quantity multiplied by price;
- named ledger lines reconcile to reported expenses;
- revenue plus finance income minus expenses equals net result;
- cash flow and debt reconcile after finance movements;
- next-state cash and debt match the ledger;
- completed days append immutable ledger entries.

These invariants are independent from tuning.

## 2017 balance guardrails

The historical equations themselves are the compatibility contract:

- price affects demand continuously as an inverse dollar term, with no reference-price discontinuity;
- controlled price probes remain monotonically demand-decreasing without an extra high-price penalty;
- the one-sign advertising value and the full advertising curve follow `signs² / log1p(signs)`;
- weather effects remain exactly 1×, 2×, 5×, and 10×;
- confidence contribution remains monotonic and follows the historical update state machine;
- the seeded confidence roll retains the original 40% / 40% / 20% distribution for values 1 / 2 / 3;
- stand thresholds remain $100 / $500 / $5,000 with the historical slider caps;
- growth-oriented fixtures exercise operating progression.

A test must not be changed merely because the restored 2017 behavior differs from the Apple II game. If a guardrail conflicts with the historical source, the source wins unless an explicit new design decision intentionally changes the game.

## Human-review metrics

The report deliberately includes metrics that should be reviewed rather than automatically optimized:

- survival and bankruptcy timing;
- final equity distribution (`min`, `p50`, `p90`, `max`);
- sell-through and waste;
- average price and advertising level;
- isolated weather and sentiment demand contribution;
- exceptional-event frequency and realized impact;
- maximum finance tier and earliest finance-tier entry days;
- maximum operating stand level and earliest operating-level entry days;
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


## 2017 compatibility probes

Certification treats the 2017 implementation as the balance contract. It explicitly checks continuous inverse-price demand across dollar-scale prices, the exact `signs² / log1p(signs)` marketing term, weather effects `1× / 2× / 5× / 10×`, monotonic confidence contribution, historical stand thresholds, deterministic seeded replay, and accounting identities.

There is intentionally no guardrail asserting that prices above ten cents receive an extra penalty. Likewise, advertising is not required to have diminishing returns: the historical equation is the invariant.

Simulation schema version 3 marks this economic correction. Earlier modern saves used materially different costs and demand rules and are rejected explicitly rather than silently reinterpreted under the 2017 model.
