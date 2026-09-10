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
        expect(
            listPending()
                .map((p) => p.scope)
                .sort(),
        ).toEqual(['alltime', 'month']);

        markSynced(GAME, 'alltime');
        expect(listPending()).toEqual([{ game: GAME, scope: 'month', score: 500, monthId: MONTH }]);

        markSynced(GAME, 'month');
        expect(listPending()).toEqual([]);
    });
});

describe('recordBestIfHigher — event', () => {
    const EDITION = 'halloween-2026';

    it('records a best per edition, best-only', () => {
        expect(recordBestIfHigher(GAME, 'event', 500, EDITION)).toBe(true);
        expect(getLocalState(GAME).events?.[EDITION]).toEqual({ score: 500, synced: false });
        expect(recordBestIfHigher(GAME, 'event', 400, EDITION)).toBe(false);
        expect(recordBestIfHigher(GAME, 'event', 500, EDITION)).toBe(false);
        expect(recordBestIfHigher(GAME, 'event', 900, EDITION)).toBe(true);
        expect(getLocalState(GAME).events?.[EDITION].score).toBe(900);
    });

    it('keeps editions independent of each other and of the normal scopes', () => {
        recordBestIfHigher(GAME, 'event', 500, EDITION);
        recordBestIfHigher(GAME, 'event', 100, 'halloween-2027');
        recordBestIfHigher(GAME, 'alltime', 900, MONTH);
        const state = getLocalState(GAME);
        expect(state.events?.[EDITION].score).toBe(500);
        expect(state.events?.['halloween-2027'].score).toBe(100);
        expect(state.allTime?.score).toBe(900);
    });

    it('marks one edition synced without touching another', () => {
        recordBestIfHigher(GAME, 'event', 500, EDITION);
        recordBestIfHigher(GAME, 'event', 100, 'halloween-2027');
        markSynced(GAME, 'event', EDITION);
        expect(getLocalState(GAME).events?.[EDITION].synced).toBe(true);
        expect(getLocalState(GAME).events?.['halloween-2027'].synced).toBe(false);
    });

    it('queues an unsynced event best for retry, carrying its edition', () => {
        recordBestIfHigher(GAME, 'event', 500, EDITION);
        expect(listPending()).toContainEqual({ game: GAME, scope: 'event', score: 500, editionId: EDITION });
        markSynced(GAME, 'event', EDITION);
        expect(listPending()).toEqual([]);
    });
});
