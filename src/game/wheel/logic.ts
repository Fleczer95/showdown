// Pure game logic for "The Wheel" (SOLO press-your-luck). No React / react-native imports.
//
// A game is a fixed number of puzzles (TOTAL_PUZZLES). The player keeps a banked
// `score` (total across solved puzzles) and a per-puzzle `roundCash` (unbanked).
// Spin for cash, guess consonants to grow round cash, buy vowels, and choose when
// to solve. Bankrupt zeroes round cash (never the banked score). A correct solve
// banks round cash and advances; a wrong solve ends the puzzle with 0 banked.

export const VOWEL_COST = 250;
export const VOWELS = 'AEIOUĄĘÓ';
export const TOTAL_PUZZLES = 3;

/** Wheel segments. A Bankrupt segment zeroes the player's round cash. */
export interface WheelSegment {
    /** Cash value for a correct consonant; ignored when bankrupt. */
    value: number;
    bankrupt: boolean;
    /** Display label, e.g. "500" or "BANKRUPT". */
    label: string;
}

export const WHEEL: WheelSegment[] = [
    { value: 150, bankrupt: false, label: '150' },
    { value: 0, bankrupt: true, label: 'BANKRUPT' },
    { value: 300, bankrupt: false, label: '300' },
    { value: 500, bankrupt: false, label: '500' },
    { value: 200, bankrupt: false, label: '200' },
    { value: 800, bankrupt: false, label: '800' },
    { value: 250, bankrupt: false, label: '250' },
    { value: 0, bankrupt: true, label: 'BANKRUPT' },
    { value: 400, bankrupt: false, label: '400' },
    { value: 600, bankrupt: false, label: '600' },
    { value: 350, bankrupt: false, label: '350' },
    { value: 1000, bankrupt: false, label: '1000' },
];

const LETTER = /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/** True if `ch` (already uppercased) is an alphabetic letter we can hide. */
export function isLetter(ch: string): boolean {
    return LETTER.test(ch);
}

export function isVowel(ch: string): boolean {
    return VOWELS.includes(ch.toUpperCase());
}

/** Count occurrences of an (uppercased) letter in the phrase, case-insensitive. */
export function countLetter(phrase: string, letter: string): number {
    const target = letter.toUpperCase();
    let n = 0;
    for (const ch of phrase) {
        if (isLetter(ch) && ch.toUpperCase() === target) n++;
    }
    return n;
}

