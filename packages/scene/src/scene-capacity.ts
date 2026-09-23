export const PASSERBY_FOREGROUND_TARGET = 20 as const;
export const PASSERBY_BASE_ACTIVE_COUNT = 28 as const;
export const PASSERBY_ACTIVE_LIMIT = 36 as const;
export const PASSERBY_VISUAL_POOL_SIZE = 48 as const;

// Preserve the historical buyer profile index range so reducing the passerby
// visual pool does not change seeded buyer appearances.
export const BUYER_PROFILE_INDEX_OFFSET = 128 as const;
export const BUYER_VISUAL_POOL_SIZE = 192 as const;
