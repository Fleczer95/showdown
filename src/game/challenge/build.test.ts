// The challenge builder freezes an id-only round (ADR-0003): every device has
// all pack content bundled, so the record pins just the question ids and each
// opponent resolves them locally. These tests pin the invariants the resolver
// depends on: the run is the game's normal length, ids are distinct where the
// game requires it, and The Ladder carries its Skip alternates as ids.

import { buildChallenge } from './build';
import { CHALLENGE_TTL_DAYS, type ChallengeQuestion } from './types';
import { dropQuestions } from '../drop/content';
import { RUN_LENGTH } from '../ladder/logic';
import { TOTAL_ROUNDS } from '../drop/logic';
import { DROP_ROUND_DIFFICULTIES } from '../drop/difficulty';
import { TOTAL_PUZZLES } from '../wheel/logic';

const NOW = 1_700_000_000_000;

function build(gameId: string) {
    return buildChallenge({
        gameId,
        history: {},
        ownedIds: new Set<string>(),
        createdBy: { uuid: 'u1', nickname: 'Ada' },
        lang: 'en',
        mascot: { fur: 'fur.orange', suit: 'suit.royal', accent: 'accent.crimson', mic: 'mic.gold' },
        // Fixed rng + clock keep the build deterministic and the clock assertable.
        rng: () => 0.42,
        now: () => NOW,
    });
}

/** Every frozen question must carry a non-empty id — the resolver's only handle. */
function expectIds(questions: ChallengeQuestion[]) {
    for (const q of questions) {
        expect(typeof q.id).toBe('string');
        expect(q.id.length).toBeGreaterThan(0);
    }
}

describe('buildChallenge metadata', () => {
    it('stamps the authoring language, attribution and a 30-day expiry', () => {
        const record = build('the-drop');
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
    const questions = build('the-ladder').questions;

    it('freezes one rung per run step, each with a question id', () => {
        expect(questions).toHaveLength(RUN_LENGTH);
        expectIds(questions);
    });

    it('uses a distinct current question per rung', () => {
        const ids = questions.map((q) => q.id);
        expect(new Set(ids).size).toBe(RUN_LENGTH);
    });

    it('pins up to 2 Skip alternates per rung as ids', () => {
        for (const q of questions) {
            expect(Array.isArray(q.alternates)).toBe(true);
            expect(q.alternates!.length).toBeLessThanOrEqual(2);
            for (const id of q.alternates!) expect(typeof id).toBe('string');
        }
    });
});

describe('the-drop freeze', () => {
    const questions = build('the-drop').questions;

    it('freezes TOTAL_ROUNDS real question ids', () => {
        expect(questions).toHaveLength(TOTAL_ROUNDS);
        expectIds(questions);
        for (const q of questions) {
            expect(dropQuestions.find((d) => d.id === q.id)).toBeDefined();
        }
    });

    it('freezes an easy → medium → hard question curve while keeping the wire id-only', () => {
        const byId = new Map(dropQuestions.map((question) => [question.id, question]));

        expect(questions.map((question) => byId.get(question.id)?.difficulty)).toEqual(DROP_ROUND_DIFFICULTIES);
        for (const question of questions) {
            expect(question).toEqual({ id: question.id });
        }
    });
});

describe('the-wheel freeze', () => {
    const questions = build('the-wheel').questions;

    it('freezes TOTAL_PUZZLES distinct puzzle ids', () => {
        expect(questions).toHaveLength(TOTAL_PUZZLES);
        expectIds(questions);
        expect(new Set(questions.map((q) => q.id)).size).toBe(TOTAL_PUZZLES);
    });
});
