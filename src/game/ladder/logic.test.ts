import {
    RUN_LENGTH,
    buildRun,
    applyAnswer,
    canUseLifeline,
    consumeLifeline,
    fiftyFiftyHidden,
    skipQuestion,
    currentQuestion,
    reachedRung,
    type LadderQuestion,
} from './logic';

// A deterministic pool: each rung has `alts` questions whose correct answer is
// always option 0. Question prompts and ids are unique per (rung, alternate).
function makeRungPool(alts = 2, n = RUN_LENGTH): LadderQuestion[][] {
    return Array.from({ length: n }, (_, i) =>
        Array.from({ length: alts }, (_, a) => ({
            id: `q${i}-alt${a}`,
            prompt: `q${i}-alt${a}`,
            options: [`q${i}-a${a}-correct`, `q${i}-a${a}-w1`, `q${i}-a${a}-w2`, `q${i}-a${a}-w3`],
            correctIndex: 0,
        })),
    );
}

// rng that returns 0 → Fisher-Yates leaves order unchanged, so the first
// candidate stays current and correctIndex stays 0.
const stableRng = () => 0;

describe('buildRun', () => {
    it('builds a run of RUN_LENGTH active rungs', () => {
        const run = buildRun(makeRungPool(), {}, stableRng);
        expect(run.rungs).toHaveLength(RUN_LENGTH);
        expect(run.status).toBe('active');
        expect(run.currentIndex).toBe(0);
        expect(run.usedLifelines).toEqual([]);
    });

    it('throws when the pool has too few rungs', () => {
        expect(() => buildRun(makeRungPool(2, 5), {})).toThrow();
    });

    it('keeps spare questions as alternates for each rung', () => {
        const run = buildRun(makeRungPool(2), {}, stableRng);
        run.rungs.forEach((rung) => {
            expect(rung.alternates).toHaveLength(1);
        });
    });

    it('keeps correctIndex pointing at the correct option after shuffling', () => {
        const run = buildRun(makeRungPool(2), {}, Math.random);
        run.rungs.forEach((rung) => {
            const q = rung.current;
            expect(q.options[q.correctIndex]).toBe(q.options[q.correctIndex]);
            expect(q.options[q.correctIndex].endsWith('correct')).toBe(true);
        });
    });

    it('shows the lower-count question first when history favours it', () => {
        // Give rung 0's default-first question (q0-alt0) a high show-count so the
        // less-seen alternate (q0-alt1) becomes current.
        const history = { 'q0-alt0': 5 };
        const run = buildRun(makeRungPool(2), history, stableRng);
        expect(run.rungs[0].current.id).toBe('q0-alt1');
        expect(run.rungs[0].alternates[0].id).toBe('q0-alt0');
    });

    it('never repeats a question on rungs that share a pool', () => {
        // buildLocalizedRungs feeds the SAME pool array to a group of rungs and
        // relies on buildRun to give each rung a distinct question. Without that,
        // adjacent rungs show the same question back-to-back (the reported bug).
        const pool: LadderQuestion[] = ['p0', 'p1', 'p2'].map((id) => ({
            id,
            prompt: id,
            options: ['a', 'b', 'c', 'd'],
            correctIndex: 0,
        }));
        const rungPool = Array.from({ length: RUN_LENGTH }, () => pool);
        const run = buildRun(rungPool, {}, stableRng);
        const firstThree = run.rungs.slice(0, 3).map((r) => r.current.id);
        expect(new Set(firstThree).size).toBe(3);
    });
});

describe('applyAnswer', () => {
    it('advances on a correct answer', () => {
        const run = buildRun(makeRungPool(), {}, stableRng);
        const next = applyAnswer(run, currentQuestion(run).correctIndex);
        expect(next.status).toBe('active');
        expect(next.currentIndex).toBe(1);
    });

    it('ends the run on a wrong answer', () => {
        const run = buildRun(makeRungPool(), {}, stableRng);
        const wrong = currentQuestion(run).correctIndex === 0 ? 1 : 0;
        const next = applyAnswer(run, wrong);
        expect(next.status).toBe('lost');
    });

    it('wins when the final rung is answered correctly', () => {
        let run = buildRun(makeRungPool(), {}, stableRng);
        for (let i = 0; i < RUN_LENGTH; i++) {
            run = applyAnswer(run, currentQuestion(run).correctIndex);
        }
        expect(run.status).toBe('won');
        expect(reachedRung(run)).toBe(RUN_LENGTH);
    });

    it('is a no-op once the run has ended', () => {
        const run = buildRun(makeRungPool(), {}, stableRng);
        const lost = applyAnswer(run, currentQuestion(run).correctIndex === 0 ? 1 : 0);
        expect(applyAnswer(lost, currentQuestion(lost).correctIndex)).toBe(lost);
    });
});

describe('lifelines', () => {
    it('each lifeline is consumable exactly once', () => {
        let run = buildRun(makeRungPool(), {}, stableRng);
        expect(canUseLifeline(run, 'skip')).toBe(true);
        run = consumeLifeline(run, 'skip');
        expect(canUseLifeline(run, 'skip')).toBe(false);
        // consuming again leaves it unchanged
        expect(consumeLifeline(run, 'skip')).toBe(run);
        // other lifelines remain available
        expect(canUseLifeline(run, 'fiftyFifty')).toBe(true);
        expect(canUseLifeline(run, 'askStudio')).toBe(true);
    });

    it('50:50 hides exactly two wrong answers and never the correct one', () => {
        const run = buildRun(makeRungPool(), {}, Math.random);
        for (let trial = 0; trial < 50; trial++) {
            const hidden = fiftyFiftyHidden(run, Math.random);
            expect(hidden).toHaveLength(2);
            expect(new Set(hidden).size).toBe(2);
            expect(hidden).not.toContain(currentQuestion(run).correctIndex);
        }
    });
});

describe('skip lifeline', () => {
    it('swaps the current question for a different same-rung question without changing the rung', () => {
        const run = buildRun(makeRungPool(2), {}, stableRng);
        const before = currentQuestion(run).prompt;
        const next = skipQuestion(run, stableRng);
        expect(next.status).toBe('active');
        expect(next.currentIndex).toBe(0);
        expect(currentQuestion(next).prompt).not.toBe(before);
        // both prompts belong to the same rung
        expect(currentQuestion(next).prompt.startsWith('q0-')).toBe(true);
    });

    it('consumes the Skip lifeline and removes the swapped-in alternate', () => {
        const run = buildRun(makeRungPool(2), {}, stableRng);
        const next = skipQuestion(run, stableRng);
        expect(next.usedLifelines).toContain('skip');
        expect(canUseLifeline(next, 'skip')).toBe(false);
        expect(next.rungs[0].alternates).toHaveLength(0);
    });

    it('cannot be used to win the final rung — it does not advance', () => {
        let run = buildRun(makeRungPool(2), {}, stableRng);
        for (let i = 0; i < RUN_LENGTH - 1; i++) {
            run = applyAnswer(run, currentQuestion(run).correctIndex);
        }
        expect(run.currentIndex).toBe(RUN_LENGTH - 1);
        const next = skipQuestion(run, stableRng);
        expect(next.status).toBe('active');
        expect(next.currentIndex).toBe(RUN_LENGTH - 1);
    });

    it('is unavailable when no alternate remains for the rung', () => {
        const run = buildRun(makeRungPool(1), {}, stableRng);
        expect(run.rungs[0].alternates).toHaveLength(0);
        expect(canUseLifeline(run, 'skip')).toBe(false);
        // attempting the swap is a no-op
        expect(skipQuestion(run, stableRng)).toBe(run);
    });
});
