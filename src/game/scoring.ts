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

/**
 * The Drop pays this per round survived (a correct allocation), on top of the
 * money kept and per-round timing. It keeps a busted run from scoring nothing
 * while guaranteeing any survivor outranks any loser: with BUNDLE = 25,000 the
 * smallest a survivor can keep, a final-round loser (survived TOTAL_ROUNDS − 1
 * rounds, max round-points + max timing) must stay below the lowest survivor.
 * That holds while this stays under BUNDLE / (TOTAL_ROUNDS − 2) ≈ 3,571.
 */
export const DROP_ROUND_SURVIVAL_POINTS = 2_000;

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
    // The clean-play bonus rewards lifelines saved across a run that actually
    // climbed. A run that answered nothing correctly (e.g. a first-question miss)
    // has no base and scores zero rather than banking the full unused-lifeline
    // bonus — which previously surfaced as a phantom 1500 on the challenge board.
    const bonus = args.base > 0 ? (LADDER_LIFELINE_COUNT - args.usedLifelines) * LADDER_LIFELINE_BONUS : 0;
    return { base: args.base, speed: args.speed, bonus, total: args.base + args.speed + bonus };
}

/**
 * Assemble The Drop's final score: money kept (final bank) + per-round timing
 * already summed over survived rounds + a flat reward per round survived.
 *
 * The round-survival reward means a busted run still scores for how far it got
 * (and faster play), while `DROP_ROUND_SURVIVAL_POINTS` is sized so any survivor
 * — even one ending on the minimum bank — always outranks any loser, including
 * one who busts on the final round. A first-round bust survives nothing and so
 * still scores 0.
 */
export function dropScore(args: { bank: number; roundsSurvived: number; speed: number }): ScoreBreakdown {
    const bonus = args.roundsSurvived * DROP_ROUND_SURVIVAL_POINTS;
    return { base: args.bank, speed: args.speed, bonus, total: args.bank + args.speed + bonus };
}

/** Assemble The Wheel's final score: banked cash + speed + (clean puzzles × bonus). */
export function wheelScore(args: { bankedCash: number; speed: number; cleanPuzzles: number }): ScoreBreakdown {
    const bonus = args.cleanPuzzles * WHEEL_NO_VOWEL_BONUS;
    return { base: args.bankedCash, speed: args.speed, bonus, total: args.bankedCash + args.speed + bonus };
}
