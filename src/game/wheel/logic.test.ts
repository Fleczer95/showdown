import {
    VOWEL_COST,
    TOTAL_PUZZLES,
    createGame,
    currentPuzzle,
    maskedPhrase,
    countLetter,
    isFullyRevealed,
    alreadyGuessed,
    spinWithPower,
    sampleJitter,
    JITTER_WEIGHTS,
    guessConsonant,
    buyVowel,
    applyBankrupt,
    solve,
    attemptSolve,
    type PuzzleContent,
} from './logic';

/** Deterministic rng that yields a fixed sequence of values in [0,1). */
function seq(values: number[]): () => number {
    let i = 0;
    return () => values[i++ % values.length];
}

const PUZZLES: PuzzleContent[] = [
    { id: 'p1', phrase: 'HELLO WORLD', category: 'Phrase' },
    { id: 'p2', phrase: 'TIME IS MONEY', category: 'Proverb' },
    { id: 'p3', phrase: 'PIECE OF CAKE', category: 'Idiom' },
];

describe('maskedPhrase', () => {
    it('hides letters but shows spaces and punctuation', () => {
        const g = createGame([{ id: 'p1', phrase: "IT'S A TEST", category: 'Phrase' }]);
        expect(maskedPhrase(g)).toBe("__'_ _ ____");
    });

    it('shows revealed letters verbatim', () => {
        const g = guessConsonant(createGame(PUZZLES), 'L', 100);
        expect(maskedPhrase(g)).toBe('__LL_ ___L_');
    });
});

describe('guessConsonant', () => {
    it('adds value × occurrences to round cash and reveals when present', () => {
        const g = guessConsonant(createGame(PUZZLES), 'l', 200);
        // HELLO WORLD has 3 L's
        expect(g.roundCash).toBe(600);
        expect(g.revealed.has('L')).toBe(true);
        expect(g.guessedLetters.has('L')).toBe(true);
    });

    it('is a no-op except marking guessed when the consonant is absent', () => {
        const start = createGame(PUZZLES);
        const g = guessConsonant(start, 'Z', 500);
        expect(g.roundCash).toBe(0);
        expect(g.revealed.has('Z')).toBe(false);
        expect(g.guessedLetters.has('Z')).toBe(true);
    });

    it('accumulates round cash across multiple correct guesses', () => {
        let g = createGame(PUZZLES);
        g = guessConsonant(g, 'L', 100); // 3 × 100 = 300
        g = guessConsonant(g, 'D', 200); // 1 × 200 = 200
        expect(g.roundCash).toBe(500);
    });

    it('tracks guessed letters so they cannot be reused', () => {
        const g = guessConsonant(createGame(PUZZLES), 'L', 100);
        expect(alreadyGuessed(g, 'l')).toBe(true);
        expect(alreadyGuessed(g, 'Z')).toBe(false);
    });
});

