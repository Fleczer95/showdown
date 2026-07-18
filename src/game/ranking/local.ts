import { createMMKV } from 'react-native-mmkv';
import { RANKED_GAMES, type RankingScope } from './config';
import type { LocalRankingState } from './types';

// Per-device, per-game ranking state (ADR-0004). Mirrors the local leaderboard:
// the device remembers its own best per scope and whether that best has been
// resolved, so a failed push can be retried later. "Resolved" does not guarantee
// board visibility: below-cutoff scores and terminal rejections need no retry.
// The rankings view only surfaces the actionable pending state.

const store = createMMKV({ id: 'showdown-ranking' });

function read(game: string): LocalRankingState {
    const json = store.getString(game);
    if (!json) return {};
    try {
        const parsed = JSON.parse(json);
        return parsed && typeof parsed === 'object' ? (parsed as LocalRankingState) : {};
    } catch {
        return {};
    }
}

function write(game: string, state: LocalRankingState): void {
    store.set(game, JSON.stringify(state));
}

export function getLocalState(game: string): LocalRankingState {
    return read(game);
}

/**
 * Record a run's score as the new best for a scope if it beats the stored one
 * (a new month always counts as a fresh best). Returns true when it became the
 * best — i.e. there is something new to push. A new best is marked unsynced
 * until its push is written or terminally resolved.
 */
export function recordBestIfHigher(game: string, scope: RankingScope, score: number, monthId: string): boolean {
    const state = read(game);
    if (scope === 'alltime') {
        if (state.allTime && score <= state.allTime.score) return false;
        write(game, { ...state, allTime: { score, synced: false } });
        return true;
    }
    // month: a different stored month means the previous best no longer applies.
    if (state.month?.monthId === monthId && score <= state.month.score) return false;
    write(game, { ...state, month: { score, monthId, synced: false } });
    return true;
}

/** Flag a scope's best as resolved (written to the global board, or terminal). */
export function markSynced(game: string, scope: RankingScope): void {
    const state = read(game);
    if (scope === 'alltime') {
        if (state.allTime) write(game, { ...state, allTime: { ...state.allTime, synced: true } });
    } else if (state.month) {
        write(game, { ...state, month: { ...state.month, synced: true } });
    }
}

/** A best awaiting (re)push. The month variant carries its bucket. */
export interface PendingBest {
    game: string;
    scope: RankingScope;
    score: number;
    monthId?: string;
}

/** Every unresolved best across all games — the retry queue. */
export function listPending(): PendingBest[] {
    const pending: PendingBest[] = [];
    for (const game of RANKED_GAMES) {
        const state = read(game);
        if (state.allTime && !state.allTime.synced) {
            pending.push({ game, scope: 'alltime', score: state.allTime.score });
        }
        if (state.month && !state.month.synced) {
            pending.push({ game, scope: 'month', score: state.month.score, monthId: state.month.monthId });
        }
    }
    return pending;
}
