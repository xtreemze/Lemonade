# Audience simulation v4

Issue: #72

## Status

This document defines the intended next Lemonade ruleset. It does **not** describe the currently released v3 demand model until the implementation issues linked from #72 are complete.

The objective is to preserve the 2017 game's strongest constraints—three daily controls, exact operating costs, historical scale thresholds, deterministic replay, and immediate consequences—while replacing the most exploitable aggregate demand math with a finite, inspectable neighborhood simulation.

The player continues to choose only:

1. glasses prepared;
2. advertising signs;
3. price per glass.

Everything else is a condition, consequence, or hidden market state.

## Why evolve the restored 2017 demand model

The restored v3 equation is historically faithful:

```text
potentialDemand =
  ((signs² / log1p(signs) + confidenceRoll × confidence) / price)
  × weatherEffect
```

That model is useful as a compatibility reference, but several mathematical properties reduce long-term emergence:

- price is an inverse demand divisor, so gross revenue approximately cancels price before inventory/rounding;
- advertising grows super-linearly while sign cost remains linear;
- weather multiplies the entire market by 1× / 2× / 5× / 10× rather than changing customer behavior;
- the hidden uncertainty is largely a three-outcome confidence roll;
- once weather and confidence are known, experienced play trends toward high price, increasingly high advertising, and inventory chosen after solving expected demand.

v4 intentionally changes those properties. The 2017 model remains preserved as a named legacy ruleset and certification reference.

## Core model

The simulation becomes a finite customer funnel:

```text
Neighborhood
  -> Today's audience
  -> Awareness
  -> Price conversion
  -> Willing customers
  -> Inventory fulfillment
  -> Satisfaction / market memory
```

Accounting consumes the final fulfilled-customer count.

The 3D scene consumes the exact same customer outcomes.

### Hard invariants

- Advertising never creates population.
- Weather never multiplies population.
- A person cannot buy without first being aware.
- A willing customer either receives a cup or becomes a stockout customer.
- One fulfilled customer consumes exactly one prepared cup.
- `sold` equals the number of fulfilled customers.
- The renderer cannot change awareness, conversion, ordering, sales, or memory.
- All market randomness is seeded and replayable.
- The daily interface remains three controls plus commit.

## Neighborhood

Each run has a stable neighborhood identity derived from the run seed.

A neighborhood contains stable customer IDs. The active audience on a day is a deterministic sample from that pool.

Initial certification targets:

| Operating level | Pool target | Daily audience target |
| --- | ---: | ---: |
| L1 | 48 | 24 |
| L2 | 144 | 72 |
| L3 | 384 | 200 |
| L4 | 900 | 480 |

These values are calibration targets, not compatibility constants. They must be evaluated against profitability, scene performance, stockout rates, and slider caps.

A small non-weather daily variation of approximately ±5–8% is acceptable if it improves texture. It must come from a named market RNG substream and remain deterministic.

### Why pool > audience

A larger pool allows recurring customers without making every resident appear every day. It also allows the weather/customer-type mix to change by selecting different members while keeping the total audience count stable.

## Stable customer identity

A customer's stable traits are derived from:

```text
ruleset version
+ neighborhood seed
+ customer ID
```

Stable traits include:

- customer type;
- intrinsic price tolerance;
- advertising responsiveness;
- familiarity tendency;
- loyalty/satisfaction sensitivity;
- weather commitment;
- visual identity seed.

The simulation package owns the semantic traits. The scene package maps the visual seed to geometry, clothing, proportions, hair, accessories, gait, and similar presentation attributes.

### Customer types

Use a small closed union:

- **impulse** — high environmental/ad responsiveness, moderate price tolerance;
- **price-sensitive** — can become aware easily but strongly reacts to price;
- **regular** — strong organic awareness and satisfaction sensitivity;
- **destination** — low advertising dependence and high weather commitment.

Types are not deterministic outcomes by themselves. They bias bounded probabilities.

## Randomness architecture

Unrelated feature work must not perturb simulation outcomes by changing random draw order.

Prefer named deterministic substreams derived from the run seed, day, customer ID, and semantic purpose:

