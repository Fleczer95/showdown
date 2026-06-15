// Tunables and bucket helpers for the global ranking (ADR-0004). A per-game,
// score-only, bounded leaderboard fed by async-challenge completions. Pure
// constants + date helpers only — no React / Firestore here.

/** Entries shown on a board. */
export const DISPLAY_SIZE = 50;

/**
 * Entries kept per bucket. The buffer over `DISPLAY_SIZE` keeps the visible 50
 * backed by real data as entries churn. The cleanup script trims to this cap
 * (clients never delete); between runs a bucket may exceed it harmlessly since
 * display always takes the top `DISPLAY_SIZE` by score.
 */
export const STORE_CAP = 60;

/**
 * Entries the current month must reach before the board switches off the
 * previous month (the delayed switch — ADR-0004). Checked with a `count()`
 * aggregation, not a full read.
 */
export const ROLLOVER_THRESHOLD = 10;

/**
 * Loose sentinel ceiling on a score, enforced by the rules. Far above any
 * legitimate run; its only job is to stop one astronomically large write from
 * permanently pinning #1 on the never-resetting all-time board. Not a tight
 * anti-cheat bound.
 */
export const MAX_SCORE = 1_000_000_000;

/**
 * Months kept by the cleanup script: the current month plus this many back.
 * The rollover needs only current + previous; the extra month is slack.
 */
export const RETAINED_MONTHS_BACK = 2;

/** Games that have a global board. Mirrors the rules' allowlist. */
export const RANKED_GAMES = ['the-ladder', 'the-drop', 'the-wheel'] as const;
export type RankedGame = (typeof RANKED_GAMES)[number];

/** A board scope: the current calendar month, or all time. */
export type RankingScope = 'month' | 'alltime';

/**
 * Period doc id for the all-time scope. Months use a `YYYY-MM` id; both live as
 * sibling docs under `rankings/{game}/periods/{period}/entries/{uuid}`, so the
 * paths (and the security-rules match) are symmetric.
 */
export const ALLTIME_PERIOD = 'alltime';

/**
 * UTC `YYYY-MM` bucket id for an instant. UTC (not local time) so every device
 * agrees on the month boundary and matches the server-time check in the rules.
 */
export function monthBucketId(epochMs: number = Date.now()): string {
    const d = new Date(epochMs);
    const year = d.getUTCFullYear();
    const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
}

/** The `YYYY-MM` bucket one month before the given one. */
export function previousMonthBucketId(bucketId: string): string {
    const [year, month] = bucketId.split('-').map(Number);
    // `Date.UTC` normalizes a negative month back across the year boundary.
    return monthBucketId(Date.UTC(year, month - 2, 1));
}
