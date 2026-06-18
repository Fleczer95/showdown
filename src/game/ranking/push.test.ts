import { pushRanking } from './push';
import { submitEntry } from './store';
import { loadStats } from '../progression';

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
});
