import { getHistory } from './history';
import { ownedQuestionIds } from './challenge/resolve';
import type { History } from './deck';

export interface PoolCoverage {
    /** Distinct questions shown at least once. Equals `total` once fully cycled. */
    seen: number;
    /** Size of the rotatable pool (free base + owned premium packs). */
    total: number;
    /** Completed full passes over the pool = the minimum show-count across it. */
    floor: number;
    /** Questions shown more than `floor` times — progress through the current lap. */
    reseen: number;
}

/** Pure coverage stats for a set of question ids against a show-count history. */
export function computeCoverage(ids: Iterable<string>, history: History): PoolCoverage {
    const counts: number[] = [];
    for (const id of ids) counts.push(history[id] ?? 0);
    const total = counts.length;
    if (total === 0) return { seen: 0, total: 0, floor: 0, reseen: 0 };

    const floor = Math.min(...counts);
    let seen = 0;
    let reseen = 0;
    for (const c of counts) {
        if (c > 0) seen += 1;
        if (c > floor) reseen += 1;
    }
    return { seen, total, floor, reseen };
}

/**
 * How much of a game's combined question inventory the player has worked
 * through. Selection itself may use narrower difficulty pools, but once every
 * question has been seen once (`seen === total`), `floor` counts completed
 * whole-inventory laps and `reseen` is progress into the current one. That lets
 * the setup-screen meter keep moving past 100% — showing "lap 2", "lap 3"… —
 * instead of freezing, while still nudging a pack purchase as the only source
 * of genuinely new questions.
 */
export function poolCoverage(gameId: string, ownedIds: ReadonlySet<string>): PoolCoverage {
    return computeCoverage(ownedQuestionIds(gameId, ownedIds), getHistory(gameId));
}
