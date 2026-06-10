// Achievement definitions + the pure `achievementsUnlocked` derivation. Each grants
// a badge + flat XP (paid into the same lifetimeXp spine the map reads).
//
// Two kinds:
//  - Cumulative — derived straight from aggregate stats, so they stay unlocked and
//    are retroactive (Contestant, On a Roll, Regular, Winner, Big Scorer, Well-Rounded).
//  - Feats — momentary skill/breadth moments that can't be derived from aggregates,
//    so recordRun records them into `stats.feats` (monotonic) via `detectFeats`.

import { ACHIEVEMENT_XP_ONE_OFF, ACHIEVEMENT_XP_TIERS, QUICK_WIT_MIN_RUNG, QUICK_WIT_MAX_SECONDS } from './constants';
import { longestStreak } from './streak';
import type { GameRunResult, ProgressionStats } from './types';

export interface AchievementDef {
    id: string;
    xp: number;
    /** True when complete given the current raw stats. Pure. */
    test: (stats: ProgressionStats) => boolean;
}

const totalWins = (s: ProgressionStats) => Object.values(s.winsByGame).reduce((sum, n) => sum + n, 0);
const distinctGamesWon = (s: ProgressionStats) => Object.values(s.winsByGame).filter((n) => n > 0).length;

/** Build a Bronze/Silver/Gold trio from a numeric axis and its three thresholds. */
function tiers(
    family: string,
    axis: (s: ProgressionStats) => number,
    [bronze, silver, gold]: [number, number, number],
): AchievementDef[] {
    return [
        { id: `${family}-bronze`, xp: ACHIEVEMENT_XP_TIERS.bronze, test: (s) => axis(s) >= bronze },
        { id: `${family}-silver`, xp: ACHIEVEMENT_XP_TIERS.silver, test: (s) => axis(s) >= silver },
        { id: `${family}-gold`, xp: ACHIEVEMENT_XP_TIERS.gold, test: (s) => axis(s) >= gold },
    ];
}

/** Ids of the momentary feats — kept in sync with `detectFeats`. */
export const FEAT_IDS = [
    'triple-threat',
    'to-the-top',
    'spotless',
    'survivor',
    'iron-bank',
    'vowel-free',
    'clean-sweep',
    'quick-wit',
    'comeback',
] as const;

const feat = (id: string): AchievementDef => ({
    id,
    xp: ACHIEVEMENT_XP_ONE_OFF,
    test: (s) => s.feats.includes(id),
});

export const ACHIEVEMENTS: readonly AchievementDef[] = [
    // Tiered families (15)
    ...tiers('contestant', (s) => s.runsPlayed, [10, 50, 200]),
    ...tiers('on-a-roll', (s) => longestStreak(s.datesPlayed), [3, 7, 30]),
    ...tiers('regular', (s) => s.datesPlayed.length, [5, 15, 40]),
    ...tiers('winner', totalWins, [5, 25, 100]),
    ...tiers('big-scorer', (s) => s.bestSingleRunScore, [5000, 20000, 50000]),

    // One-offs (10): Well-Rounded is derivable; the rest are recorded feats.
    { id: 'well-rounded', xp: ACHIEVEMENT_XP_ONE_OFF, test: (s) => distinctGamesWon(s) >= 3 },
    ...FEAT_IDS.map(feat),
];

/** The set of completed achievement ids for the given raw stats. Pure, retroactive. */
export function achievementsUnlocked(stats: ProgressionStats): Set<string> {
    const ids = new Set<string>();
    for (const a of ACHIEVEMENTS) {
        if (a.test(stats)) ids.add(a.id);
    }
    return ids;
}

/** "Quick Wit": a correct Ladder answer answered fast enough at a high rung. */
export function isQuickWit(rung: number, seconds: number): boolean {
    return rung >= QUICK_WIT_MIN_RUNG && seconds <= QUICK_WIT_MAX_SECONDS;
}

/**
 * Per-run momentary feats this result satisfies (excludes Triple Threat, which
 * needs the day's game set and is handled in recordRun). recordRun unions these
 * into `stats.feats`.
 */
export function detectFeats(result: GameRunResult): string[] {
    const earned: string[] = [];
    const { gameId } = result;

    if (gameId === 'the-ladder') {
        if ((result.rungReached ?? 0) >= 15) earned.push('to-the-top');
        if (result.won && result.lifelinesUsed === 0) earned.push('spotless');
    }
    if (gameId === 'the-drop') {
        if ((result.roundsSurvived ?? 0) >= 9) earned.push('survivor');
        if ((result.finalBank ?? 0) >= 500_000) earned.push('iron-bank');
    }
    if (gameId === 'the-wheel') {
        if ((result.cleanPuzzles ?? 0) >= 1) earned.push('vowel-free');
        if ((result.puzzlesSolved ?? 0) >= 3) earned.push('clean-sweep');
    }
    if (result.quickWit) earned.push('quick-wit');
    if (result.bankruptRecovered) earned.push('comeback');

    return earned;
}
