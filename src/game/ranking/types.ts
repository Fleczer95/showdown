// Wire + on-device types for the global ranking (ADR-0004).

/**
 * A board entry at `rankings/{game}/periods/{period}/entries/{uuid}`, where
 * `period` is a UTC `YYYY-MM` month or the literal `alltime`. Deliberately minimal — no progress,
 * timestamp, or expiresAt (see ADR-0004). The doc id is the device UUID.
 */
export interface RankingEntry {
    nickname: string;
    score: number;
    /**
     * Earned signature slug (e.g. 'fire'), system-derived from the player's level at
     * write time — never user input. Absent below the first signature tier or for
     * entries written before the feature shipped. Resolved to an emoji at render time
     * via `signatureEmoji`. Constrained to the known slug allowlist by Firestore rules.
     */
    signature?: string;
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
