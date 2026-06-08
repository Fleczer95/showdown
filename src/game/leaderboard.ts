import { createMMKV } from 'react-native-mmkv';

// Local, per-game top-10 leaderboards. Mirrors `history.ts`: pure ranking
// logic is exported for testing, MMKV I/O is a thin wrapper. Every game now
// stores a unified points score (see `scoring.ts`); the UI formats uniformly.

export interface LeaderboardEntry {
    nickname: string;
    /** Unified points score; higher is always better. */
    score: number;
    /** Epoch ms when saved; used for tie-breaking and the row date. */
    timestamp: number;
}

export const BOARD_SIZE = 10;
export const MAX_NICKNAME_LENGTH = 12;

/** Sort by score descending; ties resolved oldest-first (smaller timestamp ranks higher). */
export function rankEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
    return [...entries].sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
}

/** A score qualifies when the board has room, or it strictly beats the current lowest. */
export function qualifies(entries: LeaderboardEntry[], score: number): boolean {
    if (entries.length < BOARD_SIZE) return true;
    const lowest = Math.min(...entries.map((e) => e.score));
    return score > lowest;
}

/**
 * Insert an entry, re-rank, and cap at BOARD_SIZE.
 * Returns the capped board and the inserted entry's rank index (-1 if it fell off).
 */
export function insertEntry(
    entries: LeaderboardEntry[],
    next: LeaderboardEntry,
): { board: LeaderboardEntry[]; index: number } {
    const board = rankEntries([...entries, next]).slice(0, BOARD_SIZE);
    return { board, index: board.indexOf(next) };
}

// --- Persistence -----------------------------------------------------------

// v2: unified points scoring changed every game's scale, so old boards are not
// comparable and are cleanly abandoned by bumping the namespace (no migration).
const boardStore = createMMKV({ id: 'showdown-leaderboard-v2' });
const prefsStore = createMMKV({ id: 'showdown' });
const LAST_NICKNAME_KEY = 'lastNickname';

/** Read a game's board, ranked. Empty when nothing has been saved. */
export function getBoard(gameId: string): LeaderboardEntry[] {
    const json = boardStore.getString(gameId);
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? rankEntries(parsed as LeaderboardEntry[]) : [];
    } catch {
        return [];
    }
}

/**
 * Save a score under a nickname. Persists the capped board and returns the
 * created entry (its `timestamp` identifies its row for highlighting).
 */
export function saveScore(gameId: string, nickname: string, score: number): LeaderboardEntry {
    const next: LeaderboardEntry = { nickname, score, timestamp: Date.now() };
    const { board } = insertEntry(getBoard(gameId), next);
    boardStore.set(gameId, JSON.stringify(board));
    return next;
}

/** The last nickname used to save a score, shared across all games (empty if none). */
export function getLastNickname(): string {
    return prefsStore.getString(LAST_NICKNAME_KEY) ?? '';
}

export function setLastNickname(nickname: string): void {
    prefsStore.set(LAST_NICKNAME_KEY, nickname);
}
