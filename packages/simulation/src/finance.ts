import type { GameState, ProgressionTier } from "./model.js";
import {
  basisPoints,
  moneyCents,
  type BasisPoints,
  type DayNumber,
  type MoneyCents,
} from "./primitives.js";

export type FinanceRules = Readonly<{
  tier: ProgressionTier;
  supplierFee: MoneyCents;
  taxRate: BasisPoints;
  bankFee: MoneyCents;
  savingsInterestRate: BasisPoints;
  loanInterestRate: BasisPoints;
  creditLimit: MoneyCents;
  workingCashReserve: MoneyCents;
}>;

const RULES: Readonly<Record<ProgressionTier, FinanceRules>> = Object.freeze({
  0: Object.freeze({
    tier: 0,
    supplierFee: moneyCents(0),
    taxRate: basisPoints(0),
    bankFee: moneyCents(0),
    savingsInterestRate: basisPoints(0),
    loanInterestRate: basisPoints(0),
    creditLimit: moneyCents(0),
    workingCashReserve: moneyCents(0),
  }),
  1: Object.freeze({
    tier: 1,
    supplierFee: moneyCents(5),
    taxRate: basisPoints(0),
    bankFee: moneyCents(0),
    savingsInterestRate: basisPoints(0),
    loanInterestRate: basisPoints(0),
    creditLimit: moneyCents(0),
    workingCashReserve: moneyCents(0),
  }),
  2: Object.freeze({
    tier: 2,
    supplierFee: moneyCents(10),
    taxRate: basisPoints(500),
    bankFee: moneyCents(0),
    savingsInterestRate: basisPoints(0),
    loanInterestRate: basisPoints(0),
    creditLimit: moneyCents(0),
    workingCashReserve: moneyCents(0),
  }),
  3: Object.freeze({
    tier: 3,
    supplierFee: moneyCents(10),
    taxRate: basisPoints(750),
    bankFee: moneyCents(5),
    savingsInterestRate: basisPoints(10),
    loanInterestRate: basisPoints(40),
    creditLimit: moneyCents(500),
    workingCashReserve: moneyCents(200),
  }),
  4: Object.freeze({
    tier: 4,
    supplierFee: moneyCents(15),
    taxRate: basisPoints(1_000),
    bankFee: moneyCents(10),
    savingsInterestRate: basisPoints(15),
    loanInterestRate: basisPoints(60),
    creditLimit: moneyCents(2_000),
    workingCashReserve: moneyCents(500),
  }),
});

export const financeRulesForTier = (tier: ProgressionTier): FinanceRules => RULES[tier];

export const progressionTierForDay = (day: DayNumber): ProgressionTier => {
  const value = Number(day);
  if (value < 7) return 0;
  if (value < 14) return 1;
  if (value < 21) return 2;
  if (value < 35) return 3;
  return 4;
};

export const remainingCredit = (state: GameState): MoneyCents => {
  const limit = Number(financeRulesForTier(state.tier).creditLimit);
  return moneyCents(Math.max(0, limit - Number(state.loanBalance)));
};

export const availableOperatingFunds = (state: GameState): MoneyCents =>
  moneyCents(Number(state.cash) + Number(remainingCredit(state)));

export const applyBasisPoints = (amountCents: number, rate: BasisPoints): MoneyCents =>
  moneyCents(Math.round((amountCents * Number(rate)) / 10_000));
