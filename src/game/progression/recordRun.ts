// The one impure seam — called at each game-over. Pure reducer `applyRun` does all
// the work over raw stats; the MMKV wrapper `recordRun` just loads, applies, saves.

import { createMMKV } from 'react-native-mmkv';
import { PROGRESSION_STORE_ID } from './constants';
import { runXp } from './xp';
import { level, unlockedRewards } from './map';
import { ACHIEVEMENTS, achievementsUnlocked, detectFeats } from './achievements';
import type { GameRunResult, ProgressionStats, RecordRunDiff } from './types';

/** Fresh state for a player who has never played. */
export function defaultStats(): ProgressionStats {
    return {
        lifetimeXp: 0,
        runsPlayed: 0,
        winsByGame: {},
        datesPlayed: [],
        today: '',
        todayGameIds: [],
        bestSingleRunScore: 0,
        feats: [],
    };
}

const ACHIEVEMENT_XP = new Map(ACHIEVEMENTS.map((a) => [a.id, a.xp]));

/**
 * Pure: fold a finished run into the raw stats and return the updated stats plus a
 * before/after diff for the celebration. `today` is the device's local date
 * (injected so the reducer stays pure and testable).
 */
export function applyRun(
    prev: ProgressionStats,
    result: GameRunResult,
    today: string,
): { stats: ProgressionStats; diff: RecordRunDiff } {
    const beforeXp = prev.lifetimeXp;
    const beforeAchievements = achievementsUnlocked(prev);

    // Roll the day before reading "already played today".
    const dayRolled = prev.today !== today;
    const todayGameIds = dayRolled ? [] : [...prev.todayGameIds];
    const alreadyPlayed = todayGameIds.includes(result.gameId);

    // Aggregate updates.
    const winsByGame = { ...prev.winsByGame };
    if (result.won) winsByGame[result.gameId] = (winsByGame[result.gameId] ?? 0) + 1;

    const datesPlayed = prev.datesPlayed.includes(today) ? [...prev.datesPlayed] : [...prev.datesPlayed, today];
    if (!alreadyPlayed) todayGameIds.push(result.gameId);

    // Feats: per-run feats, plus Triple Threat once all three games are played today.
    const feats = new Set(prev.feats);
    for (const id of detectFeats(result)) feats.add(id);
    if (new Set(todayGameIds).size >= 3) feats.add('triple-threat');

    const stats: ProgressionStats = {
        lifetimeXp: beforeXp + runXp(result, alreadyPlayed),
        runsPlayed: prev.runsPlayed + 1,
        winsByGame,
        datesPlayed,
        today,
        todayGameIds,
        bestSingleRunScore: Math.max(prev.bestSingleRunScore, result.score),
        feats: [...feats],
    };

    // Newly-completed achievements pay their flat XP into the same spine.
    const afterAchievements = achievementsUnlocked(stats);
    const newAchievements = [...afterAchievements].filter((id) => !beforeAchievements.has(id));
    for (const id of newAchievements) stats.lifetimeXp += ACHIEVEMENT_XP.get(id) ?? 0;

    // Derive level + reward diffs from final XP.
    const previousLevel = level(beforeXp);
    const finalLevel = level(stats.lifetimeXp);
    const beforeRewards = unlockedRewards(beforeXp);
    const newRewards = [...unlockedRewards(stats.lifetimeXp)].filter((id) => !beforeRewards.has(id));

    const diff: RecordRunDiff = {
        xpGained: stats.lifetimeXp - beforeXp,
        lifetimeXp: stats.lifetimeXp,
        leveledUp: finalLevel > previousLevel,
        previousLevel,
        level: finalLevel,
        newRewards,
        newAchievements,
    };

    return { stats, diff };
}

// --- Persistence -----------------------------------------------------------

const store = createMMKV({ id: PROGRESSION_STORE_ID });
const STATS_KEY = 'stats';

/** Read persisted stats, falling back to a fresh record. */
export function loadStats(): ProgressionStats {
    const json = store.getString(STATS_KEY);
    if (!json) return defaultStats();
    try {
        return { ...defaultStats(), ...(JSON.parse(json) as Partial<ProgressionStats>) };
    } catch {
        return defaultStats();
    }
}

/** Device's local calendar date as YYYY-MM-DD. */
export function localDate(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Impure entry point: record a finished run and persist. Returns the diff. */
export function recordRun(result: GameRunResult): RecordRunDiff {
    const { stats, diff } = applyRun(loadStats(), result, localDate());
    store.set(STATS_KEY, JSON.stringify(stats));
    return diff;
}
