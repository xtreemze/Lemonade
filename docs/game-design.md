# Game design: preserving the Lemonade Stand decision engine

## Design thesis

Lemonade Stand is effective because it creates a meaningful optimization problem with almost no interface complexity. The player does not manage dozens of systems. They receive uncertain environmental information, commit scarce cash across three decisions, and immediately see the economic consequence.

The revival should add depth around that loop, not inside it.

The invariant is:

> **Conditions -> three decisions -> commit -> consequence -> learning -> next conditions**

The three decisions are production quantity, advertising quantity, and price. Weather and market sentiment are observed conditions. Finance systems are obligations and consequences. Charts are memory. The 3D scene and audio are feedback. None of those should casually become a fourth operating variable.

## What the 1979 Apple II game actually does

The released Applesoft BASIC credits Bob Jamison's original MECC program and Charlie Kellner's February 1979 Apple adaptation. The important design constants and formula are visible directly in that source.

Initial constants include:

- reference price: 10 cents;
- advertising sign cost: 15 cents;
- baseline demand: 30 glasses;
- starting assets: $2.00;
- advertising response constant: 0.5.

Production cost changes as the game progresses:

- days 1-2: 2 cents per glass;
- days 3-6: 4 cents per glass;
- day 7 onward: 5 cents per glass.

This is an early example of progressive complexity: the controls do not change, but the economics underneath them become less forgiving.

### Weather

The Apple II source chooses among three ordinary forecast states after the opening days:

- sunny: 60%;
- cloudy: 20%;
- hot and dry: 20%.

The first two days are forced sunny, giving the player a short protected introduction before environmental uncertainty arrives.

Weather is not cosmetic. It modifies the demand environment and can trigger special events.

- Hot and dry produces a heat wave and doubles the ordinary demand multiplier.
- Cloudy weather can reduce demand according to a stated chance of light rain.
- A cloudy day can become a severe thunderstorm; in the original program the day's stands can be ruined.
- Street work can disrupt traffic or, in an alternate outcome, cause workers to buy the available lemonade.

The player therefore sees useful information but never receives certainty.

### Price response

Let `p` be price in cents. Before weather, advertising, events, and inventory limits, the original source computes a baseline demand `N1` around a 10-cent reference price.

For `p < 10`:

```text
N1 = ((10 - p) / 10) * 0.8 * 30 + 30
```

which simplifies to:

```text
N1 = 54 - 2.4p
```

For `p >= 10`:

```text
N1 = (10^2 * 30) / p^2
   = 3000 / p^2
```

This is the central pricing lesson. Below the reference price, demand rises in a controlled way. Above it, demand falls sharply with inverse-square behavior. Raising price is therefore not a free revenue multiplier.

### Advertising response

Let `s` be the number of signs. The source computes:

```text
V = 1 - exp(-0.5s)
```

and then:

```text
advertisedDemand = N1 + N1 * V
                 = N1 * (2 - exp(-0.5s))
```

Advertising has strong early returns and then saturates. As `s` grows, the multiplier approaches 2 rather than growing without limit.

This is an excellent game-design property: a sign is usually useful, but buying signs indefinitely is wasteful.

### Weather/event response and sales cap

A weather/event multiplier is applied to demand, the result is converted to an integer, and actual sales are capped by the number of glasses prepared.

Conceptually:

```text
potentialDemand = floor(baseDemand * advertisingMultiplier * environmentMultiplier)
sold = min(glassesPrepared, max(0, potentialDemand))
```

A thunderstorm can set the sale multiplier to zero. Other events can reduce demand heavily or force a sell-out.

### Accounting

Daily income and expenses are then straightforward:

```text
revenue = sold * price
expenses = glassesPrepared * unitCost + signs * signCost
profit = revenue - expenses
assets' = assets + profit
```

The player must be able to afford production plus advertising before the day is committed. Inventory is paid for even if it does not sell.

That simple accounting rule is what gives quantity decisions real risk.

## Why this design works

### 1. The variables are orthogonal enough to reason about

Production limits the maximum number of possible sales. Advertising modifies potential demand. Price modifies both demand and revenue per successful sale. No variable is a simple substitute for another.

### 2. The response curves are nonlinear

The most interesting decisions happen because the game is not linear. High price can collapse demand, and advertising saturates. Players learn by forming hypotheses and testing them.

