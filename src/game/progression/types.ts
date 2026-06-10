// Shapes shared across the progression engine. The persisted state is RAW STATS
// only; levels, rewards and achievements are pure functions derived from it.

/**
 * Facts a finished run hands to the progression engine at game-over. `gameId`,
 * `score` and `progress` are universal; the rest are the few per-game facts the
 * achievements check (all optional — a game only sets what's relevant to it).
 */
export interface GameRunResult {
    /** `games.ts` id: 'the-ladder' | 'the-drop' | 'the-wheel'. */
    gameId: string;
    /** Unified points total (the value also stored on the leaderboard). */
    score: number;
    /** How far the run got — Ladder rungs / Drop rounds survived / Wheel puzzles solved. */
    progress: number;
    /** Whether the run was a win for its game. */
    won: boolean;

    // Ladder
    /** Rung reached, 0–15. Drives skill XP and "To the Top". */
    rungReached?: number;
    /** Lifelines used this run. Zero + win → "Spotless". */
    lifelinesUsed?: number;
    /** Earned a big speed bonus at a high rung this run → "Quick Wit". */
    quickWit?: boolean;

    // Drop
    /** Final bank. Drives skill XP and "Iron Bank". */
    finalBank?: number;
    /** Rounds survived, 0–9. All nine → "Survivor". */
    roundsSurvived?: number;

    // Wheel
    /** Puzzles solved, 0–3. Drives skill XP; all three → "Clean Sweep". */
    puzzlesSolved?: number;
    /** Puzzles solved buying no vowels. One or more → "Vowel-Free". */
    cleanPuzzles?: number;
    /** Solved a puzzle after recovering from a Bankrupt → "Comeback". */
    bankruptRecovered?: boolean;
}

/**
 * The only thing persisted. Monotonic where it matters so that extending the map
 * or adding achievements later is purely additive and retroactive (no migration).
 */
export interface ProgressionStats {
    /** Cumulative, monotonic, never spendable. The map's whole input. */
    lifetimeXp: number;
    /** Total runs completed. */
    runsPlayed: number;
    /** Wins per gameId. Distinct keys with >0 power "Well-Rounded". */
    winsByGame: Record<string, number>;
    /** Distinct local calendar dates played (YYYY-MM-DD). */
    datesPlayed: string[];
    /** The local date `todayGameIds` refers to. */
    today: string;
    /** gameIds already played on `today` (resets when the date rolls over). */
    todayGameIds: string[];
    /** Best single-run score per gameId. Powers the per-game Scorer families. */
    bestScoreByGame: Record<string, number>;
    /** Momentary feats already earned — monotonic; not derivable from aggregates. */
    feats: string[];
}

/** Before/after summary returned by recordRun so the game-over screen can celebrate. */
export interface RecordRunDiff {
    /** XP gained this run (run XP + any newly-unlocked achievement XP). */
    xpGained: number;
    /** lifetimeXp after the run. */
    lifetimeXp: number;
    /** Whether this run crossed at least one level threshold. */
    leveledUp: boolean;
    /** Level before the run. */
    previousLevel: number;
    /** Level after the run. */
    level: number;
    /** Reward (cosmetic) ids unlocked by this run. */
    newRewards: string[];
    /** Achievement ids newly completed by this run. */
    newAchievements: string[];
}
