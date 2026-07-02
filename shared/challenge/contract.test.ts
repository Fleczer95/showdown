import {
    CHALLENGE_TTL_DAYS,
    isChallengeRecord,
    parseChallengeRecord,
    serializeChallengeRecord,
    type ChallengeRecord,
} from './contract';

const NOW = 1_700_000_000_000;

const record: ChallengeRecord = {
    lang: 'en',
    game: 'the-ladder',
    questions: [{ id: 'q1', alternates: ['q2'] }],
    createdBy: { uuid: 'u1', nickname: 'Ada' },
    expiresAt: NOW + CHALLENGE_TTL_DAYS * 24 * 60 * 60 * 1000,
    mascot: { fur: 'fur.orange', suit: 'suit.royal', accent: 'accent.crimson', mic: 'mic.gold' },
};

describe('Challenge Record contract', () => {
    it('accepts the canonical record shape', () => {
        expect(isChallengeRecord(record, { nowMs: NOW })).toBe(true);
        expect(parseChallengeRecord(record, { nowMs: NOW })).toEqual(record);
        expect(serializeChallengeRecord(record)).toBe(record);
    });

    it('requires the creator mascot look', () => {
        expect(isChallengeRecord({ ...record, mascot: undefined }, { nowMs: NOW })).toBe(false);
    });

    it('requires exactly the four mascot slots, while allowing unknown color ids', () => {
        expect(
            isChallengeRecord(
                {
                    ...record,
                    mascot: { fur: 'fur.future', suit: 'suit.future', accent: 'accent.future', mic: 'mic.future' },
                },
                { nowMs: NOW },
            ),
        ).toBe(true);
        expect(
            isChallengeRecord(
                { ...record, mascot: { fur: 'fur.orange', suit: 'suit.royal', accent: 'accent.crimson' } },
                { nowMs: NOW },
            ),
        ).toBe(false);
        expect(
            isChallengeRecord(
                {
                    ...record,
                    mascot: {
                        fur: 'fur.orange',
                        suit: 'suit.royal',
                        accent: 'accent.crimson',
                        mic: 'mic.gold',
                        cape: 'cape.future',
                    },
                },
                { nowMs: NOW },
            ),
        ).toBe(false);
    });

    it('rejects records beyond the challenge lifetime cap', () => {
        expect(isChallengeRecord({ ...record, expiresAt: NOW + 32 * 24 * 60 * 60 * 1000 }, { nowMs: NOW })).toBe(false);
    });

    it('rejects unknown games at the contract seam', () => {
        expect(isChallengeRecord({ ...record, game: 'the-grid' }, { nowMs: NOW })).toBe(false);
    });
});
