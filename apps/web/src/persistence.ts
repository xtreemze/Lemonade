import {
  SIMULATION_SCHEMA_VERSION,
  basisPoints,
  createSeededRandom,
  dayNumber,
  generateEnvironment,
  glassCount,
  moneyCents,
  seed,
  signedMoneyCents,
  signCount,
  simulateDay,
  type DayDecision,
  type DayEnvironment,
  type DailyLedgerEntry,
  type DayResolution,
  type GameState,
  type LedgerLine,
  type ProgressionTier,
  type RandomSource,
  type Seed,
} from "@lemonade/simulation";

export const RUN_SAVE_SCHEMA_VERSION = 2 as const;

const DATABASE_NAME = "lemonade";
const DATABASE_VERSION = 1;
const RUN_STORE_NAME = "runs";
const CURRENT_RUN_KEY = "current";

const ledgerLineKinds = [
  "revenue",
  "production",
  "advertising",
  "operating-fee",
  "tax",
  "bank-fee",
  "savings-interest",
  "loan-interest",
  "loan-draw",
  "loan-repayment",
] as const;

const weatherKinds = ["sunny", "cloudy", "hot-and-dry", "thunderstorm"] as const;
const sentimentKinds = ["very-cold", "cold", "neutral", "warm", "hot"] as const;
const eventKinds = ["none", "street-work", "workers-buy-out"] as const;
const directions = ["credit", "debit"] as const;
const phaseKinds = ["deciding", "report"] as const;

export type RunPhase =
  | Readonly<{ kind: "deciding" }>
  | Readonly<{ kind: "report"; resolution: DayResolution }>;

export type RunSnapshot = Readonly<{
  seed: Seed;
  state: GameState;
  environment: DayEnvironment;
  draft: DayDecision;
  phase: RunPhase;
}>;

type SerializedDecision = Readonly<{
  glasses: number;
  signs: number;
  price: number;
}>;

type SerializedMultiplierVariant = Readonly<{
  kind: string;
  demandMultiplier: number;
}>;

type SerializedEnvironment = Readonly<{
  weather: SerializedMultiplierVariant;
  sentiment: SerializedMultiplierVariant;
  event: SerializedMultiplierVariant;
}>;

type SerializedLedgerLine = Readonly<{
  kind: string;
  label: string;
  amount: number;
  direction: string;
}>;

type SerializedLedgerEntry = Readonly<{
  day: number;
  tier: number;
  decision: SerializedDecision;
  environment: SerializedEnvironment;
  potentialDemand: number;
  sold: number;
  revenue: number;
  financeIncome: number;
  expenses: number;
  net: number;
  cashDelta: number;
  borrowed: number;
  repaid: number;
  endingCash: number;
  endingLoanBalance: number;
  lines: readonly SerializedLedgerLine[];
}>;

type SerializedGameState = Readonly<{
  day: number;
  cash: number;
  loanBalance: number;
  unitCost: number;
  signCost: number;
  tier: number;
  ledger: readonly SerializedLedgerEntry[];
}>;

type SerializedPhase =
  | Readonly<{ kind: "deciding" }>
  | Readonly<{ kind: "report"; nextState: SerializedGameState }>;

type RunSaveDocumentV1 = Readonly<{
  saveSchemaVersion: 1;
  simulationSchemaVersion: number;
  run: Readonly<{
    seed: number;
    state: unknown;
    environment: unknown;
    draft: unknown;
  }>;
}>;

type RunSaveDocumentV2 = Readonly<{
  saveSchemaVersion: typeof RUN_SAVE_SCHEMA_VERSION;
  simulationSchemaVersion: typeof SIMULATION_SCHEMA_VERSION;
  run: Readonly<{
    seed: number;
    state: SerializedGameState;
    environment: SerializedEnvironment;
    draft: SerializedDecision;
    phase: SerializedPhase;
  }>;
}>;

