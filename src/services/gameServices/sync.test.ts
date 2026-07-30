import { syncGameServices } from './sync';
import { defaultStats } from '../../game/progression/recordRun';
import type { ProgressionStats } from '../../game/progression/types';
import { isAuthenticated, submitScore, unlockAchievement } from '../../../modules/game-services';

jest.mock('../../../modules/game-services', () => ({
    gameServicesAvailable: true,
    isAuthenticated: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve(true)),
    unlockAchievement: jest.fn(() => Promise.resolve()),
    submitScore: jest.fn(() => Promise.resolve()),
    showAchievements: jest.fn(() => Promise.resolve()),
    showLeaderboard: jest.fn(() => Promise.resolve()),
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

const mockIsAuthenticated = isAuthenticated as jest.Mock;
const mockUnlock = unlockAchievement as jest.Mock;
const mockSubmit = submitScore as jest.Mock;

beforeEach(() => jest.clearAllMocks());

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

    it('does not write the digest when signed out, so the next sync retries', async () => {
        const fresh = { ...statsWithProgress(), runsPlayed: 50 };
        mockIsAuthenticated.mockResolvedValueOnce(false);
        await syncGameServices(fresh);
        expect(mockUnlock).not.toHaveBeenCalled();

        await syncGameServices(fresh);
        expect(mockUnlock).toHaveBeenCalledWith('com.showdown.app.ach.contestant_silver');
    });
});
