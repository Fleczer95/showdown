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
    // Track questions already chosen as a rung's `current` so that rungs sharing
    // a pool (buildLocalizedRungs feeds the same pool to a group of 3) never show
    // the same question on two rungs. Alternates may still overlap — Skip is rare
    // and reserving them would starve small shared pools.
    const usedCurrentIds = new Set<string>();
    const rungs: LadderRung[] = rungPool.slice(0, RUN_LENGTH).map((candidates) => {
        if (candidates.length < 1) {
            throw new Error('Each rung needs at least one question');
        }
        const ordered = createDeck(candidates, history, rng);
        // Prefer the least-shown question not already used this run; fall back to
        // the least-shown one if a tiny pool leaves no fresh option.
        const pickIndex = Math.max(
            ordered.findIndex((q) => !usedCurrentIds.has(q.id)),
            0,
        );
        usedCurrentIds.add(ordered[pickIndex].id);
        const current = shuffleOptions(ordered[pickIndex], rng);
        const alternates = ordered
            .filter((_, i) => i !== pickIndex)
            .map((q) => shuffleOptions(q, rng));
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

/** Linear interpolation between a and b. */
function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * Turn fractional shares (summing to ~1) into integer percentages that sum to
 * exactly 100, using the largest-remainder method. Zero shares stay 0 — they
 * never receive leftover, so hidden options remain at 0%.
 */
function toPercentages(shares: number[]): number[] {
    const scaled = shares.map((s) => s * 100);
    const out = scaled.map(Math.floor);
    let remainder = 100 - out.reduce((a, b) => a + b, 0);
    const byFraction = scaled
        .map((s, i) => ({ i, frac: s - Math.floor(s) }))
        .filter(({ i }) => shares[i] > 0)
        .sort((a, b) => b.frac - a.frac);
    for (let k = 0; remainder > 0 && k < byFraction.length; k++) {
        out[byFraction[k].i] += 1;
        remainder--;
    }
    return out;
}

/**
 * "Ask the Studio" — simulate an audience poll for the current question.
 * Returns a percentage per option in option order; live options sum to 100 and
 * `hidden` options (e.g. removed earlier by 50:50) stay at 0, so the poll is
 * split only across what the player can still see.
 *
 * Crowd reliability scales with the rung: on early rungs the correct answer
 * wins by a landslide, but near the top the vote splits and a single "trap"
 * wrong answer can occasionally edge out the correct one. Deterministic with a
 * seeded rng.
 */
export function audienceVote(
    run: LadderRun,
    hidden: number[] = [],
    rng: () => number = Math.random,
): number[] {
    const question = currentQuestion(run);
    const optionCount = question.options.length;
    const live = question.options.map((_, i) => i).filter((i) => !hidden.includes(i));
    const liveWrong = live.filter((i) => i !== question.correctIndex);

    // Difficulty: 0 on the first rung → 1 at the top.
    const d = RUN_LENGTH > 1 ? run.currentIndex / (RUN_LENGTH - 1) : 0;

    // One surviving wrong option becomes the "trap" that draws protest votes,
    // gaining pull as the climb gets harder until it can rival the correct one.
    const trap = liveWrong.length > 0 ? liveWrong[Math.floor(rng() * liveWrong.length)] : -1;

    const weights = live.map((i) => {
        let base: number;
        if (i === question.correctIndex) {
            base = lerp(8, 2.2, d); // commanding lead when easy, slim when hard
        } else if (i === trap) {
            base = 1 + lerp(0, 1.8, d);
        } else {
            base = 1;
        }
        return base * (0.8 + 0.4 * rng()); // ±20% crowd noise
    });

    const total = weights.reduce((a, b) => a + b, 0);
    const shares = new Array(optionCount).fill(0);
    live.forEach((i, k) => {
        shares[i] = weights[k] / total;
    });
    return toPercentages(shares);
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
