import { describe, expect, it } from "vitest";

import {
  availableOperatingFunds,
  createInitialState,
  createSeededRandom,
  type DayDecision,
  generateEnvironment,
  glassCount,
  type GameState,
  moneyCents,
  operatingScaleForState,
  predictableFixedObligations,
  type ProgressionTier,
  seed,
  signCount,
  simulateDay,
} from "../src/index.js";

const GENERATED_SEEDS = Object.freeze([
  1,
  2,
  3,
  17,
  42,
  99,
  0x12_34_56_78,
  0xde_ad_be_ef,
] as const);

const MAX_GENERATED_DAYS = 64;

const stateFor = (tier: ProgressionTier, cash: number, loanBalance = 0): GameState =>
  Object.freeze({
    ...createInitialState(),
    tier,
    cash: moneyCents(cash),
    loanBalance: moneyCents(loanBalance),
  });

const initialStates = Object.freeze([
  createInitialState(),
  stateFor(2, 60_000),
  stateFor(3, 50),
  stateFor(4, 500, 1500),
] as const);

const generatedDecision = (
  state: GameState,
  random: ReturnType<typeof createSeededRandom>,
): DayDecision => {
  const scale = operatingScaleForState(state);
  const variableBudget = Math.max(
    0,
    Number(availableOperatingFunds(state)) - Number(predictableFixedObligations(state)),
  );

  const maxAffordableSigns = Math.min(
    scale.maxSigns,
    Math.floor(variableBudget / Number(state.signCost)),
  );
  const signs = random.nextInt(0, maxAffordableSigns + 1);
  const afterSigns = variableBudget - signs * Number(state.signCost);
  const maxAffordableGlasses = Math.min(
    scale.maxGlasses,
    Math.floor(afterSigns / Number(state.unitCost)),
  );

  return Object.freeze({
    glasses: glassCount(random.nextInt(0, maxAffordableGlasses + 1)),
    signs: signCount(signs),
    price: moneyCents(random.nextInt(1, scale.maxPriceCents + 1)),
  });
};

const runGeneratedCorpus = (initialState: GameState, seedValue: number): GameState => {
  let state = initialState;
  const environmentRandom = createSeededRandom(seed(seedValue));
  const decisionRandom = createSeededRandom(seed((seedValue ^ 0x9e_37_79_b9) >>> 0));

  for (let index = 0; index < MAX_GENERATED_DAYS; index += 1) {
    if (Number(availableOperatingFunds(state)) < Number(predictableFixedObligations(state))) {
      break;
    }

    const decision = generatedDecision(state, decisionRandom);
    const environment = generateEnvironment(state.day, environmentRandom);
    const resolution = simulateDay(state, decision, environment);
    const { entry, nextState, previousState } = resolution;

    expect(Number(entry.sold)).toBeLessThanOrEqual(Number(entry.decision.glasses));
    expect(Number(entry.revenue)).toBe(Number(entry.sold) * Number(entry.decision.price));
    expect(Number(entry.revenue) + Number(entry.financeIncome) - Number(entry.expenses)).toBe(
      Number(entry.net),
    );

    const openingEquity = Number(previousState.cash) - Number(previousState.loanBalance);
    const endingEquity = Number(entry.endingCash) - Number(entry.endingLoanBalance);
    expect(endingEquity).toBe(openingEquity + Number(entry.net));
    expect(Number(entry.cashDelta)).toBe(Number(entry.endingCash) - Number(previousState.cash));

    expect(nextState.cash).toBe(entry.endingCash);
    expect(nextState.loanBalance).toBe(entry.endingLoanBalance);
    expect(Number(nextState.day)).toBe(Number(previousState.day) + 1);
    expect(nextState.ledger).toHaveLength(previousState.ledger.length + 1);
    expect(nextState.ledger.at(-1)).toBe(entry);

    state = nextState;
  }

  return state;
};

describe("generated simulation invariants", () => {
  it("replays generated decision/environment corpora deterministically", () => {
    for (const initialState of initialStates) {
      for (const seedValue of GENERATED_SEEDS) {
        const first = runGeneratedCorpus(initialState, seedValue);
        const repeated = runGeneratedCorpus(initialState, seedValue);

        expect(repeated).toEqual(first);
      }
    }
  });
});