```text
environment/weather
audience-selection
awareness
conversion
customer-traits
scene-presentation
audio-presentation
```

Scene and audio streams are presentation-only and can never feed simulation.

A replay must be stable even if the renderer adds a new accessory or animation.

## Awareness

Awareness has two sources:

1. organic awareness;
2. advertising awareness.

A person who is already organically aware does not receive additional demand credit merely because a sign also exists.

### Organic awareness

Organic awareness is a bounded function of stable traits and business history.

Inputs may include:

- customer type/familiarity;
- confidence;
- aggregate satisfaction/reputation;
- prior purchase/familiarity projection if later justified.

Keep this interpretable. Confidence should become a trust/familiarity signal, not a hidden customer-count generator.

### Advertising reach

Use a saturating response rather than the 2017 super-linear term.

A suitable family is:

```text
baseReach(signs) = 1 - exp(-k × signs)
```

The exact `k` is a certification parameter.

Desired qualitative behavior:

- first few signs are valuable;
- each additional sign reaches fewer new people;
- high sign counts approach the finite audience;
- advertising can never produce >100% reach;
- signs remain useful at every scale but max signs do not become a universal solution.

Per-customer effective ad awareness:

```text
effectiveAdReach =
  baseReach(signs)
  × customerAdResponsiveness
  × weatherAttentionFactor
  × fatigueFactor
```

Only customers not already organically aware need the advertising draw.

## Advertising fatigue

Repeated advertising produces familiarity/fatigue, not a large punishment.

Maintain compact normalized advertising pressure:

```text
fatigue[t] =
  decay × fatigue[t-1]
  + (1 - decay) × normalizedSigns[t]
```

Initial calibration range:

- decay: 0.70–0.85;
- maximum fresh-reach penalty: 15–20%.

This means:

- one maximum-ad day remains strong;
- repeated maximum advertising becomes less efficient;
- reducing advertising allows recovery;
- fatigue never becomes a permanent state or a hidden catastrophic multiplier.

Advertising cost itself remains $0.50/sign.

## Price conversion

Awareness and conversion are separate.

An aware customer has an effective tolerance. Today's price is compared against that tolerance using a smooth curve.

A suitable family is:

```text
relativePrice = price / effectiveTolerance

acceptanceProbability =
  1 / (1 + exp(slope × (relativePrice - 1)))
```

The exact slope and tolerance calibration are certification parameters.

### Effective tolerance

Inputs can include:

- stable intrinsic tolerance;
- customer type;
- weather behavior;
- confidence/reputation;
- expected-price memory;
- satisfaction.

Every factor must be bounded.

The goal is a real margin/volume trade-off:

- lower price -> higher conversion / lower margin;
- higher price -> lower conversion / higher margin.

The model must not reproduce the v3 algebraic price cancellation.

### Price memory

Customers should react slightly to unexpected price jumps.

Maintain a smoothed expected price:

```text
expectedPrice[t] =
  decay × expectedPrice[t-1]
  + (1 - decay) × actualPrice[t]
```

Do not punish price movement itself. Only large positive deviations from expectation should slightly reduce acceptance.

The same current price reached gradually should be somewhat easier to sustain than a sudden jump.

## Weather

Weather changes behavior, not audience size.

The active audience count for a given seed/day/scale remains the same when weather is substituted in certification probes.

Weather changes:

- price tolerance;
- sign attention;
- customer-type composition/selection;
- commitment to approach the stand;
- scene clothing/accessories/gait.

### Sunny

Target behavior:

- +10–15% price tolerance;
- normal sign attention;
- more relaxed lingering/pace;
- light clothing variants in the scene.

Sunny should support a modest premium. It must not create a 10× population.

### Partly cloudy

Target behavior:

- +3–6% tolerance;
- near-neutral sign attention;
- light/ordinary clothing mix.

### Cloudy

Cloudy is the neutral/moderate baseline.

“Moderate foot traffic” should be represented through normal customer mix, pace, and scene activity rather than an arbitrary population multiplier.

### Thunderstorm

Keep the same overall audience opportunity but change who appears and how they behave:

- fewer impulse-oriented members in the selected mix;
- more regular/destination/committed customers;
- 25–40% lower sign attention target;
- loyal/committed customers may remain reasonably price tolerant;
- faster/hunched movement and rain protection in the scene.

This makes storms strategically different without reducing them to `demand × 1`.

## Market memory

Use a compact aggregate state. Avoid hundreds of mutable per-customer persistence records unless later evidence requires them.

Suggested dimensions:

```ts
type MarketMemory = Readonly<{
  expectedPriceCents: number;
  advertisingFatigueBps: number;
  stockoutPressureBps: number;
  excessPressureBps: number;
  satisfactionBps: number;
}>;
```

Exact branded types should be used in implementation.

### Satisfaction

Satisfaction should improve slightly when willing customers are served at reasonable/stable pricing.

It should decline slightly when:

- willing customers repeatedly encounter stockouts;
- price changes are extreme relative to expectation.

Satisfaction affects organic awareness/repeat conversion, not population.

### Stockouts

A stockout customer is someone who:

1. is aware;
2. accepts the price;
3. arrives after inventory is exhausted.

That event should be visible in both the report and 3D scene.

Repeated stockouts should create a bounded negative memory. One isolated stockout is not catastrophic.

### Excess production

Excess inventory already has a direct financial cost because prepared cups cost money.

Therefore any future-market effect must remain tiny. Do not materially double-penalize overproduction.

## Confidence

Preserve the recognizable 0–5 confidence system and its relationship to business performance unless a separate design decision changes it.

Change its market role:

v3:
```text
confidenceRoll × confidence
-> added to aggregate demand
-> multiplied by weather
```

v4:
```text
confidence
-> bounded trust / organic-awareness / receptivity effect
```

The seeded 1/2/3 daily roll can remain as a small neighborhood-receptivity variation if it still improves texture, but it must not become a large population multiplier.

## Day resolution

A v4 day resolves in this order:

1. validate the three decisions against operating scale and affordability;
2. derive current market memory;
3. select today's finite audience;
4. derive awareness for each customer;
5. derive price acceptance for each aware customer;
6. order willing customers deterministically;
7. fulfill customers until prepared inventory is exhausted;
8. classify remaining willing customers as stockouts;
9. aggregate the customer funnel;
10. compute revenue and operating costs;
11. apply finance systems;
12. update confidence;
13. update compact market memory;
14. return immutable `DayResolution` including authoritative customer outcomes.

### Required accounting identity

```text
sold = purchasedCustomerCount

revenue = sold × price

operatingExpense =
  prepared × $1.00
  + signs × $0.50
```

The audience model changes demand. It does not change the meaning of money.

## Customer outcomes

Use explicit semantic outcomes.

Suggested shape:

```ts
type CustomerOutcome = Readonly<{
  id: CustomerId;
  type: CustomerType;
  visualSeed: Seed;
  awareness:
    | { kind: "unaware" }
    | { kind: "organic" }
    | { kind: "advertising"; signIndex: number };
  conversion:
    | { kind: "not-evaluated" }
    | { kind: "price-rejected" }
    | { kind: "willing" };
  fulfillment:
    | { kind: "none" }
    | { kind: "purchased"; saleIndex: number }
    | { kind: "stockout" };
}>;
```

Implementation may refine the exact representation, but states must be mutually consistent.

## Aggregate funnel

Every day should produce a compact summary:

- audience count;
- organically aware;
- ad-aware;
- total aware;
- price rejected;
- willing;
- purchased;
- stockout;
- unaware.

Invariants must prove the partitions sum exactly.

## Scene contract

The scene package should stop synthesizing economic events from `sold`, `signs`, and a local advertising ratio.

Instead:

```text
simulation CustomerOutcome[]
-> renderer-neutral scene projection/storyboard
-> Three.js animation
```

Three.js owns geometry and timing interpolation only.

### Visual mapping

Unaware:
- ordinary passerby;
- no sign/stand attention.

Ad-aware:
- head/upper-torso glance at assigned sign;
- optional brief pace change.

Organic/regular awareness:
- may approach directly without sign glance.

