# Game design: preserving the Lemonade Stand decision engine

## Design thesis

Lemonade Stand is effective because it creates a meaningful optimization problem with almost no interface complexity. The player does not manage dozens of systems. They receive uncertain environmental information, commit scarce cash across three decisions, and immediately see the economic consequence.

The revival should add depth around that loop, not inside it.

The invariant is:

> **Conditions -> three decisions -> commit -> consequence -> learning -> next conditions**

The three decisions are production quantity, advertising quantity, and price. Weather and market sentiment are observed conditions. Finance systems are obligations and consequences. Charts are memory. The 3D scene and audio are feedback. None of those should casually become a fourth operating variable.

## Historical inspiration and authoritative balance

The 1979 Apple II Lemonade Stand remains presentation and game-design inspiration: a tiny decision surface, visible weather, immediate consequences, short musical cues, and an economic loop that is easy to learn but difficult to optimize. Its exact pricing and advertising equations are **not** the balance contract for this repository.

The authoritative economic implementation is the repository's 2017 browser game. Modernization may make that system deterministic, typed, inspectable, and extensible, but must preserve its operating behavior.

### 2017 operating economy

The base stand begins with a $10 operating balance. Cups cost $1.00 each and signs cost $0.50 each. The player still makes exactly three decisions: cups, signs, and price.

Potential demand is:

```text
signEffect = signs² / log1p(signs)
if signEffect is NaN or < 1: signEffect = 0

confidenceEffect = confidenceRoll × confidence
weatherEffect = weatherVariant² + 1

potentialDemand =
  ((signEffect + confidenceEffect) / priceDollars)
  × weatherEffect
```

Demand is rounded to the nearest whole cup and then capped by prepared inventory.

There is no reference-price breakpoint. Price enters the formula continuously as an inverse term in dollars. A $3 price is treated by the same equation as $1.50 or $6; no extra high-price penalty may be introduced merely because the price crosses ten cents or another arbitrary threshold.

### Advertising

Advertising uses the original nonlinear term:

```text
signs² / log1p(signs)
```

This is not the Apple II saturating exponential response. Tests must characterize the historical equation rather than impose diminishing marginal returns from a different game.

### Confidence

Confidence is endogenous state produced by prior operating results. The historical update logic is preserved, including its first-day behavior:

- operating balance below $10: confidence 0;
- exactly zero daily operating profit: confidence 2;
- daily operating profit below the historical average: confidence 1;
- otherwise confidence rises according to the original $20 bands, capped by the original branch at 5.

The confidence demand roll preserves the 2017 `randomNumber(1, 3.5)` distribution: integer outcomes 1, 2, and 3 occur with probabilities 40%, 40%, and 20%. The only modernization is that the draw comes from the seeded simulation RNG instead of `Math.random()`.

### Weather

Weather has four equally reachable post-opening variants with historical numeric effects:

```text
variant 0 → 1×
variant 1 → 2×
variant 2 → 5×
variant 3 → 10×
```

Day one starts at variant 3, matching the historical sunny opening. Subsequent forecasts use the seeded equivalent of the original uniform `randomNumber(0, 4)` draw.

The 3D scene may interpret those states visually, but presentation events must not alter demand.

### Accounting and progression

Daily operating accounting remains:

```text
revenue = sold × price
operatingExpense = cupsPrepared × $1.00 + signs × $0.50
dailyOperatingProfit = revenue - operatingExpense
operatingBalance' = operatingBalance + dailyOperatingProfit
```

Historical stand levels are absolute operating-balance thresholds, not recalibrated finance equity:

- under $100: 15 cups, 3 signs, $2.99 max price;
- $100–$499.99: 50 cups, 10 signs, $3.99;
- $500–$4,999.99: 140 cups, 25 signs, $6.99;
- $5,000 and above: 400 cups, 40 signs, $9.99.

The level may downgrade if operating performance falls below a threshold.

### Later systems

