// Stateful MMKV stub so reads see prior writes (the global jest.setup mock is
// write-only). Mirrors src/game/challenge/deviceId.test.ts.
const mockStore = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
    createMMKV: () => ({
        getString: (k: string) => mockStore.get(k),
        set: (k: string, v: string) => void mockStore.set(k, v),
    }),
}));

import { recordBestIfHigher, markSynced, listPending, getLocalState } from './local';

const GAME = 'the-ladder';
const MONTH = '2026-06';

beforeEach(() => mockStore.clear());

describe('recordBestIfHigher — alltime', () => {
    it('records the first best and marks it unsynced', () => {
        expect(recordBestIfHigher(GAME, 'alltime', 500, MONTH)).toBe(true);
        expect(getLocalState(GAME).allTime).toEqual({ score: 500, synced: false });
    });

    it('replaces a lower best, rejects an equal or lower one', () => {
        recordBestIfHigher(GAME, 'alltime', 500, MONTH);
        expect(recordBestIfHigher(GAME, 'alltime', 800, MONTH)).toBe(true);
        expect(recordBestIfHigher(GAME, 'alltime', 800, MONTH)).toBe(false);
        expect(recordBestIfHigher(GAME, 'alltime', 100, MONTH)).toBe(false);
        expect(getLocalState(GAME).allTime?.score).toBe(800);
    });
});

describe('recordBestIfHigher — month', () => {
    it('treats a new month as a fresh best even if the score is lower', () => {
        recordBestIfHigher(GAME, 'month', 900, MONTH);
        expect(recordBestIfHigher(GAME, 'month', 10, '2026-07')).toBe(true);
        expect(getLocalState(GAME).month).toEqual({ score: 10, monthId: '2026-07', synced: false });
    });

    it('keeps the higher score within the same month', () => {
        recordBestIfHigher(GAME, 'month', 900, MONTH);
        expect(recordBestIfHigher(GAME, 'month', 400, MONTH)).toBe(false);
    });
});

describe('markSynced + listPending', () => {
    it('lists unsynced bests and clears them once synced', () => {
        recordBestIfHigher(GAME, 'alltime', 500, MONTH);
        recordBestIfHigher(GAME, 'month', 500, MONTH);
        expect(listPending().map((p) => p.scope).sort()).toEqual(['alltime', 'month']);

        markSynced(GAME, 'alltime');
        expect(listPending()).toEqual([{ game: GAME, scope: 'month', score: 500, monthId: MONTH }]);

        markSynced(GAME, 'month');
        expect(listPending()).toEqual([]);
    });
});
