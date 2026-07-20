import { syncIncomingRematches } from './rematchSync';
import { listChallenges, markChallengeOpponentPlayed, markChallengePlayed, recordChallenge } from './log';
import { syncChallengeStatuses, syncRematches } from './store';

jest.mock('./deviceId', () => ({ getDeviceId: () => 'mine' }));
jest.mock('./log', () => ({
    listChallenges: jest.fn(),
    markChallengeOpponentPlayed: jest.fn(),
    markChallengePlayed: jest.fn(),
    recordChallenge: jest.fn(),
}));
jest.mock('./store', () => ({ syncRematches: jest.fn(), syncChallengeStatuses: jest.fn() }));

const source = {
    id: 'c1',
    game: 'the-ladder',
    role: 'received' as const,
    opponent: 'Bob',
    played: true,
    createdAt: 1,
    updatedAt: 1,
    expiresAt: 100,
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(syncRematches).mockResolvedValue([]);
    jest.mocked(syncChallengeStatuses).mockResolvedValue([]);
});

it('does not touch the network without a locally known source challenge', async () => {
    jest.mocked(listChallenges).mockReturnValue([]);
    await expect(syncIncomingRematches()).resolves.toEqual([]);
    expect(syncRematches).not.toHaveBeenCalled();
    expect(syncChallengeStatuses).not.toHaveBeenCalled();
});

it('indexes incoming rounds and returns their merged local stubs', async () => {
    const incoming = {
        id: 'r1',
        sourceChallengeId: 'c1',
        game: 'the-ladder',
        senderNickname: 'Bob',
        expiresAt: 200,
    };
    const merged = {
        ...source,
        id: 'r1',
        played: false,
        isRematch: true,
        sourceChallengeId: 'c1',
        seen: false,
    };
    jest.mocked(listChallenges).mockReturnValueOnce([source]).mockReturnValueOnce([merged, source]);
    jest.mocked(syncRematches).mockResolvedValue([incoming]);

    await expect(syncIncomingRematches()).resolves.toEqual([merged]);
    expect(syncRematches).toHaveBeenCalledWith('mine', ['c1']);
    expect(syncChallengeStatuses).toHaveBeenCalledWith('mine', ['c1']);
    expect(recordChallenge).toHaveBeenCalledWith({
        id: 'r1',
        game: 'the-ladder',
        role: 'received',
        opponent: 'Bob',
        played: false,
        expiresAt: 200,
        isRematch: true,
        sourceChallengeId: 'c1',
    });
});

it('reconciles waiting and completed states from the server snapshot', async () => {
    jest.mocked(listChallenges).mockReturnValueOnce([source]).mockReturnValueOnce([source]);
    jest.mocked(syncChallengeStatuses).mockResolvedValue([{ id: 'c1', played: true, opponentPlayed: true }]);

    await syncIncomingRematches();

    expect(markChallengePlayed).toHaveBeenCalledWith('c1');
    expect(markChallengeOpponentPlayed).toHaveBeenCalledWith('c1');
});
