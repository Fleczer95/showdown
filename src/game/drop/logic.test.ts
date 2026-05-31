import {
    STARTING_BANK,
    BUNDLE,
    TOTAL_ROUNDS,
    bundlesOf,
    coverableOptions,
    buildGame,
    isValidAllocation,
    applyRound,
    type DropQuestion,
    type DropState,
} from './logic';

/** Deterministic RNG: returns 0 so shuffles are stable for assertions. */
const zeroRng = () => 0;

function makeQuestion(id: number, correctIndex = 0): DropQuestion {
    return {
        id: `q-${id}`,
        prompt: { en: `Q${id}`, pl: `P${id}` },
        options: [
            { en: `${id}-a`, pl: `${id}-a` },
            { en: `${id}-b`, pl: `${id}-b` },
            { en: `${id}-c`, pl: `${id}-c` },
            { en: `${id}-d`, pl: `${id}-d` },
        ],
        correctIndex,
    };
}

const pool: DropQuestion[] = Array.from({ length: 15 }, (_, i) => makeQuestion(i, i % 4));

describe('bundle math', () => {
    test('starting bank is 40 bundles of 25k', () => {
        expect(STARTING_BANK).toBe(1_000_000);
        expect(BUNDLE).toBe(25_000);
        expect(bundlesOf(STARTING_BANK)).toBe(40);
    });

    test('bundlesOf floors partial bundles', () => {
        expect(bundlesOf(0)).toBe(0);
        expect(bundlesOf(25_000)).toBe(1);
        expect(bundlesOf(50_000)).toBe(2);
    });
});

describe('coverableOptions', () => {
    test('1 bundle can cover only 1 option (forced all-in)', () => {
        expect(coverableOptions(BUNDLE)).toBe(1);
    });

    test('2 bundles can cover at most 2 options', () => {
        expect(coverableOptions(2 * BUNDLE)).toBe(2);
    });

    test('3+ bundles cap at 3 options', () => {
        expect(coverableOptions(3 * BUNDLE)).toBe(3);
        expect(coverableOptions(STARTING_BANK)).toBe(3);
    });
});

describe('isValidAllocation', () => {
    test('accepts a valid 2-option split summing to bank', () => {
        expect(isValidAllocation(100_000, [50_000, 50_000, 0, 0])).toBe(true);
    });

    test('rejects covering all 4 options', () => {
        expect(isValidAllocation(100_000, [25_000, 25_000, 25_000, 25_000])).toBe(false);
    });

    test('rejects non-bundle amounts', () => {
        expect(isValidAllocation(100_000, [40_000, 60_000, 0, 0])).toBe(false);
    });

    test('rejects when sum does not equal bank', () => {
        expect(isValidAllocation(100_000, [25_000, 25_000, 0, 0])).toBe(false);
    });

    test('rejects empty allocation (no option covered)', () => {
        expect(isValidAllocation(0, [0, 0, 0, 0])).toBe(false);
    });

    test('accepts forced all-in on a single option', () => {
        expect(isValidAllocation(BUNDLE, [0, BUNDLE, 0, 0])).toBe(true);
    });
});

describe('buildGame', () => {
    test('picks exactly TOTAL_ROUNDS questions and keeps correctIndex pointing at the true option', () => {
        const state = buildGame(pool, {}, zeroRng);
        expect(state.questions).toHaveLength(TOTAL_ROUNDS);
        expect(state.bank).toBe(STARTING_BANK);
        expect(state.round).toBe(0);
        expect(state.status).toBe('active');

        // After option shuffle, correctIndex must still address a real option.
        for (const q of state.questions) {
            expect(q.correctIndex).toBeGreaterThanOrEqual(0);
            expect(q.correctIndex).toBeLessThan(4);
            expect(q.options).toHaveLength(4);
        }
    });

    test('correct option content is preserved through shuffle', () => {
        // Use a question with a distinctive correct option.
        const q: DropQuestion = {
            id: 'q-true',
            prompt: { en: 'p', pl: 'p' },
            options: [
                { en: 'wrong1', pl: 'wrong1' },
                { en: 'TRUE', pl: 'PRAWDA' },
                { en: 'wrong2', pl: 'wrong2' },
                { en: 'wrong3', pl: 'wrong3' },
            ],
            correctIndex: 1,
        };
        // rng cycling produces a non-identity shuffle.
        let n = 0;
        const rng = () => ((n++ % 7) + 1) / 8;
        const state = buildGame([q, ...pool], {}, rng);
        const built = state.questions.find((bq) => bq.options.some((o) => o.en === 'TRUE'));
        expect(built).toBeDefined();
        expect(built!.options[built!.correctIndex].en).toBe('TRUE');
    });

    test('selects the least-shown questions, excluding high-count ids in a single run', () => {
        // Pool of 15 ids (q-0..q-14); a run takes TOTAL_ROUNDS = 9. Mark the
        // first 6 ids as already heavily shown so the 9 never-shown ids fill
        // the whole run and none of the marked ids appear.
        const history: Record<string, number> = {};
        for (let i = 0; i < 6; i++) {
            history[`q-${i}`] = 99;
        }

        const state = buildGame(pool, history, zeroRng);
        const ids = state.questions.map((q) => q.id);

        expect(ids).toHaveLength(TOTAL_ROUNDS);
        for (let i = 0; i < 6; i++) {
            expect(ids).not.toContain(`q-${i}`);
        }
        // The 9 selected are exactly the never-shown ids q-6..q-14.
        const expected = Array.from({ length: 9 }, (_, i) => `q-${i + 6}`).sort();
        expect([...ids].sort()).toEqual(expected);
    });
});

describe('applyRound', () => {
    const baseState = (overrides: Partial<DropState> = {}): DropState => ({
        bank: 100_000,
        round: 0,
        status: 'active',
        questions: Array.from({ length: TOTAL_ROUNDS }, (_, i) => makeQuestion(i, 1)),
        ...overrides,
    });

    test('keeps only bundles on the correct option (preserve-only, no growth)', () => {
        // correctIndex = 1; place 75k on correct, 25k on wrong.
        const next = applyRound(baseState(), [25_000, 75_000, 0, 0]);
        expect(next.bank).toBe(75_000);
        expect(next.round).toBe(1);
        expect(next.status).toBe('active');
    });

    test('ends the game when the correct option had nothing on it (bank hits 0)', () => {
        const next = applyRound(baseState(), [100_000, 0, 0, 0]);
        expect(next.bank).toBe(0);
        expect(next.status).toBe('over');
    });

    test('ends the game after the final round even with a surviving bank', () => {
        const next = applyRound(baseState({ round: TOTAL_ROUNDS - 1 }), [0, 100_000, 0, 0]);
        expect(next.bank).toBe(100_000);
        expect(next.round).toBe(TOTAL_ROUNDS);
        expect(next.status).toBe('over');
    });

    test('bank never exceeds what was placed on the correct option', () => {
        const next = applyRound(baseState({ bank: 1_000_000 }), [0, 500_000, 500_000, 0]);
        // correctIndex = 1 holds 500k; the other 500k drops.
        expect(next.bank).toBe(500_000);
        expect(next.bank).toBeLessThan(1_000_000);
    });

    test('is a no-op once the game is over', () => {
        const over = baseState({ status: 'over' });
        expect(applyRound(over, [0, 100_000, 0, 0])).toBe(over);
    });
});