type PersistenceErrorCode =
  | "invalid-json"
  | "invalid-save"
  | "unsupported-save-version"
  | "unsupported-simulation-version"
  | "storage-unavailable"
  | "storage-failed";

export class RunPersistenceError extends Error {
  readonly code: PersistenceErrorCode;

  constructor(code: PersistenceErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RunPersistenceError";
    this.code = code;
  }
}

const invalidSave = (path: string, message: string): never => {
  throw new RunPersistenceError("invalid-save", `${path}: ${message}`);
};

const asRecord = (value: unknown, path: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalidSave(path, "expected an object");
  }
  return value as Record<string, unknown>;
};

const asSafeInteger = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    return invalidSave(path, "expected a safe integer");
  }
  return value;
};

const asNonNegativeInteger = (value: unknown, path: string): number => {
  const integer = asSafeInteger(value, path);
  if (integer < 0) return invalidSave(path, "expected a non-negative integer");
  return integer;
};

const asString = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    return invalidSave(path, "expected a non-empty string");
  }
  return value;
};

const asLiteral = <const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: string,
): Values[number] => {
  if (typeof value !== "string" || !values.includes(value)) {
    return invalidSave(path, `expected one of ${values.join(", ")}`);
  }
  return value;
};

const asTier = (value: unknown, path: string): ProgressionTier => {
  const tier = asSafeInteger(value, path);
  if (tier < 0 || tier > 4) return invalidSave(path, "expected progression tier 0 through 4");
  return tier as ProgressionTier;
};

const parseDecision = (value: unknown, path: string): DayDecision => {
  const record = asRecord(value, path);
  return Object.freeze({
    glasses: glassCount(asNonNegativeInteger(record["glasses"], `${path}.glasses`)),
    signs: signCount(asNonNegativeInteger(record["signs"], `${path}.signs`)),
    price: moneyCents(asNonNegativeInteger(record["price"], `${path}.price`)),
  });
};

const parseEnvironment = (value: unknown, path: string): DayEnvironment => {
  const record = asRecord(value, path);
  const weather = asRecord(record["weather"], `${path}.weather`);
  const sentiment = asRecord(record["sentiment"], `${path}.sentiment`);
  const event = asRecord(record["event"], `${path}.event`);

  return Object.freeze({
    weather: Object.freeze({
      kind: asLiteral(weather["kind"], weatherKinds, `${path}.weather.kind`),
      demandMultiplier: basisPoints(
        asNonNegativeInteger(weather["demandMultiplier"], `${path}.weather.demandMultiplier`),
      ),
    }),
    sentiment: Object.freeze({
      kind: asLiteral(sentiment["kind"], sentimentKinds, `${path}.sentiment.kind`),
      demandMultiplier: basisPoints(
        asNonNegativeInteger(
          sentiment["demandMultiplier"],
          `${path}.sentiment.demandMultiplier`,
        ),
      ),
    }),
    event: Object.freeze({
      kind: asLiteral(event["kind"], eventKinds, `${path}.event.kind`),
      demandMultiplier: basisPoints(
        asNonNegativeInteger(event["demandMultiplier"], `${path}.event.demandMultiplier`),
      ),
    }),
  });
};

const parseLedgerLine = (value: unknown, path: string): LedgerLine => {
  const record = asRecord(value, path);
  return Object.freeze({
    kind: asLiteral(record["kind"], ledgerLineKinds, `${path}.kind`),
    label: asString(record["label"], `${path}.label`),
    amount: moneyCents(asNonNegativeInteger(record["amount"], `${path}.amount`)),
    direction: asLiteral(record["direction"], directions, `${path}.direction`),
  });
};

