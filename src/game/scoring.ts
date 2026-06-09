// Pure, unified points scoring shared by all three live games — The Ladder,
// The Drop, The Wheel. No React / react-native imports; unit-tested in isolation.

/**
 * Hidden per-decision stopwatch window. An instant decision earns a speed bonus
 * equal to its base value; at or beyond this many seconds the bonus is 0.
 */
export const SPEED_WINDOW_SECONDS = 100;

/** The Ladder awards `rung × LADDER_RUNG_POINTS` per correct answer (rung 1–15). */
export const LADDER_RUNG_POINTS = 100;

/** The Ladder pays this per unused lifeline at run end. */
export const LADDER_LIFELINE_BONUS = 500;

/** Number of Ladder lifelines (50:50, ask studio, skip). */
export const LADDER_LIFELINE_COUNT = 3;

/** The Wheel pays this per puzzle solved without buying a vowel. */
export const WHEEL_NO_VOWEL_BONUS = 250;

/** Total points plus the components that make it up, for the game-over breakdown. */
export interface ScoreBreakdown {
    /** Core points: correct-answer base / final bank / banked cash. */
    base: number;
    /** Summed per-decision speed bonus. */
    speed: number;
    /** Clean-play bonus (unused lifelines / clean solves); 0 for The Drop. */
    bonus: number;
    /** base + speed + bonus — the value stored on the leaderboard. */
    total: number;
}

/**
 * Speed bonus for a single decision: faster answers earn more, floored at 0 and
 * capped at `baseValue` (so a decision's speed bonus can never beat its base).
 *   speedBonus(base, 0)              === base
 *   speedBonus(base, window / 2)     === base / 2 (rounded)
 *   speedBonus(base, window or more) === 0
 */
export function speedBonus(baseValue: number, seconds: number): number {
    const fraction = Math.max(0, Math.min(1, (SPEED_WINDOW_SECONDS - seconds) / SPEED_WINDOW_SECONDS));
    return Math.round(baseValue * fraction);
}

/** Assemble The Ladder's final score: base + speed + (unused lifelines × bonus). */
export function ladderScore(args: { base: number; speed: number; usedLifelines: number }): ScoreBreakdown {
    const bonus = (LADDER_LIFELINE_COUNT - args.usedLifelines) * LADDER_LIFELINE_BONUS;
    return { base: args.base, speed: args.speed, bonus, total: args.base + args.speed + bonus };
}

/**
 * Assemble The Drop's final score: final bank + a speed bonus that scales the
 * *final* bank by the run's average decision time (no clean-play bonus).
 *
 * Computing speed once from the final bank — rather than summing a per-round
 * money-scaled bonus — keeps it honest for a game whose bank only ever shrinks:
 * a busted run (bank 0) scores 0, and the carried-forward bank isn't counted
 * again every round.
 */
export function dropScore(args: { bank: number; avgSeconds: number }): ScoreBreakdown {
    const speed = speedBonus(args.bank, args.avgSeconds);
    return { base: args.bank, speed, bonus: 0, total: args.bank + speed };
}

/** Assemble The Wheel's final score: banked cash + speed + (clean puzzles × bonus). */
export function wheelScore(args: { bankedCash: number; speed: number; cleanPuzzles: number }): ScoreBreakdown {
    const bonus = args.cleanPuzzles * WHEEL_NO_VOWEL_BONUS;
    return { base: args.bankedCash, speed: args.speed, bonus, total: args.bankedCash + args.speed + bonus };
}
