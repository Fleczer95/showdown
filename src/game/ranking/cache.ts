import { createMMKV } from 'react-native-mmkv';
import type { RankingScope } from './config';
import type { RankingEntry } from './types';

// A short-lived read cache for the global boards (ADR-0004). The rankings view is
// pure navigation — opening it, and toggling game/scope, each refetched the full
// top-`DISPLAY_SIZE` board uncached. A board barely moves minute-to-minute, so we
// keep the resolved board per (game, scope) and only hit the network when the
// cache is cold or stale. A hit also means the board renders offline. The push
// flow invalidates a game's cache so a just-submitted score shows on next open.
//
// The TTL was 24h under Firestore (to survive its tight Spark quotas); on the
// Cloudflare/D1 backend there is far more request headroom, so it is shorter for
// fresher boards while still collapsing repeat opens/toggles.

const store = createMMKV({ id: 'showdown-ranking-cache' });

/** A cached board: the resolved entries, which month they represent, and when pulled. */
export interface CachedBoard {
    board: RankingEntry[];
    /** The `YYYY-MM` bucket shown for the month scope; null for all-time. */
    displayedMonth: string | null;
    syncedAt: number;
}

/** Boards are pulled at most once per this window; navigation in between is free. */
export const BOARD_CACHE_TTL_MS = 60 * 60 * 1000;

function key(game: string, scope: RankingScope): string {
    return `${game}|${scope}`;
}

/** The cached board for a (game, scope), or null when missing or older than the TTL. */
export function readCachedBoard(game: string, scope: RankingScope, now: number = Date.now()): CachedBoard | null {
    const json = store.getString(key(game, scope));
    if (!json) return null;
    try {
        const parsed = JSON.parse(json) as CachedBoard;
        if (!parsed || now - parsed.syncedAt >= BOARD_CACHE_TTL_MS) return null;
        return parsed;
    } catch {
        return null;
    }
}

/** Cache a freshly-pulled board for the day; returns the stored record. */
export function writeCachedBoard(
    game: string,
    scope: RankingScope,
    board: RankingEntry[],
    displayedMonth: string | null,
    now: number = Date.now(),
): CachedBoard {
    const record: CachedBoard = { board, displayedMonth, syncedAt: now };
    store.set(key(game, scope), JSON.stringify(record));
    return record;
}

/** Drop a game's cached boards so the next pull reflects a just-submitted score. */
export function invalidateGameCache(game: string): void {
    store.remove(key(game, 'month'));
    store.remove(key(game, 'alltime'));
}
