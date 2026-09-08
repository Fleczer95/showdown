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
import { eventRewardTitleKey } from './access';

test('Halloween is a disabled incomplete draft and never becomes active just because time passes', () => {
    expect(eventEditions).toHaveLength(2);
    const halloween = eventEditions.find((e) => e.id === 'halloween-2026')!;
    expect(halloween.startsAt).toBeUndefined();
    expect(halloween.endsAt).toBeUndefined();
    expect(halloween.winsPerPrize).toBe(13);
    expect(halloween.prizePool).toHaveLength(7);
    expect(eventLifecycle(halloween, Date.UTC(2026, 9, 31))).toBe('draft');
    expect(
        validateEdition(
            { ...halloween, enabled: true },
            () => false,
            (id) => !!eventRewardTitleKey(id),
        ),
    ).toEqual(expect.arrayContaining(['schedule', 'content']));
});

test('the shipped Halloween draft is well-formed but cannot go live without dates', () => {
    const halloween = eventEditions.find((e) => e.id === 'halloween-2026')!;
    // The real reward resolver, same as production's catalogue.ts wiring — a typo'd
    // id in the pool must fail this, not just membership-in-itself.
    const hasReward = (id: string) => !!eventRewardTitleKey(id);
    // As shipped it is a clean draft: every prize resolves, nothing is malformed.
    expect(validateEdition(halloween, () => true, hasReward)).toEqual([]);
    // Flipping it live without a schedule must still be rejected.
    expect(validateEdition({ ...halloween, enabled: true }, () => true, hasReward)).toContain('schedule');
    // A prize id that does not resolve must be rejected even in a draft.
    expect(
        validateEdition(
            halloween,
            () => true,
            () => false,
        ),
    ).toContain('prizes');
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

const enabled = {
    id: 'x',
    enabled: true,
    name: { en: 'X', pl: 'X' },
    startsAt: 1000,
    endsAt: 2000,
    activities: [{ game: 'the-ladder' as const, contentRevision: 'r1' }],
    allowance: { base: 3, perPaidItem: 1, premium: 10 },
    winsPerPrize: 13,
    prizePool: ['reward-a'],
};
const ok = () => true;

test('an enabled edition needs a non-empty prize pool', () => {
    expect(validateEdition({ ...enabled, prizePool: [] }, ok, ok)).toContain('prizes');
    expect(validateEdition(enabled, ok, ok)).toEqual([]);
});

test('winsPerPrize must be a positive integer', () => {
    expect(validateEdition({ ...enabled, winsPerPrize: 0 }, ok, ok)).toContain('prizes');
    expect(validateEdition({ ...enabled, winsPerPrize: 1.5 }, ok, ok)).toContain('prizes');
});

test('every pool reward must resolve', () => {
    expect(validateEdition(enabled, ok, () => false)).toContain('prizes');
});

test('a draft edition may still have an empty pool', () => {
    expect(validateEdition({ ...enabled, enabled: false, prizePool: [] }, ok, ok)).toEqual([]);
});

test('a pool listing the same reward twice is rejected', () => {
    expect(validateEdition({ ...enabled, prizePool: ['reward-a', 'reward-a'] }, ok, ok)).toContain('prizes');
});

test('halloween ships as a draft with the full pool', () => {
    const halloween = eventEditions.find((e) => e.id === 'halloween-2026')!;
    expect(halloween.enabled).toBe(false);
    expect(halloween.winsPerPrize).toBe(13);
    expect(halloween.prizePool).toHaveLength(7);
});

test('the rehearsal edition is enabled and dated', () => {
    const rehearsal = eventEditions.find((e) => e.id === 'halloween-2026-rehearsal')!;
    expect(rehearsal.enabled).toBe(true);
    expect(Number.isSafeInteger(rehearsal.startsAt)).toBe(true);
    expect(Number.isSafeInteger(rehearsal.endsAt)).toBe(true);
});

test('a rehearsal edition must never be live alongside the real event', () => {
    // Release tripwire: delete the rehearsal edition before enabling Halloween.
    const rehearsals = eventEditions.filter((e) => e.id.endsWith('-rehearsal') && e.enabled);
    const live = eventEditions.filter((e) => !e.id.endsWith('-rehearsal') && e.enabled);
    expect(rehearsals.length === 0 || live.length === 0).toBe(true);
});
