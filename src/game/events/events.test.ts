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

test('Halloween is the one shipped edition and its window governs its lifecycle', () => {
    expect(eventEditions).toHaveLength(1);
    const halloween = eventEditions.find((e) => e.id === 'halloween-2026')!;
    expect(halloween.winsPerPrize).toBe(13);
    expect(halloween.prizePool).toHaveLength(7);
    // Whatever the window is, the edition may only be live inside it.
    expect(eventLifecycle(halloween, halloween.startsAt! - 1)).toBe('upcoming');
    expect(eventLifecycle(halloween, halloween.startsAt!)).toBe('active');
    expect(eventLifecycle(halloween, halloween.endsAt!)).toBe('closed');
    // Stripping the dates must make it unshippable rather than permanently live.
    expect(
        validateEdition(
            { ...halloween, startsAt: undefined, endsAt: undefined },
            () => false,
            (id) => !!eventRewardTitleKey(id),
        ),
    ).toEqual(expect.arrayContaining(['schedule', 'content']));
});

test('the shipped Halloween edition is well-formed and rejects a bad schedule or prize', () => {
    const halloween = eventEditions.find((e) => e.id === 'halloween-2026')!;
    // The real reward resolver, same as production's catalogue.ts wiring — a typo'd
    // id in the pool must fail this, not just membership-in-itself.
    const hasReward = (id: string) => !!eventRewardTitleKey(id);
    // As shipped it is clean: every prize resolves, nothing is malformed.
    expect(validateEdition(halloween, () => true, hasReward)).toEqual([]);
    // Losing the schedule must be rejected rather than shipped.
    expect(validateEdition({ ...halloween, startsAt: undefined, endsAt: undefined }, () => true, hasReward)).toContain(
        'schedule',
    );
    // A prize id that does not resolve must be rejected too.
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

test('halloween is live on a dated window with the full pool', () => {
    // The single shipped edition. Its window is temporary and internal-track only
    // (see the comment in shared/events/definitions.ts); the real Halloween dates
    // go in before any public release.
    const halloween = eventEditions.find((e) => e.id === 'halloween-2026')!;
    expect(halloween.enabled).toBe(true);
    expect(Number.isSafeInteger(halloween.startsAt)).toBe(true);
    expect(Number.isSafeInteger(halloween.endsAt)).toBe(true);
    expect(halloween.startsAt! < halloween.endsAt!).toBe(true);
    expect(halloween.winsPerPrize).toBe(13);
    expect(halloween.prizePool).toHaveLength(7);
});

test('every shipped edition is complete enough to go live', () => {
    // No edition ships as a draft any more, so an incomplete entry would reach
    // users rather than sitting harmlessly disabled.
    for (const edition of eventEditions) {
        expect(
            validateEdition(
                edition,
                () => true,
                () => true,
            ),
        ).toEqual([]);
    }
});
