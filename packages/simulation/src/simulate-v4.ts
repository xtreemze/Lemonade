import { awarenessForCustomer } from "./advertising.js";
import {
  type AudienceSummary,
  type CustomerOutcome,
  customerTraitsFor,
  dayAudienceFor,
  summarizeAudience,
} from "./audience.js";
import { conversionForCustomer } from "./conversion.js";
import { legacyConfidenceForState } from "./legacy.js";
import { nextMarketMemory, neutralMarketMemory } from "./memory.js";
import type { DayDecision, DayEnvironment, DayResolution, GameState } from "./model.js";
import { glassCount, type Seed } from "./primitives.js";
import { operatingScaleForState } from "./scale.js";
import { resolveDayFromSales } from "./simulate.js";
import { SIMULATION_RULESET_VERSION } from "./version.js";
import type { DayAudience, MarketMemory } from "./audience.js";

export type V4MarketDayResolution = Readonly<{
  rulesetVersion: typeof SIMULATION_RULESET_VERSION;
  audience: DayAudience;
  outcomes: readonly CustomerOutcome[];
  summary: AudienceSummary;
  memoryBefore: MarketMemory;
  memoryAfter: MarketMemory;
}>;

export type V4DayResolution = DayResolution &
  Readonly<{
    market: V4MarketDayResolution;
  }>;

const customerOutcomesForDay = (
  state: GameState,
  decision: DayDecision,
  environment: DayEnvironment,
  runSeed: Seed,
  memory: MarketMemory,
): Readonly<{
  audience: DayAudience;
  outcomes: readonly CustomerOutcome[];
  summary: AudienceSummary;
}> => {
  const level = operatingScaleForState(state).level;
  const audience = dayAudienceFor(runSeed, state.day, level);
  const confidence = legacyConfidenceForState(state);
  let purchased = 0;

  const outcomes = Object.freeze(
    audience.customerIds.map((id): CustomerOutcome => {
      const traits = customerTraitsFor(runSeed, id);
      const awareness = awarenessForCustomer({
        runSeed,
        day: state.day,
        traits,
        signs: decision.signs,
        weather: environment.weather.kind,
        advertisingFatigue: memory.advertisingFatigue,
      });

      if (awareness.kind === "unaware") {
        return Object.freeze({
          id,
          type: traits.type,
          visualSeed: traits.visualSeed,
          awareness,
          conversion: Object.freeze({ kind: "not-evaluated" }),
          fulfillment: Object.freeze({ kind: "none" }),
        });
      }

      const conversion = conversionForCustomer({
        runSeed,
        day: state.day,
        price: decision.price,
        traits,
        weather: environment.weather.kind,
        confidence,
        memory,
      });

      if (conversion.kind === "price-rejected") {
        return Object.freeze({
          id,
          type: traits.type,
          visualSeed: traits.visualSeed,
          awareness,
          conversion,
          fulfillment: Object.freeze({ kind: "none" }),
        });
      }

      if (purchased < Number(decision.glasses)) {
        const saleIndex = purchased;
        purchased += 1;
        return Object.freeze({
          id,
          type: traits.type,
          visualSeed: traits.visualSeed,
          awareness,
          conversion,
          fulfillment: Object.freeze({ kind: "purchased", saleIndex }),
        });
      }

      return Object.freeze({
        id,
        type: traits.type,
        visualSeed: traits.visualSeed,
        awareness,
        conversion,
        fulfillment: Object.freeze({ kind: "stockout" }),
      });
    }),
  );

  return Object.freeze({
    audience,
    outcomes,
    summary: summarizeAudience(outcomes),
  });
};

export const simulateDayV4 = (
  state: GameState,
  decision: DayDecision,
  environment: DayEnvironment,
  runSeed: Seed,
  memory: MarketMemory = neutralMarketMemory(),
): V4DayResolution => {
  const market = customerOutcomesForDay(state, decision, environment, runSeed, memory);
  const sold = glassCount(market.summary.purchased);
  const willingDemand = glassCount(market.summary.willing);
  const accounting = resolveDayFromSales(
    state,
    decision,
    environment,
    sold,
    willingDemand,
    true,
  );
  const level = operatingScaleForState(state).level;
  const memoryAfter = nextMarketMemory(memory, {
    price: decision.price,
    signs: decision.signs,
    level,
    prepared: decision.glasses,
    willing: market.summary.willing,
    purchased: market.summary.purchased,
  });

  return Object.freeze({
    ...accounting,
    market: Object.freeze({
      rulesetVersion: SIMULATION_RULESET_VERSION,
      audience: market.audience,
      outcomes: market.outcomes,
      summary: market.summary,
      memoryBefore: memory,
      memoryAfter,
    }),
  });
};
