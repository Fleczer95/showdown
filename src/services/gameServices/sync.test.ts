import { syncGameServices } from './sync';
import { defaultStats } from '../../game/progression/recordRun';
import type { ProgressionStats } from '../../game/progression/types';
import { beginAuthentication, submitScore, unlockAchievement } from '../../../modules/game-services';

jest.mock('../../../modules/game-services', () => ({
    gameServicesAvailable: true,
    isAuthenticated: jest.fn(() => Promise.resolve(true)),
    beginAuthentication: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve(true)),
    unlockAchievement: jest.fn(() => Promise.resolve(true)),
    submitScore: jest.fn(() => Promise.resolve(true)),
    showAchievements: jest.fn(() => Promise.resolve(true)),
}));

// Stateful MMKV so the digest actually persists between sync calls.
jest.mock('react-native-mmkv', () => {
    const data = new Map<string, string>();
    return {
        createMMKV: () => ({
            getString: (k: string) => data.get(k),
            set: (k: string, v: string) => void data.set(k, v),
        }),
    };
});

/** Ten runs played + a Ladder best score → contestant-bronze earned. */
function statsWithProgress(): ProgressionStats {
    return { ...defaultStats(), runsPlayed: 10, bestScoreByGame: { 'the-ladder': 9000 } };
}

const mockBeginAuth = beginAuthentication as jest.Mock;
const mockUnlock = unlockAchievement as jest.Mock;
const mockSubmit = submitScore as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    mockBeginAuth.mockResolvedValue(true);
    mockUnlock.mockResolvedValue(true);
    mockSubmit.mockResolvedValue(true);
});

describe('syncGameServices', () => {
    it('unlocks earned achievements and submits best scores (platform ids)', async () => {
        await syncGameServices(statsWithProgress());

        expect(mockUnlock).toHaveBeenCalledWith('com.showdown.app.ach.contestant_bronze');
        expect(mockSubmit).toHaveBeenCalledWith('com.showdown.app.lb.the_ladder', 9000);
        // No submissions for games never played.
        expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    it('skips a second sync of unchanged stats (digest throttle)', async () => {
        await syncGameServices(statsWithProgress());
        mockUnlock.mockClear();

        await syncGameServices(statsWithProgress());
        expect(mockUnlock).not.toHaveBeenCalled();
    });

    it('re-sends when stats change', async () => {
        await syncGameServices(statsWithProgress());
        mockUnlock.mockClear();

        const better = { ...statsWithProgress(), bestScoreByGame: { 'the-ladder': 12000 } };
        await syncGameServices(better);
        expect(mockSubmit).toHaveBeenLastCalledWith('com.showdown.app.lb.the_ladder', 12000);
    });

    it('never opens a platform session for a player with nothing earned', async () => {
        await syncGameServices(defaultStats());

        expect(mockBeginAuth).not.toHaveBeenCalled();
        expect(mockUnlock).not.toHaveBeenCalled();
    });

    it('does not write the digest when auth fails, so the next sync retries', async () => {
        const fresh = { ...statsWithProgress(), runsPlayed: 50 };
        mockBeginAuth.mockResolvedValueOnce(false);
        await syncGameServices(fresh);
        expect(mockUnlock).not.toHaveBeenCalled();

        await syncGameServices(fresh);
        expect(mockUnlock).toHaveBeenCalledWith('com.showdown.app.ach.contestant_silver');
    });

    it('does not write the digest when a send failed, so the next sync retries', async () => {
        const fresh = { ...statsWithProgress(), runsPlayed: 200 };
        // One unlock is rejected by the platform (offline, signed out mid-sync…).
        mockUnlock.mockResolvedValueOnce(false);
        await syncGameServices(fresh);
        expect(mockUnlock).toHaveBeenCalled();

        mockUnlock.mockClear();
        await syncGameServices(fresh);
        // Same stats, but nothing was banked — so everything is replayed.
        expect(mockUnlock).toHaveBeenCalledWith('com.showdown.app.ach.contestant_gold');
    });

    it('banks the digest once every call confirms delivery', async () => {
        const fresh = { ...statsWithProgress(), runsPlayed: 200, datesPlayed: ['2026-07-30'] };
        await syncGameServices(fresh);

        mockUnlock.mockClear();
        await syncGameServices(fresh);
        expect(mockUnlock).not.toHaveBeenCalled();
    });
});
