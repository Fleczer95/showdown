// Stateful MMKV stub so reads see prior writes (mirrors local.test.ts), with a
// `delete` the cache uses for invalidation.
const mockStore = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
    createMMKV: () => ({
        getString: (k: string) => mockStore.get(k),
        set: (k: string, v: string) => void mockStore.set(k, v),
        remove: (k: string) => void mockStore.delete(k),
    }),
}));

import { readCachedBoard, writeCachedBoard, invalidateGameCache, BOARD_CACHE_TTL_MS } from './cache';
import type { RankingEntry } from './types';

const GAME = 'the-ladder';
const T0 = 1_000_000_000_000;
const board: RankingEntry[] = [{ nickname: 'Ada', score: 500 }];

beforeEach(() => mockStore.clear());

describe('readCachedBoard', () => {
    it('returns null when nothing is cached', () => {
        expect(readCachedBoard(GAME, 'month', T0)).toBeNull();
    });

    it('returns the record written for the same game+scope, within the TTL', () => {
        writeCachedBoard(GAME, 'month', board, '2026-06', T0);
        expect(readCachedBoard(GAME, 'month', T0 + BOARD_CACHE_TTL_MS - 1)).toEqual({
            board,
            displayedMonth: '2026-06',
            syncedAt: T0,
        });
    });

    it('treats a record at or past the TTL as a miss', () => {
        writeCachedBoard(GAME, 'alltime', board, null, T0);
        expect(readCachedBoard(GAME, 'alltime', T0 + BOARD_CACHE_TTL_MS)).toBeNull();
    });

    it('keeps month and alltime scopes separate', () => {
        writeCachedBoard(GAME, 'month', board, '2026-06', T0);
        expect(readCachedBoard(GAME, 'alltime', T0)).toBeNull();
    });
});

describe('invalidateGameCache', () => {
    it('drops both scopes for the game', () => {
        writeCachedBoard(GAME, 'month', board, '2026-06', T0);
        writeCachedBoard(GAME, 'alltime', board, null, T0);
        invalidateGameCache(GAME);
        expect(readCachedBoard(GAME, 'month', T0)).toBeNull();
        expect(readCachedBoard(GAME, 'alltime', T0)).toBeNull();
    });

    it('leaves other games untouched', () => {
        writeCachedBoard('the-drop', 'month', board, '2026-06', T0);
        invalidateGameCache(GAME);
        expect(readCachedBoard('the-drop', 'month', T0)).not.toBeNull();
    });
});
