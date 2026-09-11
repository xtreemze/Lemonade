import type {
  BasisPoints,
  DayNumber,
  GlassCount,
  MoneyCents,
  SignedMoneyCents,
  SignCount,
} from "./primitives.js";

export type Weather =
  | Readonly<{ kind: "sunny"; demandMultiplier: BasisPoints }>
  | Readonly<{ kind: "cloudy"; demandMultiplier: BasisPoints }>
  | Readonly<{ kind: "hot-and-dry"; demandMultiplier: BasisPoints }>
  | Readonly<{ kind: "thunderstorm"; demandMultiplier: BasisPoints }>;

export type MarketSentiment =
  | Readonly<{ kind: "very-cold"; demandMultiplier: BasisPoints }>
  | Readonly<{ kind: "cold"; demandMultiplier: BasisPoints }>
  | Readonly<{ kind: "neutral"; demandMultiplier: BasisPoints }>
  | Readonly<{ kind: "warm"; demandMultiplier: BasisPoints }>
  | Readonly<{ kind: "hot"; demandMultiplier: BasisPoints }>;

export type DayEvent =
  | Readonly<{ kind: "none"; demandMultiplier: BasisPoints }>
  | Readonly<{ kind: "street-work"; demandMultiplier: BasisPoints }>
  | Readonly<{ kind: "workers-buy-out"; demandMultiplier: BasisPoints }>;

export type DayEnvironment = Readonly<{
  weather: Weather;
  sentiment: MarketSentiment;
  event: DayEvent;
}>;

export type DayDecision = Readonly<{
  glasses: GlassCount;
  signs: SignCount;
  price: MoneyCents;
}>;

export type ProgressionTier = 0 | 1 | 2 | 3 | 4;

export type LedgerLineKind =
  | "revenue"
  | "production"
  | "advertising"
  | "operating-fee"
  | "tax"
  | "bank-fee"
  | "savings-interest"
  | "loan-interest"
  | "loan-draw"
  | "loan-repayment";

export type LedgerLine = Readonly<{
  kind: LedgerLineKind;
  label: string;
  amount: MoneyCents;
  direction: "credit" | "debit";
}>;

export type DailyLedgerEntry = Readonly<{
  day: DayNumber;
  tier: ProgressionTier;
  decision: DayDecision;
  environment: DayEnvironment;
  potentialDemand: GlassCount;
  sold: GlassCount;
  revenue: MoneyCents;
  financeIncome: MoneyCents;
  expenses: MoneyCents;
  net: SignedMoneyCents;
  cashDelta: SignedMoneyCents;
  borrowed: MoneyCents;
  repaid: MoneyCents;
  endingCash: MoneyCents;
  endingLoanBalance: MoneyCents;
  lines: readonly LedgerLine[];
}>;

export type GameState = Readonly<{
  day: DayNumber;
  cash: MoneyCents;
  loanBalance: MoneyCents;
  unitCost: MoneyCents;
  signCost: MoneyCents;
  tier: ProgressionTier;
  ledger: readonly DailyLedgerEntry[];
}>;

export type DayResolution = Readonly<{
  previousState: GameState;
  nextState: GameState;
  entry: DailyLedgerEntry;
}>;