const parseLedgerEntry = (value: unknown, path: string): DailyLedgerEntry => {
  const record = asRecord(value, path);
  const linesValue = record["lines"];
  if (!Array.isArray(linesValue)) return invalidSave(`${path}.lines`, "expected an array");

  return Object.freeze({
    day: dayNumber(asSafeInteger(record["day"], `${path}.day`)),
    tier: asTier(record["tier"], `${path}.tier`),
    decision: parseDecision(record["decision"], `${path}.decision`),
    environment: parseEnvironment(record["environment"], `${path}.environment`),
    potentialDemand: glassCount(
      asNonNegativeInteger(record["potentialDemand"], `${path}.potentialDemand`),
    ),
    sold: glassCount(asNonNegativeInteger(record["sold"], `${path}.sold`)),
    revenue: moneyCents(asNonNegativeInteger(record["revenue"], `${path}.revenue`)),
    financeIncome: moneyCents(
      asNonNegativeInteger(record["financeIncome"], `${path}.financeIncome`),
    ),
    expenses: moneyCents(asNonNegativeInteger(record["expenses"], `${path}.expenses`)),
    net: signedMoneyCents(asSafeInteger(record["net"], `${path}.net`)),
    cashDelta: signedMoneyCents(asSafeInteger(record["cashDelta"], `${path}.cashDelta`)),
    borrowed: moneyCents(asNonNegativeInteger(record["borrowed"], `${path}.borrowed`)),
    repaid: moneyCents(asNonNegativeInteger(record["repaid"], `${path}.repaid`)),
    endingCash: moneyCents(
      asNonNegativeInteger(record["endingCash"], `${path}.endingCash`),
    ),
    endingLoanBalance: moneyCents(
      asNonNegativeInteger(record["endingLoanBalance"], `${path}.endingLoanBalance`),
    ),
    lines: Object.freeze(
      linesValue.map((line, index) => parseLedgerLine(line, `${path}.lines[${String(index)}]`)),
    ),
  });
};

const parseGameState = (value: unknown, path: string): GameState => {
  const record = asRecord(value, path);
  const ledgerValue = record["ledger"];
  if (!Array.isArray(ledgerValue)) return invalidSave(`${path}.ledger`, "expected an array");

  const state = Object.freeze({
    day: dayNumber(asSafeInteger(record["day"], `${path}.day`)),
    cash: moneyCents(asNonNegativeInteger(record["cash"], `${path}.cash`)),
    loanBalance: moneyCents(
      asNonNegativeInteger(record["loanBalance"], `${path}.loanBalance`),
    ),
    unitCost: moneyCents(asNonNegativeInteger(record["unitCost"], `${path}.unitCost`)),
    signCost: moneyCents(asNonNegativeInteger(record["signCost"], `${path}.signCost`)),
    tier: asTier(record["tier"], `${path}.tier`),
    ledger: Object.freeze(
      ledgerValue.map((entry, index) =>
        parseLedgerEntry(entry, `${path}.ledger[${String(index)}]`),
      ),
    ),
  }) satisfies GameState;

  if (state.ledger.length !== Number(state.day) - 1) {
    return invalidSave(
      `${path}.ledger`,
      "ledger length must equal the number of completed days",
    );
  }

  state.ledger.forEach((entry, index) => {
    if (Number(entry.day) !== index + 1) {
      invalidSave(`${path}.ledger[${String(index)}].day`, "ledger days must be contiguous");
    }
  });

  const lastEntry = state.ledger.at(-1);
  if (lastEntry !== undefined) {
    if (Number(lastEntry.endingCash) !== Number(state.cash)) {
      return invalidSave(`${path}.cash`, "must match the last ledger entry ending cash");
    }
    if (Number(lastEntry.endingLoanBalance) !== Number(state.loanBalance)) {
      return invalidSave(
        `${path}.loanBalance`,
        "must match the last ledger entry ending loan balance",
      );
    }
  }

  return state;
};

const serializeDecision = (decision: DayDecision): SerializedDecision =>
  Object.freeze({
    glasses: Number(decision.glasses),
    signs: Number(decision.signs),
    price: Number(decision.price),
  });