### 3. Uncertainty is legible

The player sees weather before committing, but events and actual demand still contain uncertainty. This creates risk without making decisions feel arbitrary.

### 4. Feedback is immediate

The player receives a daily report after a single decision cycle. There is almost no dead time between hypothesis and evidence.

### 5. Complexity is staged

Input costs rise after the player has learned the basic loop. The revival should use the same principle for taxes, bank charges, interest, and market cycles.

## The current repository implementation

The legacy browser version already preserves the three-control structure and weather presentation, but its economic model diverges substantially from the Apple II design.

It currently computes a marketing result roughly as:

```text
signEffect = signs^2 / log1p(signs)
confidenceEffect = random(1, 3.5) * confidence
weatherEffect = weatherVariant^2 + 1
result = ((signEffect + confidenceEffect) / price) * weatherEffect
```

It then caps sold units by cups prepared and computes revenue/expenses. Progression raises the maximum cups, signs, and price based on accumulated profit.

The useful ideas to retain are:

- exactly three controls;
- a one-action day advance;
- visible weather;
- immediate profit/sales feedback;
- a sentiment/confidence signal;
- visual liquid/stand feedback;
- progression based on economic success.

The formula itself should be replaced with a deterministic, documented model closer to the classic demand curves.

## Modern simulation model

The modern domain model should start from the original economic shape and separate the factors explicitly.

```text
priceDemand = classicPriceCurve(price)
advertisingMultiplier = classicAdvertisingCurve(signs)
weatherMultiplier = weather.effect
sentimentMultiplier = sentiment.effect
eventMultiplier = event.effect

potentialDemand = floor(
  priceDemand
  * advertisingMultiplier
  * weatherMultiplier
  * sentimentMultiplier
  * eventMultiplier
)

sold = clamp(potentialDemand, 0, glassesPrepared)
```

Every factor must be named and inspectable in tests. Presentation may summarize causes qualitatively, but the engine must never hide magic arithmetic in UI components.

### Market sentiment

The revival adds a visible market-sentiment signal distinct from weather. It exists to create a slowly evolving demand context without creating another player control.

Recommended initial qualitative states:

```text
very_cold | cold | neutral | warm | hot
```

A conservative first-pass multiplier range is approximately `0.85` to `1.15`. Exact values are balance parameters and should be tuned from simulations, not treated as immutable design truth.

Sentiment should evolve from two sources:

1. **Endogenous reputation/value feedback** — recent customer value, availability, and pricing can shift local willingness to buy gradually.
2. **Exogenous market noise/cycles** — bounded seeded variation prevents the player from solving sentiment as a deterministic reputation meter.

The forecast shown before a day is qualitative. The exact multiplier remains domain data for deterministic replay and diagnostics, not a number the normal UI must expose.

### Randomness

Randomness is part of the design but must not be implicit.

- The engine receives a seedable RNG or pre-generated environment/event values.
- `Math.random()` is forbidden inside simulation logic.
- A completed game can be reproduced exactly from its initial state, seed and decision sequence.
- Visual and musical variation use separate presentation randomness so changing an animation or tune cannot affect sales.

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

## Progression: complexity without interface sprawl

Progression should increase the sophistication of consequences while keeping the primary interaction stable.

### Tier 0 — neighborhood stand

Learn production, advertising, price, weather, sentiment, cash constraints, and waste.

### Tier 1 — established stand

Introduce ingredient-cost variation and simple fixed operating/permit charges. The player is informed before the charge applies.

### Tier 2 — small business

Introduce a simple periodic tax settlement. It appears in forecasts/obligations and the ledger, not as a new slider.

### Tier 3 — financed growth

Introduce banking: account/transaction charges, savings interest, and optional borrowing. Loan choices belong in an occasional finance surface outside the three-control daily operating loop.

### Tier 4 — mature operation

Introduce stronger market cycles, periodic liabilities and loan interest. The player should be optimizing cash timing as well as daily sales.

Rates are fictional game-balance values, not legal/tax advice or attempts to model a real jurisdiction.

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

## Primary historical source

Released Applesoft BASIC source:

https://gist.github.com/badvision/16b74ade3a8b2fa2e87d

Key source sections used for this analysis include the initialization constants, weather selection, daily input validation, demand formula, random events, financial report, instructions, and weather/music routines.