import {
    eventLifecycle,
    validateEdition,
    eventDailyCap,
    eventEditions,
    EVENT_UPLOAD_WINDOW_MS,
} from '../../../shared/events/definitions';
import { testEventEdition, testEventQuestions } from '../../../shared/events/fixtures';
import { isChallengeRecord } from '../../../shared/challenge/contract';
import { eventLadderIndex } from './content';
import { validEventQuestions } from '../../../shared/events/content';

test('Halloween is a disabled incomplete draft and never becomes active just because time passes', () => {
    expect(eventEditions).toHaveLength(1);
    const halloween = eventEditions[0];
    expect(halloween.startsAt).toBeUndefined();
    expect(halloween.endsAt).toBeUndefined();
    expect(halloween.milestones).toEqual([]);
    expect(eventLifecycle(halloween, Date.UTC(2026, 9, 31))).toBe('draft');
    expect(
        validateEdition(
            { ...halloween, enabled: true },
            () => false,
            () => false,
        ),
    ).toEqual(expect.arrayContaining(['schedule', 'content', 'prizes']));
});
test('inclusive start, exclusive end, future editions need only new typed data', () => {
    const edition = { ...testEventEdition, id: 'future-edition', startsAt: 100, endsAt: 200 };
    expect(eventLifecycle(edition, 99)).toBe('upcoming');
    expect(eventLifecycle(edition, 100)).toBe('active');
    expect(eventLifecycle(edition, 199)).toBe('active');
    expect(eventLifecycle(edition, 200)).toBe('closed');
    expect(
        validateEdition(
            edition,
            () => true,
            () => true,
        ),
    ).toEqual([]);
});
test('allowance policy is configurable and additive', () => {
    expect(eventDailyCap(testEventEdition, 0, false)).toBe(3);
    expect(eventDailyCap(testEventEdition, 2, true)).toBe(15);
    expect(eventDailyCap({ ...testEventEdition, allowance: { base: 1, perPaidItem: 2, premium: 5 } }, 3, true)).toBe(
        12,
    );
});
test('fixture has bilingual content and Skip alternatives at all 15 rungs', () => {
    const en = eventLadderIndex('local-ladder-v1', 'en');
    const pl = eventLadderIndex('local-ladder-v1', 'pl');
    expect(en.size).toBe(30);
    expect([...en.keys()]).toEqual([...pl.keys()]);
    for (const question of testEventQuestions)
        for (const id of [question.id, ...question.alternates]) {
            expect(en.get(id)?.prompt).toBeTruthy();
            expect(pl.get(id)?.prompt).toBeTruthy();
        }
    expect(eventLadderIndex('halloween-2026-draft', 'en').size).toBe(0);
});
test('event retention can exceed 31 days without weakening ordinary expiry or pool validation', () => {
    const record = {
        lang: 'en' as const,
        game: 'the-ladder',
        questions: testEventQuestions,
        createdBy: { uuid: 'a', nickname: 'A' },
        mascot: { fur: 'a', suit: 'b', accent: 'c', mic: 'd' },
        expiresAt: testEventEdition.endsAt! + EVENT_UPLOAD_WINDOW_MS,
        event: {
            editionId: testEventEdition.id,
            contentRevision: 'local-ladder-v1',
            mode: 'friend' as const,
            endsAt: testEventEdition.endsAt!,
        },
    };
    expect(isChallengeRecord(record, { nowMs: testEventEdition.startsAt })).toBe(true);
    expect(isChallengeRecord({ ...record, event: undefined }, { nowMs: testEventEdition.startsAt })).toBe(false);
    expect(validEventQuestions(record)).toBe(true);
    expect(validEventQuestions({ ...record, questions: [{ id: 'ordinary-question' }] })).toBe(false);
    expect(validEventQuestions({ ...record, questions: testEventQuestions.map((q) => ({ id: q.id })) })).toBe(false);
});
