import {
  applyBasisPoints,
  availableOperatingFunds,
  financeRulesForTier,
  progressionTierForDay,
} from "./finance.js";
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

const decisionVariableExpenses = (state: GameState, decision: DayDecision) =>
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

const ledgerLine = (
  kind: LedgerLine["kind"],
  label: string,
  amount: ReturnType<typeof moneyCents>,
  direction: LedgerLine["direction"],
): LedgerLine => Object.freeze({ kind, label, amount, direction });

export const simulateDay = (
  state: GameState,
  decision: DayDecision,
  environment: DayEnvironment,
): DayResolution => {
  if (Number(decision.price) <= 0) {
    throw new RangeError("price must be greater than zero");
  }

  const finance = financeRulesForTier(state.tier);
  const variableExpenses = decisionVariableExpenses(state, decision);
  const predictableExpenses = moneyCents(
    Number(variableExpenses) + Number(finance.supplierFee) + Number(finance.bankFee),
  );
  const operatingFunds = availableOperatingFunds(state);

  if (Number(predictableExpenses) > Number(operatingFunds)) {
    throw new UnaffordableDecisionError(
      Number(predictableExpenses),
      Number(operatingFunds),
    );
  }

  const openingCashCents = Number(state.cash);
  const initialBorrowCents = Math.max(0, Number(predictableExpenses) - openingCashCents);
  let loanBalanceCents = Number(state.loanBalance) + initialBorrowCents;
  let cashCents = openingCashCents + initialBorrowCents - Number(predictableExpenses);

  const calculatedDemand = potentialDemand(decision.price, decision.signs, environment);
  const sold = resolveSold(decision, environment, Number(calculatedDemand));
  const reportedDemand =
    environment.event.kind === "workers-buy-out" &&
    environment.weather.kind !== "thunderstorm"
      ? glassCount(Math.max(Number(calculatedDemand), Number(decision.glasses)))
      : calculatedDemand;

  const revenue = moneyCents(Number(sold) * Number(decision.price));
  cashCents += Number(revenue);

  const taxableOperatingProfitCents = Math.max(
    0,
    Number(revenue) - Number(predictableExpenses),
  );
  const tax = applyBasisPoints(taxableOperatingProfitCents, finance.taxRate);
  cashCents -= Number(tax);

  const loanInterest = applyBasisPoints(loanBalanceCents, finance.loanInterestRate);
  const paidLoanInterestCents = Math.min(cashCents, Number(loanInterest));
  cashCents -= paidLoanInterestCents;
  loanBalanceCents += Number(loanInterest) - paidLoanInterestCents;

  const availableForRepaymentCents = Math.max(
    0,
    cashCents - Number(finance.workingCashReserve),
  );
  const repaidCents = Math.min(loanBalanceCents, availableForRepaymentCents);
  cashCents -= repaidCents;
  loanBalanceCents -= repaidCents;

  const savingsInterest =
    loanBalanceCents === 0
      ? applyBasisPoints(cashCents, finance.savingsInterestRate)
      : moneyCents(0);
  cashCents += Number(savingsInterest);

  const borrowed = moneyCents(initialBorrowCents);
  const repaid = moneyCents(repaidCents);
  const expenses = moneyCents(
    Number(predictableExpenses) + Number(tax) + Number(loanInterest),
  );
  const financeIncome = savingsInterest;
  const net = signedMoneyCents(
    Number(revenue) + Number(financeIncome) - Number(expenses),
  );
  const endingCash = moneyCents(cashCents);
  const endingLoanBalance = moneyCents(loanBalanceCents);
  const cashDelta = signedMoneyCents(Number(endingCash) - openingCashCents);
  const nextDay = dayNumber(Number(state.day) + 1);
  const nextTier = progressionTierForDay(nextDay);

  const lines: LedgerLine[] = [
    ledgerLine("revenue", "Lemonade sales", revenue, "credit"),
    ledgerLine(
      "production",
      "Prepared glasses",
      moneyCents(Number(decision.glasses) * Number(state.unitCost)),
      "debit",
    ),
    ledgerLine(
      "advertising",
      "Advertising signs",
      moneyCents(Number(decision.signs) * Number(state.signCost)),
      "debit",
    ),
  ];

  if (Number(finance.supplierFee) > 0) {
    lines.push(
      ledgerLine("operating-fee", "Supplier delivery", finance.supplierFee, "debit"),
    );
  }
  if (Number(finance.bankFee) > 0) {
    lines.push(ledgerLine("bank-fee", "Bank account fee", finance.bankFee, "debit"));
  }
  if (Number(tax) > 0) {
    lines.push(ledgerLine("tax", "Business tax", tax, "debit"));
  }
  if (Number(borrowed) > 0) {
    lines.push(ledgerLine("loan-draw", "Working-capital credit", borrowed, "credit"));
  }
  if (Number(loanInterest) > 0) {
    lines.push(ledgerLine("loan-interest", "Credit interest", loanInterest, "debit"));
  }
  if (Number(repaid) > 0) {
    lines.push(ledgerLine("loan-repayment", "Automatic credit repayment", repaid, "debit"));
  }
  if (Number(savingsInterest) > 0) {
    lines.push(
      ledgerLine("savings-interest", "Cash-account interest", savingsInterest, "credit"),
    );
  }

  const entry: DailyLedgerEntry = Object.freeze({
    day: state.day,
    tier: state.tier,
    decision,
    environment,
    potentialDemand: reportedDemand,
    sold,
    revenue,
    financeIncome,
    expenses,
    net,
    cashDelta,
    borrowed,
    repaid,
    endingCash,
    endingLoanBalance,
    lines: Object.freeze(lines),
  });

  const nextState: GameState = Object.freeze({
    day: nextDay,
    cash: endingCash,
    loanBalance: endingLoanBalance,
    unitCost: productionCostForDay(nextDay),
    signCost: state.signCost,
    tier: nextTier,
    ledger: Object.freeze([...state.ledger, entry]),
  });

  return Object.freeze({ previousState: state, nextState, entry });
};
