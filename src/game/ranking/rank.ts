import { DISPLAY_SIZE, STORE_CAP, ROLLOVER_THRESHOLD } from './config';
import type { RankingEntry } from './types';

// Pure ranking logic for the global board (ADR-0004), mirroring the local
// leaderboard's split: testable functions here, Firestore/MMKV I/O elsewhere.
// The global board ranks by score alone (best single challenge score); equal
// scores keep their incoming order (document-id order from the Firestore query).

/** Sort entries by score descending. Stable, so equal scores keep input order. */
export function sortByScore(entries: RankingEntry[]): RankingEntry[] {
    return [...entries].sort((a, b) => b.score - a.score);
}

/** The top `DISPLAY_SIZE` entries, ranked — what a board actually shows. */
export function visibleBoard(entries: RankingEntry[]): RankingEntry[] {
    return sortByScore(entries).slice(0, DISPLAY_SIZE);
}

/**
 * Whether a score earns a slot, given how many entries the bucket holds and its
 * lowest stored score. Room (under the cap) always qualifies; a full bucket only
 * yields to a strictly higher score. Same shape as the local `qualifies()`.
 */
export function qualifies(storedCount: number, lowestScore: number, score: number): boolean {
    if (storedCount < STORE_CAP) return true;
    return score > lowestScore;
}

/**
 * Which month bucket the board should display (ADR-0004 delayed switch): the
 * current month once it has reached the threshold, otherwise the previous month
 * if it has any entries, otherwise the (sparse) current month. Falls back at
 * most one month.
 */
export function resolveDisplayedMonth(args: {
    currentCount: number;
    previousCount: number;
}): 'current' | 'previous' {
    if (args.currentCount >= ROLLOVER_THRESHOLD) return 'current';
    return args.previousCount > 0 ? 'previous' : 'current';
}