Price rejected:
- look/hesitation/continue walking.

Purchased:
- approach;
- purchase;
- inventory decrements at purchase completion;
- drink/depart.

Stockout:
- arrive willing;
- encounter empty stand;
- visible disappointed/unsatisfied reaction;
- depart.

### Weather appearance

Core customer identity remains stable across days. Weather layers modify clothing/accessories and motion.

Sunny:
- short sleeves/shorts/skirts where profile permits;
- seeded hats/sunglasses;
- lighter, relaxed movement.

Thunderstorm:
- seeded umbrella, raincoat/hood, jacket, or newspaper-over-head variants;
- faster/hunched movement;
- shorter sign-glance dwell.

The visible weather behavior must correspond to the same semantic weather factors used by the simulation.

## Reports

The richer model must not turn planning into a dashboard.

Daily report can expose a compact funnel:

```text
Audience -> aware -> willing -> served
              \-> price rejects
                       \-> stockouts
```

Use natural language and a few numbers. Do not expose raw per-customer probabilities in the main UI.

History may project:

- awareness rate;
- conversion rate;
- stockout count;
- advertising efficiency;
- satisfaction trend.

Mobile no-scroll remains non-negotiable; long material stays in sequential report/history screens.

## Persistence and ruleset boundary

v4 changes balance intentionally.

Do not load a v3 save and recompute its historical days with v4 customer logic.

Preferred migration policy:

- preserve v3 ledger entries exactly;
- store/identify their ruleset version;
- start v4 market memory from a documented neutral/derived boundary on the next unresolved day;
- never rewrite prior sold/revenue/profit.

If this produces excessive complexity, an acceptable alternative is to keep v3 saves on the v3 engine and require a new run for v4. The chosen behavior must be explicit.

Save schema version and simulation/ruleset version remain separate.

## Balance certification

v4 certification should detect dominance rather than enforce one ideal strategy.

### Advertising probes

For all level-allowed sign counts:

- reach;
- marginal reach;
- fresh vs fatigued reach;
- ROI;
- recovery after low advertising.

### Price probes

Across representative customer/weather mixes:

- conversion vs price;
- revenue vs price;
- profit vs price;
- local optimum regions;
- detect universal max-price dominance.

### Weather probes

Substitute weather while holding seed/day/audience selection constant:

- audience count must remain equal;
- customer mix/attention/tolerance may change;
- sunny premium remains bounded;
- storm advertising remains useful but weaker.

### Memory probes

Compare:

- stable vs sudden price increases;
- single vs repeated stockout;
- repeated max ads vs pulsed ads;
- recovery sequences.

### Strategy corpus

Include intentionally exploit-seeking strategies:

- max price;
- max signs;
- max everything;
- minimum price/volume;
- fixed conservative;
- adaptive inventory;
- weather-aware price;
- pulsed advertising;
- stockout-seeking;
- stable-price reputation.

Do not certify a universal winner. The release gate is the absence of an obvious dominant extreme across a broad deterministic seed corpus.

## Performance

The largest operating envelope is 400 prepared cups and roughly 480 active daily customers under the initial calibration.

Simulation work at this scale is small for pure TypeScript.

Scene requirements are stricter:

- storyboard may include all authoritative outcomes;
- renderer may use bounded pools and time compression;
- logical customer identity cannot change during an active event;
- no authoritative outcome may be silently reclassified to reduce draw calls;
- existing lazy-scene bundle budget remains a fatal CI gate.

## Delivery plan

1. #73 — audience/customer contracts and named RNG.
2. #74 — awareness, saturation, and fatigue.
3. #75 — price conversion and weather/customer behavior.
4. #76 — compact bounded market memory.
5. #77 — ruleset v4 day resolution and accounting integration.
6. #78 — persistence/ruleset migration.
7. #79 — authoritative 3D outcome projection.
8. #80 — report/accessibility funnel projections.
9. #81 — v4 exploit/balance certification.

Implementation is strict RED -> GREEN -> REFACTOR. Each slice should remain independently reviewable and should not weaken mobile, bundle, accounting, determinism, or legacy-v3 regression gates.
