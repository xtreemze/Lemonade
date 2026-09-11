import { describe, expect, it } from "vitest";

import {
  SIMULATION_SCHEMA_VERSION,
  createInitialState,
  glassCount,
  moneyCents,
  neutralEnvironment,
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
  type RunSnapshot,
} from "../src/persistence.js";

const createFixture = (): RunSnapshot => {
  const decision = Object.freeze({
    glasses: glassCount(20),
    signs: signCount(1),
    price: moneyCents(10),
  });
  const resolution = simulateDay(createInitialState(), decision, neutralEnvironment());

  return Object.freeze({
    seed: seed(0x1e_ad_2026),
    state: resolution.nextState,
    environment: neutralEnvironment(),
    draft: decision,
  });
};

describe("run persistence", () => {
  it("round-trips a complete deterministic run snapshot", () => {
    const snapshot = createFixture();
    const restored = importRunSnapshot(exportRunSnapshot(snapshot));

    expect(restored).toEqual(snapshot);
    expect(restored.state.ledger).toHaveLength(1);
    expect(restored.state.ledger[0]).toEqual(snapshot.state.ledger[0]);
  });

  it("writes explicit save and simulation schema versions", () => {
    const document = createRunSaveDocument(createFixture());

    expect(document.saveSchemaVersion).toBe(RUN_SAVE_SCHEMA_VERSION);
    expect(document.simulationSchemaVersion).toBe(SIMULATION_SCHEMA_VERSION);
  });

  it("migrates the pre-versioned prototype shape to schema version 1", () => {
    const snapshot = createFixture();
    const legacy = {
      schemaVersion: 0,
      simulationSchemaVersion: SIMULATION_SCHEMA_VERSION,
      seed: Number(snapshot.seed),
      state: snapshot.state,
      environment: snapshot.environment,
    };

    const restored = decodeRunSaveDocument(legacy);

    expect(restored.state).toEqual(snapshot.state);
    expect(restored.environment).toEqual(snapshot.environment);
    expect(restored.draft).toEqual({ glasses: 20, signs: 1, price: 10 });
  });

  it("rejects future save schemas with an actionable error", () => {
    const document = createRunSaveDocument(createFixture());

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
    const document = createRunSaveDocument(createFixture());

    expect(() =>
      decodeRunSaveDocument({
        ...document,
        simulationSchemaVersion: SIMULATION_SCHEMA_VERSION + 1,
      }),
    ).toThrow(/requires/);
  });

  it("rejects corrupt ledger history instead of recomputing it", () => {
    const document = createRunSaveDocument(createFixture());
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

  it("rejects invalid JSON before it reaches domain parsing", () => {
    expect(() => importRunSnapshot("{not-json}")).toThrow(/not valid JSON/);
  });
});