Taxes, banking, interest, credit, richer reporting, 3D presentation, and other modern additions are layered around this core. They may create new consequences but must not silently redefine 2017 demand, confidence, base costs, or stand progression.

Operating balance and confidence are therefore reconstructed from lemonade revenue, production cost, and advertising cost rather than from later finance cash flows.

### Determinism

Randomness remains part of the design but is explicit:

- the engine receives seeded randomness;
- the 2017 probability distributions and draw ordering are preserved;
- completed runs can be replayed from seed and decisions;
- visual/audio randomness cannot affect sales.

## Daily state machine

A useful closed state machine is:

```text
forecast -> deciding -> resolving -> report -> forecast
```

Transitions are explicit.

- `forecast/deciding` exposes environment, assets, current costs, and exactly three decision values.
- `resolving` locks decisions and computes the day atomically.
- `report` exposes a complete immutable ledger entry and any progression changes.
- `next` advances environment/day state.

Avoid boolean combinations such as `isSelling`, `showReport`, `hasForecast`, `isAnimating` that can represent contradictory states.

## Progression: scale and complexity without interface sprawl

Progression has two independent axes.

**Operating scale** is the 2017 game system and is authoritative for the daily sliders. It is derived from reconstructed 2017 operating balance and uses the original $100 / $500 / $5,000 thresholds with exact historical caps. Because it is performance-derived, the stand can upgrade or downgrade.

**Finance maturity** is an additive modern system for fees, tax, banking, credit, and interest. It does not determine slider ranges, confidence, base demand, or historical operating balance. Its thresholds are deliberately late enough that it does not distort the neighborhood-stand economy.

This separation increases consequence complexity while the primary interaction remains three daily controls.

## Results and charts

A daily result should be understandable in a few seconds:

- glasses sold / prepared;
- price;
- revenue;
- production cost;
- advertising cost;
- named fees/taxes/interest if active;
- net profit/loss;
- ending assets;
- material weather/event explanation.

Longer-term charts answer questions the player naturally develops:

- Am I growing cash?
- Am I overproducing?
- Is a higher price actually helping?
- Does more advertising still pay?
- How much of my profit is being absorbed by later-stage costs?

Charts are analytical memory, not a second control panel.

## Presentation principles

### Vector 3D

Use low-poly/vector geometry as an expressive dashboard for the simulation:

- number of signs maps to visible signs;
- weather maps to sky/cloud/rain/light cues;
- demand level maps to pedestrian/customer activity;
- inventory/sell-through can map to pitchers/cups/stand activity;
- progression can evolve the stand and neighborhood subtly.

Do not render one customer per exact sale if that damages performance or readability. Presentation should encode magnitude, not become the source of truth.

### Procedural audio

The original Apple II version used short musical cues associated with conditions. The revival should preserve the idea, not copy the songs.

Generate original motifs and effects from simple musical patterns with Web Audio. Weather, day resolution, profit/loss, and level-up can each have a distinct family of cues. Audio is optional and begins only after user interaction.

## 2017 economic compatibility contract

The repository's 2017 browser implementation is the authoritative base game balance. The modern architecture may make randomness reproducible and layer later systems around the stand, but it must not replace the underlying economics with the Apple II reference curve.

The core demand equation is preserved as:

`((signs² / log1p(signs) + confidenceRoll × confidence) / priceDollars) × (weatherVariant² + 1)`

with the original guard that the sign term becomes zero when it is NaN or below one. Demand is rounded and then capped by prepared cups. The confidence roll preserves the original `randomNumber(1, 3.5)` outcomes and 40%/40%/20% distribution, now generated from the seeded RNG.

The original operating economy is also authoritative: $10 starting operating balance, $1.00 per cup, $0.50 per sign, and stand thresholds at $100, $500, and $5,000. Price is a continuous inverse input to demand; there is no special penalty or discontinuity above 10 cents.

Later finance features are deliberately outside this compatibility core. Operating balance, confidence, and stand level are reconstructed from production, advertising, and lemonade revenue so taxes, fees, credit, and interest cannot silently redefine the 2017 demand loop.