const serializeEnvironment = (environment: DayEnvironment): SerializedEnvironment =>
  Object.freeze({
    weather: Object.freeze({
      kind: environment.weather.kind,
      demandMultiplier: Number(environment.weather.demandMultiplier),
    }),
    sentiment: Object.freeze({
      kind: environment.sentiment.kind,
      demandMultiplier: Number(environment.sentiment.demandMultiplier),
    }),
    event: Object.freeze({
      kind: environment.event.kind,
      demandMultiplier: Number(environment.event.demandMultiplier),
    }),
  });

const serializeLedgerLine = (line: LedgerLine): SerializedLedgerLine =>
  Object.freeze({
    kind: line.kind,
    label: line.label,
    amount: Number(line.amount),
    direction: line.direction,
  });

const serializeLedgerEntry = (entry: DailyLedgerEntry): SerializedLedgerEntry =>
  Object.freeze({
    day: Number(entry.day),
    tier: entry.tier,
    decision: serializeDecision(entry.decision),
    environment: serializeEnvironment(entry.environment),
    potentialDemand: Number(entry.potentialDemand),
    sold: Number(entry.sold),
    revenue: Number(entry.revenue),
    financeIncome: Number(entry.financeIncome),
    expenses: Number(entry.expenses),
    net: Number(entry.net),
    cashDelta: Number(entry.cashDelta),
    borrowed: Number(entry.borrowed),
    repaid: Number(entry.repaid),
    endingCash: Number(entry.endingCash),
    endingLoanBalance: Number(entry.endingLoanBalance),
    lines: Object.freeze(entry.lines.map(serializeLedgerLine)),
  });

const serializeGameState = (state: GameState): SerializedGameState =>
  Object.freeze({
    day: Number(state.day),
    cash: Number(state.cash),
    loanBalance: Number(state.loanBalance),
    unitCost: Number(state.unitCost),
    signCost: Number(state.signCost),
    tier: state.tier,
    ledger: Object.freeze(state.ledger.map(serializeLedgerEntry)),
  });

const serializePhase = (phase: RunPhase): SerializedPhase =>
  phase.kind === "deciding"
    ? Object.freeze({ kind: "deciding" })
    : Object.freeze({
        kind: "report",
        nextState: serializeGameState(phase.resolution.nextState),
      });

export const createRunSaveDocument = (snapshot: RunSnapshot): RunSaveDocumentV2 =>
  Object.freeze({
    saveSchemaVersion: RUN_SAVE_SCHEMA_VERSION,
    simulationSchemaVersion: SIMULATION_SCHEMA_VERSION,
    run: Object.freeze({
      seed: Number(snapshot.seed),
      state: serializeGameState(snapshot.state),
      environment: serializeEnvironment(snapshot.environment),
      draft: serializeDecision(snapshot.draft),
      phase: serializePhase(snapshot.phase),
    }),
  });

const migrateVersionZero = (value: Record<string, unknown>): RunSaveDocumentV1 => {
  const simulationSchemaVersion = asSafeInteger(
    value["simulationSchemaVersion"],
    "simulationSchemaVersion",
  );

  return Object.freeze({
    saveSchemaVersion: 1,
    simulationSchemaVersion,
    run: Object.freeze({
      seed: asNonNegativeInteger(value["seed"], "seed"),
      state: value["state"],
      environment: value["environment"],
      draft: Object.freeze({ glasses: 20, signs: 1, price: 10 }),
    }),
  });
};

const migrateVersionOne = (value: Record<string, unknown>): Record<string, unknown> => {
  const run = asRecord(value["run"], "save.run");
  return {
    ...value,
    saveSchemaVersion: RUN_SAVE_SCHEMA_VERSION,
    run: {
      ...run,
      phase: Object.freeze({ kind: "deciding" }),
    },
  };
};

