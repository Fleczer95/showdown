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
    type ChallengeStub,
} from './log';

const stub = (over: Partial<Omit<ChallengeStub, 'updatedAt'>> = {}): Omit<ChallengeStub, 'updatedAt'> => ({
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

describe('challengeStatus', () => {
    const base: ChallengeStub = { ...stub(), updatedAt: 0, expiresAt: 100 };

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
