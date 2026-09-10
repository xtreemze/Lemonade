import type {
  DailyLedgerEntry,
  DayDecision,
  DayEnvironment,
  DayResolution,
  GameState,
  LedgerLine,
} from "./model.js";
import {
  dayNumber,
  glassCount,
  moneyCents,
  signedMoneyCents,
} from "./primitives.js";
import { potentialDemand } from "./rules.js";
import { productionCostForDay } from "./state.js";

export class UnaffordableDecisionError extends Error {
  public constructor(
    public readonly requiredCents: number,
    public readonly availableCents: number,
  ) {
    super(`decision costs ${requiredCents} cents but only ${availableCents} are available`);
    this.name = "UnaffordableDecisionError";
  }
}

const decisionExpenses = (state: GameState, decision: DayDecision) =>
  moneyCents(
    Number(decision.glasses) * Number(state.unitCost) +
      Number(decision.signs) * Number(state.signCost),
  );

const resolveSold = (
  decision: DayDecision,
  environment: DayEnvironment,
  demand: number,
) => {
  if (
    environment.event.kind === "workers-buy-out" &&
    environment.weather.kind !== "thunderstorm"
  ) {
    return decision.glasses;
  }

  return glassCount(Math.min(Number(decision.glasses), demand));
};

export const simulateDay = (
  state: GameState,
  decision: DayDecision,
  environment: DayEnvironment,
): DayResolution => {
  if (Number(decision.price) <= 0) {
    throw new RangeError("price must be greater than zero");
  }

  const expenses = decisionExpenses(state, decision);
  if (Number(expenses) > Number(state.cash)) {
    throw new UnaffordableDecisionError(Number(expenses), Number(state.cash));
  }

  const calculatedDemand = potentialDemand(decision.price, decision.signs, environment);
  const sold = resolveSold(decision, environment, Number(calculatedDemand));
  const reportedDemand =
    environment.event.kind === "workers-buy-out" &&
    environment.weather.kind !== "thunderstorm"
      ? glassCount(Math.max(Number(calculatedDemand), Number(decision.glasses)))
      : calculatedDemand;

  const revenue = moneyCents(Number(sold) * Number(decision.price));
  const net = signedMoneyCents(Number(revenue) - Number(expenses));
  const endingCash = moneyCents(Number(state.cash) + Number(net));
  const nextDay = dayNumber(Number(state.day) + 1);

  const lines: readonly LedgerLine[] = Object.freeze([
    Object.freeze({
      kind: "revenue",
      label: "Lemonade sales",
      amount: revenue,
      direction: "credit",
    }),
    Object.freeze({
      kind: "production",
      label: "Prepared glasses",
      amount: moneyCents(Number(decision.glasses) * Number(state.unitCost)),
      direction: "debit",
    }),
    Object.freeze({
      kind: "advertising",
      label: "Advertising signs",
      amount: moneyCents(Number(decision.signs) * Number(state.signCost)),
      direction: "debit",
    }),
  ]);

  const entry: DailyLedgerEntry = Object.freeze({
    day: state.day,
    decision,
    environment,
    potentialDemand: reportedDemand,
    sold,
    revenue,
    expenses,
    net,
    endingCash,
    lines,
  });

  const nextState: GameState = Object.freeze({
    day: nextDay,
    cash: endingCash,
    unitCost: productionCostForDay(nextDay),
    signCost: state.signCost,
    tier: state.tier,
    ledger: Object.freeze([...state.ledger, entry]),
  });

  return Object.freeze({ previousState: state, nextState, entry });
};