export const migrateRunSaveDocument = (value: unknown): unknown => {
  const record = asRecord(value, "save");
  const rawVersion = record["saveSchemaVersion"] ?? record["schemaVersion"];
  const version = asSafeInteger(rawVersion, "saveSchemaVersion");

  if (version > RUN_SAVE_SCHEMA_VERSION) {
    throw new RunPersistenceError(
      "unsupported-save-version",
      `Save schema version ${String(version)} is newer than supported version ${String(RUN_SAVE_SCHEMA_VERSION)}.`,
    );
  }

  if (version === 0) {
    return migrateVersionOne(asRecord(migrateVersionZero(record), "save"));
  }
  if (version === 1) return migrateVersionOne(record);
  if (version === RUN_SAVE_SCHEMA_VERSION) return record;

  throw new RunPersistenceError(
    "unsupported-save-version",
    `Save schema version ${String(version)} is not supported.`,
  );
};

const serializedStatesEqual = (left: GameState, right: GameState): boolean =>
  JSON.stringify(serializeGameState(left)) === JSON.stringify(serializeGameState(right));

const parsePhase = (
  value: unknown,
  state: GameState,
  environment: DayEnvironment,
  draft: DayDecision,
  path: string,
): RunPhase => {
  const record = asRecord(value, path);
  const kind = asLiteral(record["kind"], phaseKinds, `${path}.kind`);
  if (kind === "deciding") return Object.freeze({ kind: "deciding" });

  const nextState = parseGameState(record["nextState"], `${path}.nextState`);
  const expected = simulateDay(state, draft, environment);
  if (!serializedStatesEqual(nextState, expected.nextState)) {
    return invalidSave(path, "report state does not match the deterministic day resolution");
  }

  const entry = nextState.ledger.at(-1);
  if (entry === undefined) return invalidSave(path, "report state must contain the resolved day");

  return Object.freeze({
    kind: "report",
    resolution: Object.freeze({ previousState: state, nextState, entry }),
  });
};

const environmentsEqual = (left: DayEnvironment, right: DayEnvironment): boolean =>
  left.weather.kind === right.weather.kind &&
  Number(left.weather.demandMultiplier) === Number(right.weather.demandMultiplier) &&
  left.sentiment.kind === right.sentiment.kind &&
  Number(left.sentiment.demandMultiplier) === Number(right.sentiment.demandMultiplier) &&
  left.event.kind === right.event.kind &&
  Number(left.event.demandMultiplier) === Number(right.event.demandMultiplier);

export const restoreEnvironmentRandom = (
  snapshot: Pick<RunSnapshot, "seed" | "state" | "environment">,
): RandomSource => {
  const random = createSeededRandom(snapshot.seed);
  const currentDay = Number(snapshot.state.day);

  for (let day = 1; day <= currentDay; day += 1) {
    const generated = generateEnvironment(dayNumber(day), random);
    const historical = snapshot.state.ledger[day - 1]?.environment;
    const expected = day === currentDay ? snapshot.environment : historical;
    if (expected === undefined || !environmentsEqual(generated, expected)) {
      return invalidSave(
        `save.run.environmentSequence[${String(day)}]`,
        "environment does not match the stored seed and simulation schema",
      );
    }
  }

  return random;
};

export const decodeRunSaveDocument = (value: unknown): RunSnapshot => {
  const migrated = asRecord(migrateRunSaveDocument(value), "save");
  const saveSchemaVersion = asSafeInteger(
    migrated["saveSchemaVersion"],
    "save.saveSchemaVersion",
  );
  if (saveSchemaVersion !== RUN_SAVE_SCHEMA_VERSION) {
    throw new RunPersistenceError(
      "unsupported-save-version",
      `Save schema version ${String(saveSchemaVersion)} is not supported.`,
    );
  }

  const simulationSchemaVersion = asSafeInteger(
    migrated["simulationSchemaVersion"],
    "save.simulationSchemaVersion",
  );
  if (simulationSchemaVersion !== SIMULATION_SCHEMA_VERSION) {
    throw new RunPersistenceError(
      "unsupported-simulation-version",
      `Save uses simulation schema ${String(simulationSchemaVersion)}; this build requires ${String(SIMULATION_SCHEMA_VERSION)}.`,
    );
  }

  const run = asRecord(migrated["run"], "save.run");
  const state = parseGameState(run["state"], "save.run.state");
  const environment = parseEnvironment(run["environment"], "save.run.environment");
  const draft = parseDecision(run["draft"], "save.run.draft");
  const snapshot = Object.freeze({
    seed: seed(asNonNegativeInteger(run["seed"], "save.run.seed")),
    state,
    environment,
    draft,
    phase: parsePhase(run["phase"], state, environment, draft, "save.run.phase"),
  }) satisfies RunSnapshot;

  restoreEnvironmentRandom(snapshot);
  return snapshot;
};

