// Wire + on-device types for the global ranking (ADR-0004).

/**
 * A board entry at `rankings/{game}/months/{YYYY-MM}/entries/{uuid}` or
 * `rankings/{game}/alltime/entries/{uuid}`. Deliberately minimal — no progress,
 * timestamp, or expiresAt (see ADR-0004). The doc id is the device UUID.
 */
export interface RankingEntry {
    nickname: string;
    score: number;
}

/** This device's locally-tracked best for one scope, plus its sync status. */
export interface LocalBest {
    score: number;
    /** False until the best has been confirmed-written to the global board. */
    synced: boolean;
}

/** Per-game local ranking state (MMKV). The month best is scoped to a bucket. */
export interface LocalRankingState {
    allTime?: LocalBest;
    month?: LocalBest & { monthId: string };
}
