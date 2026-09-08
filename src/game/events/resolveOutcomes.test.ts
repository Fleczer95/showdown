import { resolveEventOutcomes } from './resolveOutcomes';
import { recordChallenge, listChallenges, markChallengeOpponentPlayed } from '../challenge/log';
import { getAttempts, getAttempt } from '../challenge/store';
import { testEventEdition as edition } from '../../../shared/events/fixtures';
import { loadStats, saveStats, defaultStats } from '../progression/recordRun';

// Every MMKV-backed store this test touches (challenge log, progression stats,
// challenge sessions) shares one map-of-maps so state persists within a test the
// way real storage does, but `mockMmkvStores` is exposed (Jest's `mock`-prefix
// hoisting allowance) so `beforeEach` can wipe it for isolation between tests.
let mockMmkvStores: Map<string, Map<string, string | boolean>>;
jest.mock('react-native-mmkv', () => {
    mockMmkvStores = new Map<string, Map<string, string | boolean>>();
    return {
        createMMKV: ({ id }: { id: string }) => {
            if (!mockMmkvStores.has(id)) mockMmkvStores.set(id, new Map());
            const data = mockMmkvStores.get(id)!;
            return {
                getString: (k: string) => data.get(k),
                getBoolean: (k: string) => data.get(k),
                set: (k: string, v: string | boolean) => data.set(k, v),
                remove: (k: string) => data.delete(k),
            };
        },
    };
});
jest.mock('../challenge/store', () => ({ getAttempts: jest.fn(), getAttempt: jest.fn() }));
jest.mock('../challenge/deviceId', () => ({ getDeviceId: () => 'device-1' }));

const mine = { nickname: 'Me', progress: 9, score: 900, timestamp: 100 };
const theirs = { nickname: 'You', progress: 5, score: 500, timestamp: 200 };

const stub = (id: string) =>
    recordChallenge({
        id,
        game: 'the-ladder',
        role: 'created',
        opponent: '',
        played: true,
        expiresAt: edition.endsAt! + 1000,
        eventId: edition.id,
    });

beforeEach(() => {
    mockMmkvStores.forEach((store) => store.clear());
    saveStats(defaultStats());
    jest.mocked(getAttempts).mockReset();
    // Nothing in these fixtures calls `start()`, so the session journal never
    // has this device's own attempt — every test exercises the server fallback.
    // A real, matching timestamp (100, same as `mine`) unless a test overrides it.
    jest.mocked(getAttempt).mockReset().mockResolvedValue(mine);
});

test('beating the opponent records a win and grants a prize', async () => {
    stub('r1');
    markChallengeOpponentPlayed('r1');
    jest.mocked(getAttempts).mockResolvedValue([mine, theirs]);
    // Fixture edition: winsPerPrize 1, pool ['theme-champion'].
    const granted = await resolveEventOutcomes(edition.startsAt! + 1);
    expect(granted).toEqual(['theme-champion']);
    expect(listChallenges().find((s) => s.id === 'r1')?.outcome).toBe('won');
    expect(loadStats().eventWinIds?.[edition.id]).toEqual(['r1']);
});

test('losing records the verdict and grants nothing', async () => {
    stub('r2');
    markChallengeOpponentPlayed('r2');
    jest.mocked(getAttempts).mockResolvedValue([theirs, mine]);
    expect(await resolveEventOutcomes(edition.startsAt! + 1)).toEqual([]);
    expect(listChallenges().find((s) => s.id === 'r2')?.outcome).toBe('lost');
});

test('a draw is not a win', async () => {
    stub('r3');
    markChallengeOpponentPlayed('r3');
    jest.mocked(getAttempts).mockResolvedValue([
        { ...mine, progress: 5, score: 500 },
        { ...theirs, progress: 5, score: 500 },
    ]);
    expect(await resolveEventOutcomes(edition.startsAt! + 1)).toEqual([]);
    expect(listChallenges().find((s) => s.id === 'r3')?.outcome).toBe('draw');
    expect(loadStats().eventWinIds?.[edition.id] ?? []).toEqual([]);
});

test('an absent opponent stays unresolved during the event', async () => {
    stub('r4');
    expect(await resolveEventOutcomes(edition.startsAt! + 1)).toEqual([]);
    expect(listChallenges().find((s) => s.id === 'r4')?.outcome).toBeUndefined();
    expect(getAttempts).not.toHaveBeenCalled();
});

test('an absent opponent becomes a walkover win at closure', async () => {
    stub('r5');
    const granted = await resolveEventOutcomes(edition.endsAt! + 1);
    expect(granted).toEqual(['theme-champion']);
    expect(listChallenges().find((s) => s.id === 'r5')?.outcome).toBe('won');
    expect(getAttempts).not.toHaveBeenCalled();
});

test('resolving twice does not double-count a win', async () => {
    stub('r6');
    markChallengeOpponentPlayed('r6');
    jest.mocked(getAttempts).mockResolvedValue([mine, theirs]);
    await resolveEventOutcomes(edition.startsAt! + 1);
    await resolveEventOutcomes(edition.startsAt! + 1);
    expect(loadStats().eventWinIds?.[edition.id]).toEqual(['r6']);
});

test('a network failure on one round leaves the others resolvable', async () => {
    stub('r7');
    stub('r8');
    markChallengeOpponentPlayed('r7');
    markChallengeOpponentPlayed('r8');
    jest.mocked(getAttempts).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([mine, theirs]);
    await resolveEventOutcomes(edition.startsAt! + 1);
    const settled = listChallenges().filter((s) => s.outcome === 'won');
    expect(settled).toHaveLength(1);
});

test('a round whose session was pruned still resolves from the server attempt', async () => {
    stub('r9');
    markChallengeOpponentPlayed('r9');
    jest.mocked(getAttempts).mockResolvedValue([mine, theirs]);
    jest.mocked(getAttempt).mockResolvedValue(mine);
    // No session exists for r9 — nothing called start() for it.
    const granted = await resolveEventOutcomes(edition.startsAt! + 1);
    expect(granted).toEqual(['theme-champion']);
    expect(listChallenges().find((s) => s.id === 'r9')?.outcome).toBe('won');
});
