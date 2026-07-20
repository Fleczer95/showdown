import { canSubmitDirectedAttempt, isSameAttempt, type AttemptPayload } from './attempt';

const attempt: AttemptPayload = {
    nickname: 'Ada',
    progress: 7,
    score: 120,
    timestamp: 1234,
};

describe('canSubmitDirectedAttempt', () => {
    it('allows either structural seat in a directed rematch', () => {
        const creator = JSON.stringify({ uuid: 'ada', nickname: 'Ada' });

        expect(canSubmitDirectedAttempt(creator, 'bob', 'ada')).toBe(true);
        expect(canSubmitDirectedAttempt(creator, 'bob', 'bob')).toBe(true);
        expect(canSubmitDirectedAttempt(creator, 'bob', 'cara')).toBe(false);
    });

    it('preserves legacy and group challenge behavior', () => {
        expect(canSubmitDirectedAttempt('{}', null, 'any-valid-uuid')).toBe(true);
    });

    it('fails closed when directed creator metadata is malformed', () => {
        expect(canSubmitDirectedAttempt('{broken', 'bob', 'ada')).toBe(false);
    });
});

describe('isSameAttempt', () => {
    it('accepts an identical retry after a committed timeout', () => {
        expect(isSameAttempt(attempt, { ...attempt })).toBe(true);
    });

    it.each(['nickname', 'progress', 'score', 'timestamp'] as const)('rejects a retry with a different %s', (field) => {
        const changed: AttemptPayload = {
            ...attempt,
            [field]: field === 'nickname' ? 'Bob' : attempt[field] + 1,
        };
        expect(isSameAttempt(attempt, changed)).toBe(false);
    });
});
