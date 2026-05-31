import {
    WHEEL,
    VOWEL_COST,
    TOTAL_PUZZLES,
    createGame,
    currentPuzzle,
    maskedPhrase,
    countLetter,
    isFullyRevealed,
    alreadyGuessed,
    spin,
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

describe('spin / Bankrupt', () => {
    it('lands deterministically with injected rng', () => {
        expect(spin(seq([0])).segment.value).toBe(150);
    });

    it('can land on a Bankrupt segment', () => {
        const bankruptIndex = WHEEL.findIndex((s) => s.bankrupt);
        const result = spin(seq([bankruptIndex / WHEEL.length]));
        expect(result.segment.bankrupt).toBe(true);
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

    it('advances with 0 banked on a wrong solve', () => {
        let g = createGame(PUZZLES);
        g = guessConsonant(g, 'L', 300); // round cash 900
        g = solve(g, 'GOODBYE WORLD');
        expect(g.score).toBe(0);
        expect(g.currentPuzzle).toBe(1);
        expect(g.roundCash).toBe(0);
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
    it(`ends after ${TOTAL_PUZZLES} puzzles with score = sum of banked`, () => {
        let g = createGame(PUZZLES);
        // Puzzle 1: bank 300
        g = guessConsonant(g, 'L', 100); // 300
        g = solve(g, 'HELLO WORLD');
        // Puzzle 2: wrong solve, bank 0
        g = guessConsonant(g, 'M', 500); // 'TIME IS MONEY' has 1 M -> 500
        g = solve(g, 'WRONG');
        // Puzzle 3: bank 400
        g = guessConsonant(g, 'C', 200); // 'PIECE OF CAKE' has 2 C -> 400
        g = solve(g, 'PIECE OF CAKE');
        expect(g.status).toBe('over');
        expect(g.score).toBe(700);
    });
});

describe('helpers', () => {
    it('attemptSolve is case/space-insensitive', () => {
        expect(attemptSolve('TIME IS MONEY', '  time   is money ')).toBe(true);
        expect(attemptSolve('TIME IS MONEY', 'TIME IS HONEY')).toBe(false);
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
