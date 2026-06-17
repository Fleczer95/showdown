import { getHistory } from './history';
import { ownedQuestionIds } from './challenge/resolve';
import type { History } from './deck';

export interface PoolCoverage {
    /** Distinct questions shown at least once. */
    seen: number;
    /** Size of the rotatable pool (free base + owned premium packs). */
    total: number;
}

/** Count ids in `ids` that have been shown at least once. Pure. */
export function countSeen(ids: Iterable<string>, history: History): number {
    let seen = 0;
    for (const id of ids) if ((history[id] ?? 0) > 0) seen += 1;
    return seen;
}

/**
 * How much of a game's question pool the player has already worked through.
 * Because the deck cycles the whole pool before repeating anything (see
 * `deck.ts`), `seen / total` nearing 1 means repeats are imminent — the signal
 * the setup screen uses to nudge a pack purchase. `total` grows when a premium
 * pack is owned, so buying genuinely refills the meter.
 */
export function poolCoverage(gameId: string, ownedIds: ReadonlySet<string>): PoolCoverage {
    const ids = ownedQuestionIds(gameId, ownedIds);
    return { seen: countSeen(ids, getHistory(gameId)), total: ids.size };
}
