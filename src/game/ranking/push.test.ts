import { pushRanking, retryPending } from './push';
import { submitEntry } from './store';
import { invalidateGameCache } from './cache';
import { listPending, markSynced, recordBestIfHigher } from './local';
import { BlockedError, OfflineError } from '../challenge/store';
import { loadStats } from '../progression';
import { getChallengeNickname } from '../challenge/nickname';

// The error classes live in challenge/store, which imports the App Check SDK; stub
// it so the module loads under jest (we never reach a real network call here).
jest.mock('@react-native-firebase/app-check', () => ({ __esModule: true, default: () => ({}) }));

// Firestore + local-best I/O are stubbed; we only assert the payload shape.
jest.mock('./store', () => ({
    countEntries: jest.fn(async () => 0),
    lowestScore: jest.fn(async () => null),
    submitEntry: jest.fn(async () => undefined),
}));
jest.mock('./local', () => ({
    recordBestIfHigher: jest.fn(() => true),
    markSynced: jest.fn(),
    listPending: jest.fn(() => []),
}));
jest.mock('./cache', () => ({ invalidateGameCache: jest.fn() }));
jest.mock('../challenge/deviceId', () => ({ getDeviceId: () => 'device-1' }));
jest.mock('../challenge/nickname', () => ({ getChallengeNickname: jest.fn(() => 'Ada') }));
jest.mock('../progression', () => {
    const actual = jest.requireActual('../progression');
    return { ...actual, loadStats: jest.fn(() => ({ lifetimeXp: 0 })) };
});

const lastEntry = () => (submitEntry as jest.Mock).mock.calls.at(-1)?.[3];

describe('pushRanking — signature on the wire', () => {
    beforeEach(() => jest.clearAllMocks());

    it('includes the derived signature slug in the submitted entry', async () => {
        (loadStats as jest.Mock).mockReturnValue({ lifetimeXp: 3803000 }); // L50 → 'crown'
        await pushRanking('the-ladder', 500, 'Ada');
        expect(submitEntry).toHaveBeenCalled();
        expect(lastEntry()).toEqual({ nickname: 'Ada', score: 500, signature: 'crown' });
    });

    it('omits the signature field entirely below the first tier', async () => {
        (loadStats as jest.Mock).mockReturnValue({ lifetimeXp: 0 });
        await pushRanking('the-ladder', 500, 'Ada');
        const entry = lastEntry();
        expect(entry).toEqual({ nickname: 'Ada', score: 500 });
        expect('signature' in entry).toBe(false);
    });

    it('invalidates the game day-cache once a score is written, so the new standing shows', async () => {
        (loadStats as jest.Mock).mockReturnValue({ lifetimeXp: 0 });
        await pushRanking('the-ladder', 500, 'Ada');
        // No edition: a normal round invalidates only the two per-game boards.
        expect(invalidateGameCache).toHaveBeenCalledWith('the-ladder', undefined);
    });
});

describe('pushRanking — terminal vs retryable write failures', () => {
    beforeEach(() => jest.clearAllMocks());

    it('resolves a scope (marks synced) when the write is rejected by the rules', async () => {
        // A `BlockedError` (permission-denied / App Check) is terminal — a retry will
        // never help, so re-queuing it forever is the storm we are fixing.
        (submitEntry as jest.Mock).mockRejectedValue(new BlockedError());
        await pushRanking('the-ladder', 500, 'Ada');
        expect(markSynced).toHaveBeenCalledWith('the-ladder', 'alltime');
        expect(markSynced).toHaveBeenCalledWith('the-ladder', 'month');
    });

    it('keeps a scope pending when the write fails offline', async () => {
        (submitEntry as jest.Mock).mockRejectedValue(new OfflineError());
        await pushRanking('the-ladder', 500, 'Ada');
        expect(markSynced).not.toHaveBeenCalled();
    });
});

describe('pushRanking — event rounds', () => {
    const EDITION = 'halloween-2026';
    const periods = () => (submitEntry as jest.Mock).mock.calls.map((c) => c[1]);
    beforeEach(() => {
        jest.clearAllMocks();
        // `clearAllMocks` keeps implementations, so restore the write the
        // failure describe above left rejecting.
        (submitEntry as jest.Mock).mockResolvedValue(undefined);
        (recordBestIfHigher as jest.Mock).mockReturnValue(true);
    });

    it('writes an event round to the edition board and to neither normal board', async () => {
        await pushRanking('the-ladder', 500, 'Ada', EDITION);
        // Event rounds play a different question pack; mixing them into the
        // normal boards was comparing incomparable scores.
        expect(periods()).toEqual([EDITION]);
    });

    it('leaves a normal round on the normal boards', async () => {
        await pushRanking('the-ladder', 500, 'Ada');
        expect(periods()).toContain('alltime');
        expect(periods()).not.toContain(EDITION);
    });

    it('tracks the event best under its edition', async () => {
        await pushRanking('the-ladder', 500, 'Ada', EDITION);
        expect(recordBestIfHigher).toHaveBeenCalledWith('the-ladder', 'event', 500, EDITION);
        expect(markSynced).toHaveBeenCalledWith('the-ladder', 'event', EDITION);
        expect(invalidateGameCache).toHaveBeenCalledWith('the-ladder', EDITION);
    });

    it('writes nothing for an event round in a game with no board', async () => {
        await pushRanking('the-grid', 500, 'Ada', EDITION);
        expect(submitEntry).not.toHaveBeenCalled();
    });
});

describe('retryPending — event bests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (submitEntry as jest.Mock).mockResolvedValue(undefined);
    });

    it('retries an event best into its edition bucket, not the current month', async () => {
        (listPending as jest.Mock).mockReturnValue([
            { game: 'the-ladder', scope: 'event', score: 500, editionId: 'halloween-2026' },
        ]);
        (getChallengeNickname as jest.Mock).mockReturnValue('Ada');

        await retryPending();

        expect((submitEntry as jest.Mock).mock.calls.map((c) => c[1])).toEqual(['halloween-2026']);
        expect(markSynced).toHaveBeenCalledWith('the-ladder', 'event', 'halloween-2026');
    });
});