/** Normalize a phrase for solve comparison: uppercase, collapse whitespace. */
export function normalize(phrase: string): string {
    return phrase.trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Correct when the normalized guess matches the phrase. */
export function attemptSolve(phrase: string, guess: string): boolean {
    return normalize(guess) === normalize(phrase);
}

export interface SpinResult {
    /** Index into WHEEL of the landed segment. */
    index: number;
    segment: WheelSegment;
}

/** Land the wheel on a random segment. Returns the segment and its index. */
export function spin(rng: () => number = Math.random): SpinResult {
    const index = Math.floor(rng() * WHEEL.length) % WHEEL.length;
    return { index, segment: WHEEL[index] };
}

// ---------------------------------------------------------------------------
// Solo game state
// ---------------------------------------------------------------------------

export interface PuzzleContent {
    id: string;
    phrase: string;
    category: string;
}

export type GameStatus = 'playing' | 'over';

export interface GameState {
    /** The puzzles for this run (length is TOTAL_PUZZLES). */
    puzzles: PuzzleContent[];
    /** Index of the puzzle currently in play. */
    currentPuzzle: number;
    /** Total banked cash across solved puzzles. */
    score: number;
    /** Unbanked cash for the current puzzle. */
    roundCash: number;
    /** Uppercase letters revealed in the current puzzle. */
    revealed: Set<string>;
    /** Uppercase letters already guessed in the current puzzle (consonants + vowels). */
    guessedLetters: Set<string>;
    status: GameStatus;
}

/** Build the initial state for a run. `puzzles` should have TOTAL_PUZZLES entries. */
export function createGame(puzzles: PuzzleContent[]): GameState {
    return {
        puzzles,
        currentPuzzle: 0,
        score: 0,
        roundCash: 0,
        revealed: new Set(),
        guessedLetters: new Set(),
        status: 'playing',
    };
}

/** The puzzle content currently in play. */
export function currentPuzzle(state: GameState): PuzzleContent {
    return state.puzzles[state.currentPuzzle];
}

/**
 * Masked display of the current puzzle: revealed letters and all non-letters
 * (spaces, punctuation) are shown verbatim; hidden letters become '_'.
 */
export function maskedPhrase(state: GameState): string {
    const phrase = currentPuzzle(state).phrase;
    return Array.from(phrase)
        .map((ch) => {
            if (!isLetter(ch)) return ch;
            return state.revealed.has(ch.toUpperCase()) ? ch : '_';
        })
        .join('');
}

/** True when every alphabetic letter in the current puzzle has been revealed. */
export function isFullyRevealed(state: GameState): boolean {
    const phrase = currentPuzzle(state).phrase;
    for (const ch of phrase) {
        if (isLetter(ch) && !state.revealed.has(ch.toUpperCase())) return false;
    }
    return true;
}

/** True if a letter has already been guessed this puzzle (can't guess twice). */
export function alreadyGuessed(state: GameState, letter: string): boolean {
    return state.guessedLetters.has(letter.toUpperCase());
}

/**
 * Apply a consonant guess at the given spin value.
 * - Present: award `spinValue × occurrences` into round cash and reveal it.
 * - Absent: a wasted spin — no award, just mark it guessed.
 * Either way the letter is marked guessed (can't be guessed again).
 */
export function guessConsonant(state: GameState, letter: string, spinValue: number): GameState {
    const upper = letter.toUpperCase();
    const count = countLetter(currentPuzzle(state).phrase, upper);
    const guessedLetters = new Set(state.guessedLetters);
    guessedLetters.add(upper);
    const revealed = new Set(state.revealed);
    if (count > 0) revealed.add(upper);
    return {
        ...state,
        guessedLetters,
        revealed,
        roundCash: state.roundCash + spinValue * count,
    };
}

/**
 * Buy a vowel: deduct VOWEL_COST from round cash and reveal it, if affordable.
 * Unaffordable buys are a no-op (state returned unchanged).
 */
export function buyVowel(state: GameState, letter: string): GameState {
    if (state.roundCash < VOWEL_COST) return state;
    const upper = letter.toUpperCase();
    const guessedLetters = new Set(state.guessedLetters);
    guessedLetters.add(upper);
    const revealed = new Set(state.revealed);
    revealed.add(upper);
    return {
        ...state,
        guessedLetters,
        revealed,
        roundCash: state.roundCash - VOWEL_COST,
    };
}

/** Apply a Bankrupt: wipe round cash to 0. Banked score is never touched. */
export function applyBankrupt(state: GameState): GameState {
    return { ...state, roundCash: 0 };
}

/** Advance to the next puzzle, banking `banked` into the score. Ends the game after the last. */
function advance(state: GameState, banked: number): GameState {
    const score = state.score + banked;
    const next = state.currentPuzzle + 1;
    if (next >= state.puzzles.length) {
        return { ...state, score, roundCash: 0, status: 'over' };
    }
    return {
        ...state,
        score,
        currentPuzzle: next,
        roundCash: 0,
        revealed: new Set(),
        guessedLetters: new Set(),
    };
}

/**
 * Attempt to solve the current puzzle.
 * - Correct: bank round cash into score, advance to the next puzzle.
 * - Wrong: end the current puzzle with 0 banked, advance to the next puzzle.
 */
export function solve(state: GameState, guess: string): GameState {
    const correct = attemptSolve(currentPuzzle(state).phrase, guess);
    return advance(state, correct ? state.roundCash : 0);
}
