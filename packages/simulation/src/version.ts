export const SIMULATION_SCHEMA_VERSION = 3 as const;

/**
 * Current market/gameplay ruleset. Save-document schema migration is handled
 * separately so historical v3 ledgers are never silently reinterpreted.
 */
export const SIMULATION_RULESET_VERSION = 4 as const;
export const LEGACY_SIMULATION_RULESET_VERSION = 3 as const;
