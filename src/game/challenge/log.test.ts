// Override the global stateless MMKV mock with a real in-memory store so the
// upsert / played-flag / ordering behaviour can be exercised end to end.
jest.mock('react-native-mmkv', () => {
    const store = new Map<string, string>();
    return {
        createMMKV: () => ({
            getString: (k: string) => store.get(k),
            set: (k: string, v: string) => store.set(k, v),
            remove: (k: string) => store.delete(k),
        }),
    };
});

import {
    recordChallenge,
    markChallengePlayed,
    markChallengeOpponentPlayed,
    markChallengeSeen,
    markChallengeSnoozed,
    isChallengeBannerDue,
    REMATCH_SNOOZE_MS,
    listChallenges,
    challengeStatus,
    countCreatedToday,
    type ChallengeStub,
} from './log';

type StubInput = Omit<ChallengeStub, 'updatedAt' | 'createdAt'>;

const stub = (over: Partial<StubInput> = {}): StubInput => ({
    id: 'a',
    game: 'the-ladder',
    role: 'received',
    opponent: 'Anna',
    played: false,
    expiresAt: Date.now() + 1000,
    ...over,
});

// The mocked store persists across tests in this file; each test uses unique
// ids and asserts via `.find(id)`, so they don't collide. Just restore any
// Date.now spy between tests.
afterEach(() => jest.restoreAllMocks());

describe('recordChallenge', () => {
    it('indexes a new challenge and lists it', () => {
        recordChallenge(stub({ id: 'new-1' }));
        const found = listChallenges().find((s) => s.id === 'new-1');
        expect(found).toMatchObject({ id: 'new-1', opponent: 'Anna', played: false });
    });

    it('never downgrades a played challenge back to unplayed on reopen', () => {
        recordChallenge(stub({ id: 'dg', played: true }));
        recordChallenge(stub({ id: 'dg', played: false }));
        const found = listChallenges().find((s) => s.id === 'dg');
        expect(found?.played).toBe(true);
    });

    it('preserves directed-rematch metadata when ChallengeScreen reindexes it', () => {
        recordChallenge(stub({ id: 'meta', opponent: 'Anna', isRematch: true, sourceChallengeId: 'source' }));
        recordChallenge(stub({ id: 'meta', role: 'created', opponent: '' }));
        expect(listChallenges().find((s) => s.id === 'meta')).toMatchObject({
            opponent: 'Anna',
            isRematch: true,
            sourceChallengeId: 'source',
        });
    });
});

describe('markChallengePlayed', () => {
    it('flags an indexed challenge as played', () => {
        recordChallenge(stub({ id: 'mp', played: false }));
        markChallengePlayed('mp');
        expect(listChallenges().find((s) => s.id === 'mp')?.played).toBe(true);
    });

    it('is a no-op for an unknown id', () => {
        expect(() => markChallengePlayed('ghost')).not.toThrow();
    });
});

describe('markChallengeOpponentPlayed', () => {
    it('separates waiting for the opponent from a completed challenge', () => {
        recordChallenge(stub({ id: 'opponent', played: true, opponentPlayed: false }));
        expect(challengeStatus(listChallenges().find((s) => s.id === 'opponent')!)).toBe('waitingOpponent');
        markChallengeOpponentPlayed('opponent');
        expect(challengeStatus(listChallenges().find((s) => s.id === 'opponent')!)).toBe('completed');
    });
});

describe('markChallengeSnoozed', () => {
    it('hides a rematch banner for one hour and then makes it due again', () => {
        const now = 1_000_000;
        jest.spyOn(Date, 'now').mockReturnValue(now);
        recordChallenge(stub({ id: 'snooze', isRematch: true, seen: false }));
        markChallengeSnoozed('snooze');
        const challenge = listChallenges().find((s) => s.id === 'snooze')!;

        expect(challenge.snoozedUntil).toBe(now + REMATCH_SNOOZE_MS);
        expect(isChallengeBannerDue(challenge, now + REMATCH_SNOOZE_MS - 1)).toBe(false);
        expect(isChallengeBannerDue(challenge, now + REMATCH_SNOOZE_MS)).toBe(true);
    });
});

