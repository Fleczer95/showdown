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

/** A Bronze/Silver/Gold family: one numeric axis with three escalating thresholds. */
export interface AchievementFamily {
    family: string;
    axis: (s: ProgressionStats) => number;
    thresholds: [number, number, number];
}

/** The tiered families, in display order — the single source of truth for tiers. */
export const ACHIEVEMENT_FAMILIES: readonly AchievementFamily[] = [
    { family: 'contestant', axis: (s) => s.runsPlayed, thresholds: [10, 50, 200] },
    { family: 'on-a-roll', axis: (s) => longestStreak(s.datesPlayed), thresholds: [3, 7, 30] },
    { family: 'regular', axis: (s) => s.datesPlayed.length, thresholds: [5, 15, 40] },
    { family: 'winner', axis: totalWins, thresholds: [5, 25, 100] },
    { family: 'big-scorer', axis: (s) => s.bestSingleRunScore, thresholds: [5000, 20000, 50000] },
];

const TIER_NAMES = ['bronze', 'silver', 'gold'] as const;
const TIER_XP = [ACHIEVEMENT_XP_TIERS.bronze, ACHIEVEMENT_XP_TIERS.silver, ACHIEVEMENT_XP_TIERS.gold];

/** Build the Bronze/Silver/Gold trio of defs for a family. */
function tiers({ family, axis, thresholds }: AchievementFamily): AchievementDef[] {
    return TIER_NAMES.map((tier, i) => ({
        id: `${family}-${tier}`,
        xp: TIER_XP[i],
        test: (s: ProgressionStats) => axis(s) >= thresholds[i],
    }));
}

export interface FamilyProgress {
    /** How many of the three tiers are earned (0–3). */
    earnedTiers: number;
    /** Current value on the family's axis. */
    current: number;
    /** Threshold of the next unearned tier, or null when all three are earned. */
    nextTarget: number | null;
    /** 0–1 toward the next tier (1 when fully maxed). */
    fraction: number;
}

/** Pure progress summary for a tiered family — drives the row + detail sheet. */
export function familyProgress(fam: AchievementFamily, stats: ProgressionStats): FamilyProgress {
    const current = fam.axis(stats);
    const earnedTiers = fam.thresholds.filter((threshold) => current >= threshold).length;
    const nextTarget = earnedTiers < 3 ? fam.thresholds[earnedTiers] : null;
    const fraction = nextTarget === null ? 1 : Math.max(0, Math.min(1, current / nextTarget));
    return { earnedTiers, current, nextTarget, fraction };
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

/** One-off (non-tiered) achievement ids, in display order: Well-Rounded + the feats. */
export const ONE_OFF_IDS = ['well-rounded', ...FEAT_IDS] as const;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
    // Tiered families (15)
    ...ACHIEVEMENT_FAMILIES.flatMap(tiers),

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
