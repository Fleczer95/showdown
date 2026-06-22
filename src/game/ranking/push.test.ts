import { pushRanking } from './push';
import { submitEntry } from './store';
import { invalidateGameCache } from './cache';
import { markSynced } from './local';
import { BlockedError, OfflineError } from '../challenge/store';
import { loadStats } from '../progression';

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
        expect(invalidateGameCache).toHaveBeenCalledWith('the-ladder');
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
