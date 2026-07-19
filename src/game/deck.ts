// Pure least-recently-shown selection. No React / react-native imports.
//
// Games sample N questions per run from a pool. To avoid repeating questions too
// often, we order candidates so the least-shown come first: each selection pool
// cycles before repeating any, and once every item is equally seen the pool
// reshuffles. Count-based, so it self-cycles with no explicit reset. See
// docs/decisions/0002-count-based-question-history.md.

/** Per-game record of how many times each question id has been shown. */
export type History = Record<string, number>;

type Rng = () => number;

/** Fisher–Yates shuffle returning a new array. Deterministic given `rng`. */
function shuffle<T>(items: T[], rng: Rng): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * Order `items` least-shown-first: group by show-count (0 when absent from
 * `history`), sort the groups ascending, and shuffle within each group. Callers
 * take the first N for a run — guaranteeing the passed pool is cycled before
 * any repeat, while a just-seen item (higher count) sinks to the back.
 */
export function createDeck<T extends { id: string }>(items: T[], history: History, rng: Rng = Math.random): T[] {
    const byCount = new Map<number, T[]>();
    for (const item of items) {
        const count = history[item.id] ?? 0;
        const tier = byCount.get(count);
        if (tier) {
            tier.push(item);
        } else {
            byCount.set(count, [item]);
        }
    }

    const deck: T[] = [];
    for (const count of [...byCount.keys()].sort((a, b) => a - b)) {
        deck.push(...shuffle(byCount.get(count)!, rng));
    }
    return deck;
}
