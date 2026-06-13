// The challenge builder freezes a self-contained, bilingual round (ADR-0003).
// These tests pin the invariants an opponent's device depends on: every question
// carries both locales, the run is the game's normal length, and — the subtle
// one — the en/pl option arrays stay *paired* through the option shuffle, so a
// player in either language faces the same board with the same correct answer.

import { buildChallenge, type DropQuestionPayload, type LadderRungPayload, type WheelPuzzlePayload } from './build';
import { CHALLENGE_TTL_DAYS, MIN_APP_VERSION, SCHEMA_VERSION, type ChallengeQuestion } from './types';
import { dropQuestions } from '../drop/content';
import { RUN_LENGTH } from '../ladder/logic';
import { TOTAL_ROUNDS } from '../drop/logic';
import { TOTAL_PUZZLES } from '../wheel/logic';

const NOW = 1_700_000_000_000;

function build(gameId: string) {
    return buildChallenge({
        gameId,
        history: {},
        ownedIds: new Set<string>(),
        createdBy: { uuid: 'u1', nickname: 'Ada' },
        appVersion: '0.9.0',
        lang: 'en',
        // Fixed rng + clock keep the build deterministic and the clock assertable.
        rng: () => 0.42,
        now: () => NOW,
    });
}

/** Every frozen question must embed both locales — the self-containment guarantee. */
function expectBothLocales(questions: ChallengeQuestion[]) {
    for (const q of questions) {
        expect(Object.keys(q.byLocale).sort()).toEqual(['en', 'pl']);
    }
}

describe('buildChallenge metadata', () => {
    it('stamps versions, attribution and a 30-day expiry', () => {
        const record = build('the-drop');
        expect(record.schemaVersion).toBe(SCHEMA_VERSION);
        expect(record.minAppVersion).toBe(MIN_APP_VERSION);
        expect(record.appVersion).toBe('0.9.0');
        expect(record.lang).toBe('en');
        expect(record.game).toBe('the-drop');
        expect(record.createdBy).toEqual({ uuid: 'u1', nickname: 'Ada' });
        expect(record.expiresAt).toBe(NOW + CHALLENGE_TTL_DAYS * 24 * 60 * 60 * 1000);
    });

    it('throws for an unknown game', () => {
        expect(() => build('the-grid')).toThrow(/unknown game/i);
    });
});

describe('the-ladder freeze', () => {
    const questions = build('the-ladder').questions as ChallengeQuestion<LadderRungPayload>[];

    it('freezes one rung per run step, each with both locales', () => {
        expect(questions).toHaveLength(RUN_LENGTH);
        expectBothLocales(questions);
    });

    it('uses a distinct current question per rung', () => {
        const ids = questions.map((q) => q.id);
        expect(new Set(ids).size).toBe(RUN_LENGTH);
    });

    it('keeps each rung play-ready and capped to 2 Skip alternates per locale', () => {
        for (const q of questions) {
            for (const locale of ['en', 'pl'] as const) {
                const rung = q.byLocale[locale];
                expect(rung.current.id).toBe(q.id);
                expect(rung.current.options).toHaveLength(4);
                expect(rung.current.correctIndex).toBeGreaterThanOrEqual(0);
                expect(rung.current.correctIndex).toBeLessThan(4);
                expect(rung.alternates.length).toBeLessThanOrEqual(2);
                expect(rung.current.prompt.length).toBeGreaterThan(0);
            }
            // en/pl describe the same structural rung: same ids, same answer slot.
            expect(q.byLocale.en.current.correctIndex).toBe(q.byLocale.pl.current.correctIndex);
            expect(q.byLocale.en.alternates.map((a) => a.id)).toEqual(q.byLocale.pl.alternates.map((a) => a.id));
        }
    });
});

describe('the-drop freeze', () => {
    const questions = build('the-drop').questions as ChallengeQuestion<DropQuestionPayload>[];

    it('freezes TOTAL_ROUNDS questions with both locales', () => {
        expect(questions).toHaveLength(TOTAL_ROUNDS);
        expectBothLocales(questions);
    });

    it('keeps en/pl options paired through the shuffle and points correctIndex at the true value', () => {
        for (const q of questions) {
            const source = dropQuestions.find((d) => d.id === q.id);
            expect(source).toBeDefined();
            const { en, pl } = q.byLocale;
            expect(en.options).toHaveLength(4);
            expect(pl.options).toHaveLength(4);
            // Each shuffled (en, pl) slot must be a genuine source pair — proof the
            // two locales were permuted together, not independently.
            for (let k = 0; k < 4; k++) {
                const pair = source!.options.find((o) => o.en === en.options[k] && o.pl === pl.options[k]);
                expect(pair).toBeDefined();
            }
            // The frozen correctIndex names the true statistic in both locales.
            expect(en.options[en.correctIndex]).toBe(source!.options[source!.correctIndex].en);
            expect(pl.options[pl.correctIndex]).toBe(source!.options[source!.correctIndex].pl);
        }
    });
});

describe('the-wheel freeze', () => {
    const questions = build('the-wheel').questions as ChallengeQuestion<WheelPuzzlePayload>[];

    it('freezes TOTAL_PUZZLES distinct puzzles with both locales', () => {
        expect(questions).toHaveLength(TOTAL_PUZZLES);
        expectBothLocales(questions);
        expect(new Set(questions.map((q) => q.id)).size).toBe(TOTAL_PUZZLES);
    });

    it('carries a non-empty phrase + category in each locale', () => {
        for (const q of questions) {
            for (const locale of ['en', 'pl'] as const) {
                expect(q.byLocale[locale].id).toBe(q.id);
                expect(q.byLocale[locale].phrase.length).toBeGreaterThan(0);
                expect(q.byLocale[locale].category.length).toBeGreaterThan(0);
            }
        }
    });
});