describe('sampleJitter', () => {
    // Thresholds derived from JITTER_WEIGHTS {0:0.3, 1:0.5, 2:0.2}:
    // r<0.3 -> 0 | 0.3<=r<0.8 -> ±1 | 0.8<=r -> ±2. Sign: rng<0.5 -> negative.
    it('returns 0 across the whole magnitude-0 band (no sign draw)', () => {
        expect(sampleJitter(seq([0]))).toBe(0);
        expect(sampleJitter(seq([0.29]))).toBe(0);
    });

    it('returns ±1 in the magnitude-1 band, sign from the second draw', () => {
        expect(sampleJitter(seq([0.3, 0.9]))).toBe(1);
        expect(sampleJitter(seq([0.3, 0.0]))).toBe(-1);
        expect(sampleJitter(seq([0.79, 0.9]))).toBe(1);
    });

    it('returns ±2 in the magnitude-2 band', () => {
        expect(sampleJitter(seq([0.8, 0.9]))).toBe(2);
        expect(sampleJitter(seq([0.999, 0.0]))).toBe(-2);
    });

    it('honours JITTER_WEIGHTS proportions over many seeded samples', () => {
        // mulberry32 — deterministic PRNG so the statistical check never flakes.
        let s = 0x9e3779b9;
        const rng = () => {
            s |= 0;
            s = (s + 0x6d2b79f5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const N = 20000;
        const counts = { 0: 0, 1: 0, 2: 0 };
        for (let i = 0; i < N; i++) counts[Math.abs(sampleJitter(rng)) as 0 | 1 | 2]++;
        expect(counts[0] / N).toBeCloseTo(JITTER_WEIGHTS[0], 1);
        expect(counts[1] / N).toBeCloseTo(JITTER_WEIGHTS[1], 1);
        expect(counts[2] / N).toBeCloseTo(JITTER_WEIGHTS[2], 1);
    });
});

describe('spinWithPower / Bankrupt', () => {
    it('maps power monotonically across the 12 segments (no jitter)', () => {
        // seq([0]) -> magnitude-0 band -> zero jitter, so index == target.
        expect(spinWithPower(0, seq([0])).index).toBe(0);
        expect(spinWithPower(0, seq([0])).segment.value).toBe(150);
        expect(spinWithPower(0.5, seq([0])).index).toBe(6);
        expect(spinWithPower(0.99, seq([0])).index).toBe(11);
    });

    it('applies jitter on top of the targeted segment', () => {
        // target 0, +1 jitter -> index 1, which is a Bankrupt segment.
        const result = spinWithPower(0, seq([0.3, 0.9]));
        expect(result.index).toBe(1);
        expect(result.segment.bankrupt).toBe(true);
    });

    it('wraps the index within 0..11 when jitter crosses the seam', () => {
        // target 0, -1 jitter -> wraps to index 11 (value 1000).
        const result = spinWithPower(0, seq([0.3, 0.0]));
        expect(result.index).toBe(11);
        expect(result.segment.value).toBe(1000);
    });

    it('Bankrupt zeroes round cash but not the banked score', () => {
        let g = createGame(PUZZLES);
        g = { ...g, score: 1000 };
        g = guessConsonant(g, 'L', 300); // round cash 900
        expect(g.roundCash).toBe(900);
        g = applyBankrupt(g);
        expect(g.roundCash).toBe(0);
        expect(g.score).toBe(1000);
    });
});

describe('buyVowel', () => {
    it('deducts the cost and reveals when affordable', () => {
        let g = createGame(PUZZLES);
        g = guessConsonant(g, 'L', 200); // round cash 600
        const before = g.roundCash;
        g = buyVowel(g, 'O');
        expect(g.roundCash).toBe(before - VOWEL_COST);
        expect(g.revealed.has('O')).toBe(true);
        expect(maskedPhrase(g)).toBe('__LLO _O_L_');
    });

    it('is a no-op when the player cannot afford it', () => {
        const start = createGame(PUZZLES); // round cash 0
        const g = buyVowel(start, 'O');
        expect(g.roundCash).toBe(0);
        expect(g.revealed.has('O')).toBe(false);
    });
});

describe('solve', () => {
    it('banks round cash and advances on a correct solve', () => {
        let g = createGame(PUZZLES);
        g = guessConsonant(g, 'L', 300); // round cash 900
        g = solve(g, '  hello   world ');
        expect(g.score).toBe(900);
        expect(g.currentPuzzle).toBe(1);
        expect(g.roundCash).toBe(0);
        expect(g.status).toBe('playing');
        expect(currentPuzzle(g).phrase).toBe('TIME IS MONEY');
    });

    it('ends the run as lost on a wrong solve, keeping banked score', () => {
        let g = createGame(PUZZLES);
        // Bank puzzle 1, then miss puzzle 2.
        g = guessConsonant(g, 'L', 100); // round cash 300
        g = solve(g, 'HELLO WORLD'); // banks 300, advances to puzzle 2
        g = guessConsonant(g, 'M', 500); // round cash 500 (unbanked)
        g = solve(g, 'GOODBYE WORLD');
        expect(g.status).toBe('lost');
        expect(g.score).toBe(300); // earlier banked score is kept
        expect(g.roundCash).toBe(0); // current round cash forfeited
        expect(g.currentPuzzle).toBe(1); // stays on the missed puzzle
    });

    it('clears revealed and guessed letters for the next puzzle', () => {
        let g = createGame(PUZZLES);
        g = guessConsonant(g, 'L', 100);
        g = solve(g, 'HELLO WORLD');
        expect(g.revealed.size).toBe(0);
        expect(g.guessedLetters.size).toBe(0);
    });
});

describe('game over after the last puzzle', () => {
    it(`ends 'over' after solving all ${TOTAL_PUZZLES} puzzles with score = sum of banked`, () => {
        let g = createGame(PUZZLES);
        // Puzzle 1: bank 300
        g = guessConsonant(g, 'L', 100); // 300
        g = solve(g, 'HELLO WORLD');
        // Puzzle 2: bank 1000
        g = guessConsonant(g, 'M', 500); // 'TIME IS MONEY' has 2 M -> 1000
        g = solve(g, 'TIME IS MONEY');
        // Puzzle 3: bank 400
        g = guessConsonant(g, 'C', 200); // 'PIECE OF CAKE' has 2 C -> 400
        g = solve(g, 'PIECE OF CAKE');
        expect(g.status).toBe('over');
        expect(g.score).toBe(1700);
    });
});

describe('helpers', () => {
    it('attemptSolve is case/space-insensitive', () => {
        expect(attemptSolve('TIME IS MONEY', '  time   is money ')).toBe(true);
        expect(attemptSolve('TIME IS MONEY', 'TIME IS HONEY')).toBe(false);
    });

    it('attemptSolve ignores accents and Polish ł', () => {
        expect(attemptSolve('CAFÉ', 'cafe')).toBe(true);
        expect(attemptSolve('ŁÓDŹ', 'lodz')).toBe(true);
        expect(attemptSolve('ZAŻÓŁĆ GĘŚLĄ JAŹŃ', 'zazolc gesla jazn')).toBe(true);
    });

    it('isFullyRevealed reflects the current puzzle', () => {
        let g = createGame([{ id: 'p1', phrase: 'HI', category: 'X' }]);
        expect(isFullyRevealed(g)).toBe(false);
        g = guessConsonant(g, 'H', 100);
        g = buyVowel({ ...g, roundCash: VOWEL_COST }, 'I');
        expect(isFullyRevealed(g)).toBe(true);
    });

    it('countLetter ignores case', () => {
        expect(countLetter('Mississippi', 's')).toBe(4);
    });
});
