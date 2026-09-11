# Run persistence contract

Phase 8 provides durable runs without making persistence part of the simulation engine.

## Boundary

The deterministic simulation remains storage-agnostic. Browser persistence lives at the web application boundary and consumes validated simulation values.

```text
packages/simulation
        ^
        |
apps/web/src/persistence.ts
        ^
        |
IndexedDB / portable JSON
```

The persistence boundary has four responsibilities:

1. serialize a run into an explicit portable schema;
2. migrate older save schemas forward when a migration is defined;
3. validate all imported/stored data before reconstructing branded domain values;
4. adapt the validated document to native browser storage.

It never recomputes historical ledger entries from current balance rules.

## Schema version 2

A portable document records:

- `saveSchemaVersion` — format/migration version;
- `simulationSchemaVersion` — ruleset/domain compatibility version;
- `run.seed` — deterministic environment-sequence identity;
- `run.state` — state at the start of the current day, including immutable completed-day history;
- `run.environment` — the already-selected current-day weather, sentiment, and event;
- `run.draft` — the three current player decisions;
- `run.phase` — either `deciding` or `report`; a report contains the validated next state produced by the current-day resolution.

Money remains integer cents. Counts, days, seeds, multipliers, tiers, variant discriminants, every ledger line, and phase payloads are validated before conversion back into simulation types.

The validator checks that:

- ledger length equals the number of completed days;
- ledger day numbers are contiguous from day 1;
- current cash equals the final historical ledger entry's ending cash;
- current debt equals the final historical ledger entry's ending loan balance;
- every completed-day environment and the current environment belong to the stored seed under the matching simulation schema;
- a stored report transition exactly matches the deterministic resolution of the stored state, draft, and environment.

The final report check only verifies the current transition. Historical ledger entries are accepted as stored after structural/accounting consistency checks and are never regenerated from current balance constants.

## Save schema migration versus simulation compatibility

Save-schema migration and simulation/ruleset compatibility are intentionally separate.

A known older save schema may be migrated structurally into the current format. A save created against a different simulation schema is rejected unless a separate, explicit compatibility policy is implemented. This prevents a new balance model from silently changing historical outcomes.

Migration paths currently include:

- prototype `schemaVersion: 0` -> schema 1 -> schema 2;
- schema 1 -> schema 2, with the missing phase represented as `deciding`.

A structural migration never pretends that an incompatible ruleset is compatible.

## Deterministic environment restoration

The environment RNG is reconstructed from `run.seed` by replaying environment selection through the current day. Each replayed completed-day environment is checked against its immutable ledger entry and the final draw is checked against `run.environment`.

After validation, the resulting random source is positioned immediately after the current day's environment draw. Advancing from a restored report therefore generates exactly the same next-day environment as uninterrupted play.

The random stream used by scene/audio presentation remains independent of this simulation contract.

## Browser storage

The browser adapter uses IndexedDB rather than `localStorage` because a run contains structured historical data and needs an explicit storage version. One key, `current`, owns the active run.

Storage contains the same JSON text used for portable export. Loading therefore always traverses the same migration and validation path as importing a file; browser storage is not trusted merely because the application wrote it previously.

The application restores the current run before constructing `LemonadeApp`. Writes are serialized and occur at deterministic application transitions:

```text
deciding -> report
report   -> deciding
```

Changing a slider is not itself a durable simulation transition. The current three-value draft is captured with the next committed transition.

If IndexedDB is unavailable, the game remains playable in a clearly reported non-persistent mode. If stored data is corrupt, unsupported, or from a future schema, bootstrap stops at an explicit recovery surface and leaves the document untouched until the player chooses to discard it.

## Portable import/export and reset

Run-data controls are deliberately outside the daily operating form so the game's decision surface remains exactly three variables and one Sell action.

- **Export run** emits human-inspectable schema-v2 JSON.
- **Import run** validates and stores the selected document, then reloads through the normal bootstrap path.
- **Reset run** requires explicit confirmation before clearing the current IndexedDB run.

Import and browser restore therefore share the same migration, validation, RNG-restoration, and application-construction path.

## Certification

Unit fixtures cover deciding/report round trips, legacy migration, future/incompatible versions, ledger corruption, report tampering, environment-seed mismatch, invalid JSON, and RNG positioning.

Playwright covers:

- report restoration across a browser reload;
- next-day restoration after advancing from a report;
- portable export followed by import into a separate clean browser context.

A future `packages/persistence` extraction is appropriate if another runtime (for example Tauri) needs the same schema/migration layer. Until then, keeping the boundary in the only consuming runtime avoids creating a workspace package solely for indirection.
