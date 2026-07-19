// Pure game logic for "The Drop" — a solo bank-allocation game.
// No React / React Native imports here; this file is unit-tested in isolation.

import { createDeck, type History } from '../deck';
import { DROP_DIFFICULTIES, DROP_ROUND_DIFFICULTIES, type DropDifficulty } from './difficulty';

export const STARTING_BANK = 1_000_000;
export const BUNDLE = 25_000;
export const TOTAL_ROUNDS = DROP_ROUND_DIFFICULTIES.length;
export const MAX_OPTIONS_COVERED = 3;

/** A question as it lives in the active game (options already shuffled). */
export interface DropQuestion {
    /** Stable id used for no-repeat history tracking. */
    id: string;
    /** Localized prompt, picked by caller via prompt[locale]. */
    prompt: { en: string; pl: string };
    /** Exactly 4 localized option strings. */
    options: { en: string; pl: string }[];
    /** Index (0-3) of the true statistic within `options`. */
    correctIndex: number;
    /** Classifier-authored level used to build the easy → hard round curve. */
    difficulty: DropDifficulty;
}

export type DropStatus = 'active' | 'over';

export interface DropState {
    /** Current bank in currency units (always a multiple of BUNDLE, or 0). */
    bank: number;
    /** Index of the round being played (0-based). */
    round: number;
    status: DropStatus;
    /** The 9 questions in play for this run. */
    questions: DropQuestion[];
}

type Rng = () => number;

/** How many bundles a given bank represents. */
export function bundlesOf(bank: number): number {
    return Math.floor(bank / BUNDLE);
}

/**
 * Maximum number of options the player may cover this round.
 * Capped at MAX_OPTIONS_COVERED, but also limited by how many bundles are held
 * (you cannot spread 2 bundles across 3 options).
 */
export function coverableOptions(bank: number): number {
    return Math.min(MAX_OPTIONS_COVERED, bundlesOf(bank));
}

/**
 * Fisher–Yates shuffle returning a new array. Deterministic given `rng`.
 */
function shuffle<T>(items: T[], rng: Rng): T[] {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

/**
 * Build a fresh game with three questions at each difficulty level. Selection
 * is least-shown-first within each level, then the levels are concatenated in
 * easy → medium → hard order. Each question's options are shuffled afterward.
 */
export function buildGame(pool: DropQuestion[], history: History, rng: Rng = Math.random): DropState {
    const decks = Object.fromEntries(
        DROP_DIFFICULTIES.map((difficulty) => [
            difficulty,
            createDeck(
                pool.filter((question) => question.difficulty === difficulty),
                history,
                rng,
            ),
        ]),
    ) as Record<DropDifficulty, DropQuestion[]>;

    for (const difficulty of DROP_DIFFICULTIES) {
        const required = DROP_ROUND_DIFFICULTIES.filter((level) => level === difficulty).length;
        if (decks[difficulty].length < required) {
            throw new Error(
                `The Drop needs at least ${required} ${difficulty} questions, got ${decks[difficulty].length}.`,
            );
        }
    }

    const picked = DROP_ROUND_DIFFICULTIES.map((difficulty) => decks[difficulty].shift()!);

    const questions: DropQuestion[] = picked.map((q) => {
        const correctOption = q.options[q.correctIndex];
        const shuffledOptions = shuffle(q.options, rng);
        return {
            ...q,
            options: shuffledOptions,
            correctIndex: shuffledOptions.indexOf(correctOption),
        };
    });

    return {
        bank: STARTING_BANK,
        round: 0,
        status: 'active',
        questions,
    };
}

/**
 * Validate a proposed allocation against the current bank.
 * Rules:
 *  - sum of allocation equals the bank exactly,
 *  - every entry is a non-negative multiple of BUNDLE,
 *  - at least one option is covered,
 *  - at most MAX_OPTIONS_COVERED options are covered (never all 4).
 */
export function isValidAllocation(bank: number, allocation: number[]): boolean {
    if (allocation.length !== 4) {
        return false;
    }

    let sum = 0;
    let covered = 0;
    for (const amount of allocation) {
        if (!Number.isInteger(amount) || amount < 0 || amount % BUNDLE !== 0) {
            return false;
        }
        sum += amount;
        if (amount > 0) {
            covered += 1;
        }
    }

    if (sum !== bank) {
        return false;
    }
    if (covered < 1 || covered > MAX_OPTIONS_COVERED) {
        return false;
    }

    return true;
}

/**
 * Apply a round's allocation and advance the game.
 * Only bundles on the correct option survive (preserve-only — never grown).
 * The game ends when the bank hits 0 or all rounds are played.
 */
export function applyRound(state: DropState, allocation: number[]): DropState {
    if (state.status !== 'active') {
        return state;
    }

    const question = state.questions[state.round];
    const survived = allocation[question.correctIndex];

    const nextRound = state.round + 1;
    const isLastRound = nextRound >= TOTAL_ROUNDS;
    const status: DropStatus = survived === 0 || isLastRound ? 'over' : 'active';

    return {
        bank: survived,
        round: nextRound,
        status,
        questions: state.questions,
    };
}
