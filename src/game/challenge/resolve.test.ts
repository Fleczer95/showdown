// Resolvers turn a frozen record back into each game's runtime state, and the
// gates decide if this app can open it. Both are pure, so we build a real record
// with `buildChallenge` and round-trip it.

import { buildChallenge } from './build';
import {
    dropStateFromRecord,
    gateChallenge,
    ladderRunFromRecord,
    missingContentIds,
    ownedQuestionIds,
    wheelGameFromRecord,
} from './resolve';
import { type ChallengeRecord } from './types';
import { STARTING_BANK, TOTAL_ROUNDS } from '../drop/logic';
import { RUN_LENGTH } from '../ladder/logic';
import { TOTAL_PUZZLES } from '../wheel/logic';

const NOW = 1_700_000_000_000;

function record(gameId: string): ChallengeRecord {
    return buildChallenge({
        gameId,
        history: {},
        ownedIds: new Set<string>(),
        createdBy: { uuid: 'u1', nickname: 'Ada' },
        lang: 'en',
        mascot: { fur: 'fur.orange', suit: 'suit.royal', accent: 'accent.crimson', mic: 'mic.gold' },
        rng: () => 0.42,
        now: () => NOW,
    });
}

describe('ladderRunFromRecord', () => {
    it('rebuilds an active run of every frozen rung', () => {
        const run = ladderRunFromRecord(record('the-ladder'), 'en');
        expect(run.status).toBe('active');
        expect(run.currentIndex).toBe(0);
        expect(run.usedLifelines).toEqual([]);
        expect(run.rungs).toHaveLength(RUN_LENGTH);
        for (const rung of run.rungs) {
            expect(rung.current.options).toHaveLength(4);
            expect(rung.alternates.length).toBeLessThanOrEqual(2);
        }
    });

    it('falls back to the authoring language for an unsupported locale', () => {
        const rec = record('the-ladder');
        // A device locale not embedded in the record resolves via `lang` ('en').
        const run = ladderRunFromRecord(rec, 'de' as 'en');
        expect(run.rungs[0].current.prompt.length).toBeGreaterThan(0);
    });
});

describe('dropStateFromRecord', () => {
    it('rebuilds a fresh bilingual state at the starting bank', () => {
        const state = dropStateFromRecord(record('the-drop'));
        expect(state.bank).toBe(STARTING_BANK);
        expect(state.round).toBe(0);
        expect(state.status).toBe('active');
        expect(state.questions).toHaveLength(TOTAL_ROUNDS);
        for (const q of state.questions) {
            expect(typeof q.prompt.en).toBe('string');
            expect(typeof q.prompt.pl).toBe('string');
            expect(q.options).toHaveLength(4);
            expect(q.options[q.correctIndex].en.length).toBeGreaterThan(0);
        }
    });
});

describe('wheelGameFromRecord', () => {
    it('rebuilds a fresh game of every frozen puzzle', () => {
        const game = wheelGameFromRecord(record('the-wheel'), 'pl');
        expect(game.currentPuzzle).toBe(0);
        expect(game.score).toBe(0);
        expect(game.status).toBe('playing');
        expect(game.puzzles).toHaveLength(TOTAL_PUZZLES);
        expect(game.puzzles[0].phrase.length).toBeGreaterThan(0);
    });
});

describe('gateChallenge', () => {
    const rec = record('the-drop'); // expiresAt = NOW + 30d

    it('passes a record within the validity window', () => {
        expect(gateChallenge(rec, NOW)).toBe('ok');
    });

    it('reports expired once past expiresAt', () => {
        expect(gateChallenge(rec, rec.expiresAt + 1)).toBe('expired');
    });
});

describe('missingContentIds', () => {
    it('is empty when every referenced id is on-device', () => {
        expect(missingContentIds(record('the-ladder'))).toEqual([]);
        expect(missingContentIds(record('the-drop'))).toEqual([]);
        expect(missingContentIds(record('the-wheel'))).toEqual([]);
    });

    it('reports a pinned id this app does not have (a newer pack)', () => {
        const rec = record('the-drop');
        const tampered = { ...rec, questions: [...rec.questions, { id: 'drop-from-a-future-pack' }] };
        expect(missingContentIds(tampered)).toEqual(['drop-from-a-future-pack']);
    });

    it('reports a missing Ladder Skip alternate', () => {
        const rec = record('the-ladder');
        const questions = rec.questions.map((q, i) =>
            i === 0 ? { ...q, alternates: [...(q.alternates ?? []), 'ladder-future'] } : q,
        );
        expect(missingContentIds({ ...rec, questions })).toEqual(['ladder-future']);
    });

    it('treats an unknown game as fully unresolvable', () => {
        const rec = { ...record('the-drop'), game: 'the-grid' };
        expect(missingContentIds(rec).length).toBe(rec.questions.length);
    });
});

describe('ownedQuestionIds', () => {
    it('includes free base content and excludes unknown ids', () => {
        const ladder = ownedQuestionIds('the-ladder', new Set());
        expect(ladder.has('ladder-001')).toBe(true);
        expect(ladder.has('definitely-not-a-question')).toBe(false);
        expect(ownedQuestionIds('the-drop', new Set()).has('drop-001')).toBe(true);
        expect(ownedQuestionIds('the-wheel', new Set()).has('wheel-001')).toBe(true);
    });
});
