// Pure game logic for "The Ladder". No React / react-native imports.

import { createDeck, type History } from '../deck';

export const RUN_LENGTH = 15;

export type Lifeline = 'fiftyFifty' | 'askStudio' | 'skip';

export interface LadderQuestion {
    /** Stable id, unique within the game. Used for question history. */
    id: string;
    /** Question prompt shown to the player. */
    prompt: string;
    /** Four answer options, in display order. */
    options: string[];
    /** Index (0-3) of the correct option within `options`. */
    correctIndex: number;
    /** Optional hint surfaced by the "Ask the Studio" lifeline. */
    hint?: string;
}

/** One rung of the climb: the question being asked plus untouched spares. */
export interface LadderRung {
    /** The question currently shown for this rung. */
    current: LadderQuestion;
    /** Unused same-rung questions that Skip can swap to. */
    alternates: LadderQuestion[];
}

export interface LadderRun {
    /** RUN_LENGTH rungs, ordered by increasing difficulty. */
    rungs: LadderRung[];
    /** Index of the rung currently being answered (0-based). */
    currentIndex: number;
    /** Lifelines already consumed; each may be used once. */
    usedLifelines: Lifeline[];
    status: 'active' | 'won' | 'lost';
}

/** Fisher-Yates shuffle returning a new array. */
function shuffle<T>(items: T[], rng: () => number): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** Shuffle one question's options and re-point its correctIndex. */
function shuffleOptions(q: LadderQuestion, rng: () => number): LadderQuestion {
    const correctOption = q.options[q.correctIndex];
    const options = shuffle(q.options, rng);
    return { ...q, options, correctIndex: options.indexOf(correctOption) };
}

/**
 * Build a fresh run of RUN_LENGTH rungs.
 * `rungPool[i]` holds every question available for rung i (at least one;
 * extras become Skip alternates). The pool is ordered by increasing
 * difficulty and we preserve that order so the climb gets harder.
 * Within each rung, `history` orders candidates least-shown-first so the
 * least-seen question is shown and Skip pulls the next-least-seen.
 */
export function buildRun(
    rungPool: LadderQuestion[][],
    history: History,
    rng: () => number = Math.random,
): LadderRun {
    if (rungPool.length < RUN_LENGTH) {
        throw new Error(`Need at least ${RUN_LENGTH} rungs, got ${rungPool.length}`);
    }
    const rungs: LadderRung[] = rungPool.slice(0, RUN_LENGTH).map((candidates) => {
        if (candidates.length < 1) {
            throw new Error('Each rung needs at least one question');
        }
        const ordered = createDeck(candidates, history, rng).map((q) => shuffleOptions(q, rng));
        const [current, ...alternates] = ordered;
        return { current, alternates };
    });
    return {
        rungs,
        currentIndex: 0,
        usedLifelines: [],
        status: 'active',
    };
}

/** The question being answered right now. */
export function currentQuestion(run: LadderRun): LadderQuestion {
    return run.rungs[run.currentIndex].current;
}

/** Apply an answer choice. Correct → advance (or win at the top); wrong → lost. */
export function applyAnswer(run: LadderRun, choiceIndex: number): LadderRun {
    if (run.status !== 'active') {
        return run;
    }
    const question = currentQuestion(run);
    if (choiceIndex !== question.correctIndex) {
        return { ...run, status: 'lost' };
    }
    const nextIndex = run.currentIndex + 1;
    if (nextIndex >= RUN_LENGTH) {
        return { ...run, currentIndex: RUN_LENGTH - 1, status: 'won' };
    }
    return { ...run, currentIndex: nextIndex };
}

/** Whether a lifeline is still available. */
export function canUseLifeline(run: LadderRun, lifeline: Lifeline): boolean {
    if (run.status !== 'active' || run.usedLifelines.includes(lifeline)) {
        return false;
    }
    // Skip additionally needs an alternate question on the current rung.
    if (lifeline === 'skip' && run.rungs[run.currentIndex].alternates.length === 0) {
        return false;
    }
    return true;
}

/** Mark a lifeline as consumed. */
export function consumeLifeline(run: LadderRun, lifeline: Lifeline): LadderRun {
    if (!canUseLifeline(run, lifeline)) {
        return run;
    }
    return { ...run, usedLifelines: [...run.usedLifelines, lifeline] };
}

/**
 * 50:50 — pick exactly two WRONG answer indices to hide for the current
 * question. Never returns the correct index. Deterministic with a seeded rng.
 */
export function fiftyFiftyHidden(run: LadderRun, rng: () => number = Math.random): number[] {
    const question = currentQuestion(run);
    const wrong = question.options
        .map((_, i) => i)
        .filter((i) => i !== question.correctIndex);
    return shuffle(wrong, rng).slice(0, 2);
}

/**
 * "Skip" — swap the current rung's question for an unused same-rung alternate.
 * Does NOT advance the climb: the player must still answer the new question.
 * Consumes the Skip lifeline. No-op if Skip is unavailable (already used, run
 * ended, or no alternate remains).
 */
export function skipQuestion(run: LadderRun, rng: () => number = Math.random): LadderRun {
    if (!canUseLifeline(run, 'skip')) {
        return run;
    }
    const rung = run.rungs[run.currentIndex];
    // alternates are already ordered least-shown-first; take the next one.
    const [next, ...remaining] = rung.alternates;
    const swapped = shuffleOptions(next, rng);
    const rungs = run.rungs.map((r, i) =>
        i === run.currentIndex ? { current: swapped, alternates: remaining } : r,
    );
    return { ...run, rungs, usedLifelines: [...run.usedLifelines, 'skip'] };
}

/** Human-facing "reached" rung (1-based). */
export function reachedRung(run: LadderRun): number {
    return run.status === 'won' ? RUN_LENGTH : run.currentIndex + 1;
}
