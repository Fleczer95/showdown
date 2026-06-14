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

describe('listChallenges', () => {
    it('orders newest touch first', () => {
        let now = 1000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        recordChallenge(stub({ id: 'old' }));
        now = 2000;
        recordChallenge(stub({ id: 'new' }));
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

describe('challengeStatus', () => {
    const base: ChallengeStub = { ...stub(), createdAt: 0, updatedAt: 0, expiresAt: 100 };

    it('is expired once past expiresAt', () => {
        expect(challengeStatus({ ...base, expiresAt: 50 }, 100)).toBe('expired');
    });

    it('is played when finished and not expired', () => {
        expect(challengeStatus({ ...base, played: true, expiresAt: 200 }, 100)).toBe('played');
    });

    it('is yourTurn when unplayed and not expired', () => {
        expect(challengeStatus({ ...base, played: false, expiresAt: 200 }, 100)).toBe('yourTurn');
    });
});
