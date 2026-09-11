# Run persistence contract

Phase 8 introduces durable runs without making persistence part of the simulation engine.

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

It must never recompute historical ledger entries from current balance rules.

## Schema version 1

A portable document records:

- `saveSchemaVersion` — format/migration version;
- `simulationSchemaVersion` — ruleset/domain compatibility version;
- `run.seed` — deterministic environment-sequence identity;
- `run.state` — current immutable game state including the full daily ledger;
- `run.environment` — the already-selected current-day weather, sentiment, and event;
- `run.draft` — the three current player decisions.

Money remains integer cents. Counts, days, seeds, multipliers, tiers, variant discriminants, and every ledger line are validated before conversion back into simulation types.

The current validator additionally checks that:

- ledger length equals the number of completed days;
- ledger day numbers are contiguous from day 1;
- current cash equals the final ledger entry's ending cash;
- current debt equals the final ledger entry's ending loan balance.

These checks reject corrupted or internally inconsistent documents rather than attempting repair by replaying under current rules.

## Save schema migration versus simulation compatibility

Save-schema migration and simulation/ruleset compatibility are intentionally separate.

A known older save schema may be migrated structurally into the current format. A save created against a different simulation schema is rejected unless a separate, explicit compatibility policy is implemented. This prevents a new balance model from silently changing historical outcomes.

The initial migration fixture accepts the pre-versioned prototype shape (`schemaVersion: 0`) and wraps it in schema version 1 while supplying the original default three-control draft.

## Browser storage

The browser adapter uses IndexedDB rather than `localStorage` because a run contains structured historical data and needs an explicit storage version. One key, `current`, owns the active run in the first implementation.

Storage contains the same JSON text used for portable export. Loading therefore always traverses the same migration and validation path as importing a file; browser storage is not trusted merely because the application wrote it previously.

## Portable import/export

`exportRunSnapshot()` emits human-inspectable JSON with a trailing newline. `importRunSnapshot()` parses, migrates, validates, and reconstructs the run. This format is independent of a UI framework and is suitable for a later native file adapter without changing simulation APIs.

## Next integration slice

The web controller should next:

- restore the current run before constructing the primary day UI;
- save at deterministic state-transition boundaries;
- reconstruct the environment RNG position from the stored seed/day under the matching simulation schema;
- expose explicit export/import/reset actions without adding daily operating controls;
- surface storage/import failures as accessible actionable messages;
- add Playwright coverage proving a run survives reload and portable import into a clean browser context.

A future `packages/persistence` extraction is appropriate if another runtime (for example Tauri) needs the same schema/migration layer. Until then, keeping the boundary in the only consuming runtime avoids creating a workspace package solely for indirection.