describe('markChallengeSeen', () => {
    it('acknowledges an incoming banner without marking the round played', () => {
        recordChallenge(stub({ id: 'seen', played: false, seen: false }));
        markChallengeSeen('seen');
        const challenge = listChallenges().find((s) => s.id === 'seen')!;
        expect(challenge).toMatchObject({ played: false, seen: true });
        expect(isChallengeBannerDue({ ...challenge, isRematch: true })).toBe(false);
    });
});

describe('listChallenges', () => {
    it('keeps creation order stable when an older challenge is reopened', () => {
        let now = 1000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        recordChallenge(stub({ id: 'old' }));
        now = 2000;
        recordChallenge(stub({ id: 'new' }));
        now = 3000;
        recordChallenge(stub({ id: 'old', played: true }));

        const ids = listChallenges().map((s) => s.id);
        expect(ids.indexOf('new')).toBeLessThan(ids.indexOf('old'));
    });
});

describe('countCreatedToday', () => {
    it('counts only created challenges, not received ones', () => {
        let now = 10_000_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        recordChallenge(stub({ id: 'ct-mine', role: 'created' }));
        recordChallenge(stub({ id: 'ct-theirs', role: 'received' }));
        expect(countCreatedToday(now)).toBe(1);
    });

    it('does not count a created challenge from a previous day', () => {
        const today = new Date('2026-06-14T10:00:00').getTime();
        const yesterday = new Date('2026-06-13T10:00:00').getTime();
        jest.spyOn(Date, 'now').mockImplementation(() => yesterday);
        recordChallenge(stub({ id: 'ct-old', role: 'created' }));
        expect(countCreatedToday(today)).toBe(0);
    });

    it('keeps createdAt write-once so a reopen today does not count an old create', () => {
        const today = new Date('2026-06-14T12:00:00').getTime();
        const yesterday = new Date('2026-06-13T09:00:00').getTime();
        let now = yesterday;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        recordChallenge(stub({ id: 'ct-reopen', role: 'created' })); // created yesterday
        now = today;
        recordChallenge(stub({ id: 'ct-reopen', role: 'created' })); // reopened today
        expect(countCreatedToday(today)).toBe(0);
    });
});

describe('storage cap', () => {
    it('keeps only the 100 most recently touched challenges, pruning the oldest', () => {
        // updatedAt values far above any earlier entry, so these dominate the cap
        // regardless of the file-persistent store.
        let now = 1e15;
        jest.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
        for (let i = 0; i < 110; i++) recordChallenge(stub({ id: `cap-${i}` }));
        const ids = listChallenges().map((s) => s.id);
        expect(ids).toHaveLength(100);
        expect(ids).toContain('cap-109'); // newest kept
        expect(ids).not.toContain('cap-0'); // oldest pruned
    });
});

describe('challengeStatus', () => {
    const base: ChallengeStub = { ...stub(), createdAt: 0, updatedAt: 0, expiresAt: 100 };

    it('is expired once past expiresAt', () => {
        expect(challengeStatus({ ...base, expiresAt: 50 }, 100)).toBe('expired');
    });

    it('waits for the opponent after only this device has played', () => {
        expect(challengeStatus({ ...base, played: true, opponentPlayed: false, expiresAt: 200 }, 100)).toBe(
            'waitingOpponent',
        );
    });

    it('is completed after this device and an opponent have played', () => {
        expect(challengeStatus({ ...base, played: true, opponentPlayed: true, expiresAt: 200 }, 100)).toBe('completed');
    });

    it('is yourTurn when unplayed and not expired', () => {
        expect(challengeStatus({ ...base, played: false, expiresAt: 200 }, 100)).toBe('yourTurn');
    });
});
