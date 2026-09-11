import { describe, expect, it } from "vitest";

import {
  SIMULATION_SCHEMA_VERSION,
  createInitialState,
  createSeededRandom,
  dayNumber,
  generateEnvironment,
  glassCount,
  moneyCents,
  seed,
  signCount,
  simulateDay,
} from "@lemonade/simulation";

import {
  RUN_SAVE_SCHEMA_VERSION,
  RunPersistenceError,
  createRunSaveDocument,
  decodeRunSaveDocument,
  exportRunSnapshot,
  importRunSnapshot,
  restoreEnvironmentRandom,
  type RunSnapshot,
} from "../src/persistence.js";

const RUN_SEED = seed(0x1e_ad_2026);
const decision = Object.freeze({
  glasses: glassCount(20),
  signs: signCount(1),
  price: moneyCents(10),
});

const createDecidingFixture = (): RunSnapshot => {
  const random = createSeededRandom(RUN_SEED);
  const initialState = createInitialState();
  const dayOneEnvironment = generateEnvironment(initialState.day, random);
  const resolution = simulateDay(initialState, decision, dayOneEnvironment);
  const dayTwoEnvironment = generateEnvironment(resolution.nextState.day, random);

  return Object.freeze({
    seed: RUN_SEED,
    state: resolution.nextState,
    environment: dayTwoEnvironment,
    draft: decision,
    phase: Object.freeze({ kind: "deciding" }),
  });
};

const createReportFixture = (): RunSnapshot => {
  const random = createSeededRandom(RUN_SEED);
  const state = createInitialState();
  const environment = generateEnvironment(state.day, random);
  const resolution = simulateDay(state, decision, environment);

  return Object.freeze({
    seed: RUN_SEED,
    state,
    environment,
    draft: decision,
    phase: Object.freeze({ kind: "report", resolution }),
  });
};

describe("run persistence", () => {
  it("round-trips a deciding snapshot with immutable history", () => {
    const snapshot = createDecidingFixture();
    const restored = importRunSnapshot(exportRunSnapshot(snapshot));

    expect(restored).toEqual(snapshot);
    expect(restored.state.ledger).toHaveLength(1);
    expect(restored.state.ledger[0]).toEqual(snapshot.state.ledger[0]);
    expect(restored.phase.kind).toBe("deciding");
  });

  it("round-trips the report phase without advancing or rewinding the day", () => {
    const snapshot = createReportFixture();
    const restored = importRunSnapshot(exportRunSnapshot(snapshot));

    expect(restored).toEqual(snapshot);
    expect(restored.state.day).toBe(snapshot.state.day);
    expect(restored.phase.kind).toBe("report");
  });

  it("writes explicit save and simulation schema versions", () => {
    const document = createRunSaveDocument(createDecidingFixture());

    expect(document.saveSchemaVersion).toBe(RUN_SAVE_SCHEMA_VERSION);
    expect(document.simulationSchemaVersion).toBe(SIMULATION_SCHEMA_VERSION);
  });

  it("migrates the pre-versioned prototype shape through schema version 2", () => {
    const random = createSeededRandom(RUN_SEED);
    const state = createInitialState();
    const environment = generateEnvironment(state.day, random);
    const legacy = {
      schemaVersion: 0,
      simulationSchemaVersion: SIMULATION_SCHEMA_VERSION,
      seed: Number(RUN_SEED),
      state,
      environment,
    };

    const restored = decodeRunSaveDocument(legacy);

    expect(restored.state).toEqual(state);
    expect(restored.environment).toEqual(environment);
    expect(restored.draft).toEqual({ glasses: 20, signs: 1, price: 10 });
    expect(restored.phase.kind).toBe("deciding");
  });

  it("migrates schema version 1 saves to a deciding phase", () => {
    const current = createRunSaveDocument(createDecidingFixture());
    const versionOne = {
      saveSchemaVersion: 1,
      simulationSchemaVersion: current.simulationSchemaVersion,
      run: {
        seed: current.run.seed,
        state: current.run.state,
        environment: current.run.environment,
        draft: current.run.draft,
      },
    };

    const restored = decodeRunSaveDocument(versionOne);

    expect(restored.phase.kind).toBe("deciding");
    expect(restored.state).toEqual(createDecidingFixture().state);
  });

  it("restores the RNG after the current environment draw", () => {
    const snapshot = createDecidingFixture();
    const restoredRandom = restoreEnvironmentRandom(snapshot);
    const nextFromRestored = generateEnvironment(
      dayNumber(Number(snapshot.state.day) + 1),
      restoredRandom,
    );

    const replay = createSeededRandom(RUN_SEED);
    generateEnvironment(dayNumber(1), replay);
    generateEnvironment(dayNumber(2), replay);
    const expected = generateEnvironment(dayNumber(3), replay);

    expect(nextFromRestored).toEqual(expected);
  });

  it("rejects a current environment that does not belong to the stored seed", () => {
    const document = createRunSaveDocument(createDecidingFixture());
    const corrupt = {
      ...document,
      run: {
        ...document.run,
        environment: {
          ...document.run.environment,
          weather: {
            kind: "thunderstorm",
            demandMultiplier: 0,
          },
        },
      },
    };

    expect(() => decodeRunSaveDocument(corrupt)).toThrow(/stored seed/);
  });

  it("rejects future save schemas with an actionable error", () => {
    const document = createRunSaveDocument(createDecidingFixture());

    expect(() =>
      decodeRunSaveDocument({
        ...document,
        saveSchemaVersion: RUN_SAVE_SCHEMA_VERSION + 1,
      }),
    ).toThrow(RunPersistenceError);

    try {
      decodeRunSaveDocument({
        ...document,
        saveSchemaVersion: RUN_SAVE_SCHEMA_VERSION + 1,
      });
      throw new Error("expected decode to fail");
    } catch (error) {
      if (!(error instanceof RunPersistenceError)) throw error;
      expect(error.code).toBe("unsupported-save-version");
    }
  });

  it("rejects saves from an incompatible simulation schema", () => {
    const document = createRunSaveDocument(createDecidingFixture());

    expect(() =>
      decodeRunSaveDocument({
        ...document,
        simulationSchemaVersion: SIMULATION_SCHEMA_VERSION + 1,
      }),
    ).toThrow(/requires/);
  });

  it("rejects corrupt ledger history instead of recomputing it", () => {
    const document = createRunSaveDocument(createDecidingFixture());
    const corrupt = {
      ...document,
      run: {
        ...document.run,
        state: {
          ...document.run.state,
          cash: document.run.state.cash + 1,
        },
      },
    };

    expect(() => decodeRunSaveDocument(corrupt)).toThrow(/ending cash/);
  });

  it("rejects a tampered report resolution", () => {
    const document = createRunSaveDocument(createReportFixture());
    if (document.run.phase.kind !== "report") throw new Error("expected report fixture");

    const corrupt = {
      ...document,
      run: {
        ...document.run,
        phase: {
          kind: "report",
          nextState: {
            ...document.run.phase.nextState,
            cash: document.run.phase.nextState.cash + 1,
          },
        },
      },
    };

    expect(() => decodeRunSaveDocument(corrupt)).toThrow();
  });

  it("rejects invalid JSON before it reaches domain parsing", () => {
    expect(() => importRunSnapshot("{not-json}")).toThrow(/not valid JSON/);
  });
});