export const exportRunSnapshot = (snapshot: RunSnapshot): string =>
  `${JSON.stringify(createRunSaveDocument(snapshot), null, 2)}\n`;

export const importRunSnapshot = (document: string): RunSnapshot => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(document) as unknown;
  } catch (error) {
    throw new RunPersistenceError("invalid-json", "Run file is not valid JSON.", { cause: error });
  }
  return decodeRunSaveDocument(parsed);
};

const requestResult = <Result>(request: IDBRequest<Result>): Promise<Result> =>
  new Promise((resolve, reject) => {
    request.addEventListener(
      "success",
      () => {
        resolve(request.result);
      },
      { once: true },
    );
    request.addEventListener(
      "error",
      () => {
        reject(request.error ?? new Error("IndexedDB request failed."));
      },
      { once: true },
    );
  });

const transactionComplete = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.addEventListener(
      "complete",
      () => {
        resolve();
      },
      { once: true },
    );
    transaction.addEventListener(
      "abort",
      () => {
        reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
      },
      { once: true },
    );
    transaction.addEventListener(
      "error",
      () => {
        reject(transaction.error ?? new Error("IndexedDB transaction failed."));
      },
      { once: true },
    );
  });

const openDatabase = async (): Promise<IDBDatabase> => {
  if (!("indexedDB" in globalThis)) {
    throw new RunPersistenceError(
      "storage-unavailable",
      "IndexedDB is unavailable in this browser context.",
    );
  }

  try {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RUN_STORE_NAME)) {
        database.createObjectStore(RUN_STORE_NAME);
      }
    });
    return await requestResult(request);
  } catch (error) {
    if (error instanceof RunPersistenceError) throw error;
    throw new RunPersistenceError("storage-failed", "Unable to open browser run storage.", {
      cause: error,
    });
  }
};

export const saveCurrentRun = async (snapshot: RunSnapshot): Promise<void> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(RUN_STORE_NAME, "readwrite");
    transaction.objectStore(RUN_STORE_NAME).put(exportRunSnapshot(snapshot), CURRENT_RUN_KEY);
    await transactionComplete(transaction);
  } catch (error) {
    throw new RunPersistenceError("storage-failed", "Unable to save the current run.", {
      cause: error,
    });
  } finally {
    database.close();
  }
};

export const loadCurrentRun = async (): Promise<RunSnapshot | null> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(RUN_STORE_NAME, "readonly");
    const stored = await requestResult<unknown>(
      transaction.objectStore(RUN_STORE_NAME).get(CURRENT_RUN_KEY),
    );
    await transactionComplete(transaction);
    if (stored === undefined) return null;
    if (typeof stored !== "string") {
      return invalidSave("browser storage", "expected a text run document");
    }
    return importRunSnapshot(stored);
  } catch (error) {
    if (error instanceof RunPersistenceError) throw error;
    throw new RunPersistenceError("storage-failed", "Unable to load the current run.", {
      cause: error,
    });
  } finally {
    database.close();
  }
};

export const clearCurrentRun = async (): Promise<void> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(RUN_STORE_NAME, "readwrite");
    transaction.objectStore(RUN_STORE_NAME).delete(CURRENT_RUN_KEY);
    await transactionComplete(transaction);
  } catch (error) {
    throw new RunPersistenceError("storage-failed", "Unable to clear the current run.", {
      cause: error,
    });
  } finally {
    database.close();
  }
};
