import {
  createInitialState,
  createSeededRandom,
  dayNumber,
  generateEnvironment,
  glassCount,
  LEGACY_SIMULATION_RULESET_VERSION,
  moneyCents,
  neutralMarketMemory,
  replayLegacyDay,
  SIMULATION_RULESET_VERSION,
  SIMULATION_SCHEMA_VERSION,
  seed,
  signCount,
  simulateDay,
  simulateDayV4,
} from "@lemonade/simulation";
import { describe, expect, it } from "vitest";

import {
  createRunSaveDocument,
  decodeRunSaveDocument,
  exportRunSnapshot,
  importRunSnapshot,
  RUN_SAVE_SCHEMA_VERSION,
  RunPersistenceError,
  type RunSnapshot,
  restoreEnvironmentRandom,
} from "../src/persistence.js";

const RUN_SEED = seed(0x1e_ad_20_26);
const decision = Object.freeze({
  glasses: glassCount(5),
  signs: signCount(1),
  price: moneyCents(150),
});

const createDecidingFixture = (): RunSnapshot => {
  const random = createSeededRandom(RUN_SEED);
  const initialState = createInitialState();
  const dayOneEnvironment = generateEnvironment(initialState.day, random);
  const memoryBefore = neutralMarketMemory();
  const resolution = simulateDayV4(
    initialState,
    decision,
    dayOneEnvironment,
    RUN_SEED,
    memoryBefore,
  );
  const dayTwoEnvironment = generateEnvironment(resolution.nextState.day, random);

  return Object.freeze({
    seed: RUN_SEED,
    rulesetVersion: SIMULATION_RULESET_VERSION,
    marketMemory: resolution.market.memoryAfter,
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
  const memoryBefore = neutralMarketMemory();
  const resolution = simulateDayV4(state, decision, environment, RUN_SEED, memoryBefore);

  return Object.freeze({
    seed: RUN_SEED,
    rulesetVersion: SIMULATION_RULESET_VERSION,
    marketMemory: resolution.market.memoryAfter,
    state,
    environment,
    draft: decision,
    phase: Object.freeze({
      kind: "report",
      rulesetVersion: SIMULATION_RULESET_VERSION,
      marketMemoryBefore: memoryBefore,
      resolution,
    }),
  });
};

const createLegacyReportFixture = (): RunSnapshot => {
  const random = createSeededRandom(RUN_SEED);
  const state = createInitialState();
  const environment = generateEnvironment(state.day, random);
  const resolution = simulateDay(state, decision, environment);

  return Object.freeze({
    seed: RUN_SEED,
    rulesetVersion: SIMULATION_RULESET_VERSION,
    marketMemory: neutralMarketMemory(),
    state,
    environment,
    draft: decision,
    phase: Object.freeze({
      kind: "report",
      rulesetVersion: LEGACY_SIMULATION_RULESET_VERSION,
      resolution,
    }),
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
    if (restored.phase.kind === "report") {
      expect(restored.phase.rulesetVersion).toBe(SIMULATION_RULESET_VERSION);
      if (restored.phase.rulesetVersion === SIMULATION_RULESET_VERSION) {
        expect(restored.phase.resolution.market.outcomes).toEqual(
          snapshot.phase.kind === "report" &&
            snapshot.phase.rulesetVersion === SIMULATION_RULESET_VERSION
            ? snapshot.phase.resolution.market.outcomes
            : [],
        );
      }
    }
  });

  it("replays report saves created before operating-scale enforcement", () => {
    const random = createSeededRandom(RUN_SEED);
    const state = Object.freeze({
      ...createInitialState(),
      cash: moneyCents(3000),
    });
    const environment = generateEnvironment(state.day, random);
    const legacyDecision = Object.freeze({
      glasses: glassCount(20),
      signs: signCount(1),
      price: moneyCents(150),
    });
    const resolution = replayLegacyDay(state, legacyDecision, environment);
    const snapshot: RunSnapshot = Object.freeze({
      seed: RUN_SEED,
      rulesetVersion: SIMULATION_RULESET_VERSION,
      marketMemory: neutralMarketMemory(),
      state,
      environment,
      draft: legacyDecision,
      phase: Object.freeze({
        kind: "report",
        rulesetVersion: LEGACY_SIMULATION_RULESET_VERSION,
        resolution,
      }),
    });

    const restored = importRunSnapshot(exportRunSnapshot(snapshot));

    expect(restored).toEqual(snapshot);
    expect(restored.phase.kind).toBe("report");
  });

  it("writes explicit save schema, simulation schema, ruleset, and compact market memory", () => {
    const snapshot = createDecidingFixture();
    const document = createRunSaveDocument(snapshot);

    expect(document.saveSchemaVersion).toBe(RUN_SAVE_SCHEMA_VERSION);
    expect(document.simulationSchemaVersion).toBe(SIMULATION_SCHEMA_VERSION);
    expect(document.run.rulesetVersion).toBe(SIMULATION_RULESET_VERSION);
    expect(document.run.marketMemory).toEqual({
      expectedPrice: Number(snapshot.marketMemory.expectedPrice),
      advertisingFatigue: Number(snapshot.marketMemory.advertisingFatigue),
      stockoutPressure: Number(snapshot.marketMemory.stockoutPressure),
      excessPressure: Number(snapshot.marketMemory.excessPressure),
      satisfaction: Number(snapshot.marketMemory.satisfaction),
    });
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
    expect(restored.draft).toEqual({ glasses: 5, signs: 1, price: 150 });
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


  it("migrates schema version 2 deciding saves to an explicit neutral v4 boundary", () => {
    const legacy = createLegacyReportFixture();
    const legacyNext =
      legacy.phase.kind === "report" ? legacy.phase.resolution.nextState : legacy.state;
    const currentShape = createRunSaveDocument(
      Object.freeze({
        ...legacy,
        state: legacyNext,
        phase: Object.freeze({ kind: "deciding" }),
      }),
    );
    const versionTwo = {
      saveSchemaVersion: 2,
      simulationSchemaVersion: currentShape.simulationSchemaVersion,
      run: {
        seed: currentShape.run.seed,
        state: currentShape.run.state,
        environment: currentShape.run.environment,
        draft: currentShape.run.draft,
        phase: { kind: "deciding" },
      },
    };

    const restored = decodeRunSaveDocument(versionTwo);

    expect(restored.rulesetVersion).toBe(SIMULATION_RULESET_VERSION);
    expect(restored.marketMemory).toEqual(neutralMarketMemory());
    expect(restored.state).toEqual(legacyNext);
    expect(restored.state.ledger).toEqual(legacyNext.ledger);
    expect(restored.phase.kind).toBe("deciding");
  });

  it("preserves an in-progress v3 report while making the next unresolved day v4", () => {
    const legacy = createLegacyReportFixture();
    const currentShape = createRunSaveDocument(legacy);
    if (currentShape.run.phase.kind !== "report") {
      throw new Error("expected report fixture");
    }
    const versionTwo = {
      saveSchemaVersion: 2,
      simulationSchemaVersion: currentShape.simulationSchemaVersion,
      run: {
        seed: currentShape.run.seed,
        state: currentShape.run.state,
        environment: currentShape.run.environment,
        draft: currentShape.run.draft,
        phase: {
          kind: "report",
          nextState: currentShape.run.phase.nextState,
        },
      },
    };

    const restored = decodeRunSaveDocument(versionTwo);

    expect(restored.rulesetVersion).toBe(SIMULATION_RULESET_VERSION);
    expect(restored.marketMemory).toEqual(neutralMarketMemory());
    expect(restored.phase.kind).toBe("report");
    if (restored.phase.kind === "report") {
      expect(restored.phase.rulesetVersion).toBe(LEGACY_SIMULATION_RULESET_VERSION);
      expect(restored.phase.resolution.nextState).toEqual(
        legacy.phase.kind === "report" ? legacy.phase.resolution.nextState : legacy.state,
      );
    }
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
      if (!(error instanceof RunPersistenceError)) {
        throw error;
      }
      expect(error.code).toBe("unsupported-save-version");
    }
  });

  it("rejects saves from an incompatible simulation schema instead of reinterpreting balance", () => {
    const document = createRunSaveDocument(createDecidingFixture());

    expect(() =>
      decodeRunSaveDocument({
        ...document,
        simulationSchemaVersion: SIMULATION_SCHEMA_VERSION - 1,
      }),
    ).toThrow(/requires/);
    expect(() =>
      decodeRunSaveDocument({
        ...document,
        simulationSchemaVersion: SIMULATION_SCHEMA_VERSION + 1,
      }),
    ).toThrow(/requires/);
  });


  it("rejects unknown current ruleset metadata", () => {
    const document = createRunSaveDocument(createDecidingFixture());

    expect(() =>
      decodeRunSaveDocument({
        ...document,
        run: {
          ...document.run,
          rulesetVersion: 99,
        },
      }),
    ).toThrow(/ruleset/i);
  });

  it("rejects out-of-range compact market memory", () => {
    const document = createRunSaveDocument(createDecidingFixture());

    expect(() =>
      decodeRunSaveDocument({
        ...document,
        run: {
          ...document.run,
          marketMemory: {
            ...document.run.marketMemory,
            satisfaction: 10_001,
          },
        },
      }),
    ).toThrow(/marketMemory/i);
  });

  it("rejects a v4 report whose persisted post-day memory does not match replay", () => {
    const document = createRunSaveDocument(createReportFixture());
    if (document.run.phase.kind !== "report") {
      throw new Error("expected report fixture");
    }

    expect(() =>
      decodeRunSaveDocument({
        ...document,
        run: {
          ...document.run,
          marketMemory: {
            ...document.run.marketMemory,
            expectedPrice: document.run.marketMemory.expectedPrice + 1,
          },
        },
      }),
    ).toThrow(/market memory/i);
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
    if (document.run.phase.kind !== "report") {
      throw new Error("expected report fixture");
    }

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
