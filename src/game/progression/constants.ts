// Progression tunables — every value here is set from real session data without
// touching logic. XP is a separate, normalized, monotonic, never-spendable
// currency (see docs/superpowers/specs/2026-06-09-achievements-and-rewards-design.md).

/** Flat XP for completing any run — protects retention for weak/casual players. */
export const RUN_XP_FLOOR = 50;

/** Upper bound of the per-run skill term, scaled by each game's normalized result. */
export const SKILL_CAP = 100;

/** XP for the first play of each distinct game per local day (the breadth lever). */
export const BREADTH_BONUS = 75;

/** Flat XP paid by a one-off achievement. */
export const ACHIEVEMENT_XP_ONE_OFF = 200;

/** Flat XP paid by a tiered achievement, by tier. */
export const ACHIEVEMENT_XP_TIERS = {
    bronze: 100,
    silver: 250,
    gold: 500,
} as const;

/** "Quick Wit": a correct Ladder answer at or above this rung… */
export const QUICK_WIT_MIN_RUNG = 10;
/** …answered within this many seconds earns the feat. */
export const QUICK_WIT_MAX_SECONDS = 5;

/**
 * How many levels below the cap counts as "approaching max level". The threshold
 * itself is derived from the live LEVEL_MAP (see map.ts), so extending the map
 * moves the approach band up automatically — no value here changes.
 */
export const NEAR_MAX_LEVEL_BAND = 5;

/** MMKV namespace for persisted progression stats. */
export const PROGRESSION_STORE_ID = 'showdown-progression';
