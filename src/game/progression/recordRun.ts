// The one impure seam — called at each game-over. Pure reducer `applyRun` does all
// the work over raw stats; the MMKV wrapper `recordRun` just loads, applies, saves.

import { createMMKV } from 'react-native-mmkv';
import type { EventEdition } from '../../../shared/events/definitions';
import { drawPrizes } from '../events/draw';
import { PROGRESSION_STORE_ID } from './constants';
import { runXp } from './xp';
import { level, unlockedRewards, isApproachingMaxLevel, MAX_LEVEL } from './map';
import { SafeAnalytics } from '../../utils/firebase/init';
import { ACHIEVEMENTS, achievementsUnlocked, detectFeats } from './achievements';
import type { GameRunResult, ProgressionStats, RecordRunDiff } from './types';
import { grantLevelBonus } from '../offline/limit';
import { defaultStats } from './defaults';
// The concrete module, not the barrel: the barrel now reads stats back from
// here to sync right after a sign-in, and going through it would be a cycle.
import { syncGameServices } from '../../services/gameServices/sync';
// Same reason as above: the concrete module, not the barrel.
import { pushToCloud } from '../../services/gameServices/cloudSave';
import { reportRunStats } from '../../services/gameServices/stats';

// Lives in its own module so cloud save can reach the zero state without importing
// this one (which imports cloud save in turn). Re-exported so every existing
// caller — and the progression barrel — keeps working unchanged.
export { defaultStats } from './defaults';

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

    const bestScoreByGame = { ...prev.bestScoreByGame };
    bestScoreByGame[result.gameId] = Math.max(bestScoreByGame[result.gameId] ?? 0, result.score);

    // Feats: per-run feats, plus Triple Threat once all three games are played today.
    const feats = new Set(prev.feats);
    for (const id of detectFeats(result)) feats.add(id);
    if (new Set(todayGameIds).size >= 3) feats.add('triple-threat');

    const stats: ProgressionStats = {
        ...prev,
        lifetimeXp: beforeXp + runXp(result, alreadyPlayed),
        runsPlayed: prev.runsPlayed + 1,
        winsByGame,
        datesPlayed,
        today,
        todayGameIds,
        bestScoreByGame,
        feats: [...feats],
        challengesPlayed: prev.challengesPlayed + (result.challenge ? 1 : 0),
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
        bonusRunsGranted: 0,
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

// Screens read stats on focus, which is enough for XP earned by playing — the
// player is looking at a game-over screen when it changes. A cloud restore is
// different: it lands seconds after Home has already rendered, so without a
// notification the player sits staring at "Lv 1 · 0 XP" and concludes their
// progress is gone.
type StatsListener = (stats: ProgressionStats) => void;
const listeners = new Set<StatsListener>();

/** Subscribe to persisted-stat writes. Returns the unsubscribe function. */
export function subscribeToStats(listener: StatsListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Persist raw stats. Exported for cloud-save restore, which writes a merged state. */
export function saveStats(stats: ProgressionStats): void {
    store.set(STATS_KEY, JSON.stringify(stats));
    for (const listener of listeners) listener(stats);
}

/** Device's local calendar date as YYYY-MM-DD. */
export function localDate(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Impure entry point: record a finished run and persist. Returns the diff. */
export function recordRun(
    result: GameRunResult,
    completion?: { id: string; completedAt: number; edition?: EventEdition },
): RecordRunDiff {
    const prev = loadStats();
    const receipt = completion ? prev.completionReceipts?.[completion.id] : undefined;
    if (receipt) {
        // The receipt guards progression, not the separately stored level bonus.
        // Retrying its high-water-mark grant repairs a crash between the writes.
        const bonusRunsGranted = grantLevelBonus(receipt.previousLevel, receipt.level);
        return {
            xpGained: 0,
            lifetimeXp: prev.lifetimeXp,
            leveledUp: false,
            previousLevel: level(prev.lifetimeXp),
            level: level(prev.lifetimeXp),
            newRewards: [],
            newAchievements: [],
            bonusRunsGranted,
        };
    }
    const { stats, diff } = applyRun(
        prev,
        result,
        localDate(completion ? new Date(completion.completedAt) : undefined),
    );
    if (completion) {
        stats.completionReceipts = {
            ...prev.completionReceipts,
            [completion.id]: { previousLevel: diff.previousLevel, level: diff.level },
        };
        const edition = completion.edition;
        if (edition) {
            const count = (prev.eventCompletedRuns?.[edition.id] ?? 0) + 1;
            stats.eventCompletedRuns = { ...prev.eventCompletedRuns, [edition.id]: count };
        }
    }
    saveStats(stats);
    // Mirror to Game Center / Play Games — fire-and-forget, idempotent, and a
    // no-op when the native bridge is absent or the player isn't signed in.
    void syncGameServices(stats);
    // Mirror to the Play Saved Games slot. A failed push costs nothing: the next
    // run replays it, and restore merges rather than replaces either way.
    void pushToCloud(stats);
    // Report Game Stats. Purely a reporting surface — a dropped event costs a data
    // point on the Gamer profile, never player progress.
    void reportRunStats(result, stats);
    // Level-up telemetry lives at the recording seam so every run reports it —
    // solo or challenge, whether or not the celebration UI ever gets displayed.
    if (diff.leveledUp) {
        SafeAnalytics.logEvent({
            name: 'level_up',
            params: { from_level: diff.previousLevel, to_level: diff.level, lifetime_xp: diff.lifetimeXp },
        });
        // Fire once, on the run that first crosses INTO the near-max band. The band
        // is derived from the live level map, so it moves up if more levels ship.
        if (!isApproachingMaxLevel(diff.previousLevel) && isApproachingMaxLevel(diff.level)) {
            SafeAnalytics.logEvent({
                name: 'approaching_max_level',
                params: {
                    level: diff.level,
                    max_level: MAX_LEVEL,
                    levels_remaining: MAX_LEVEL - diff.level,
                    lifetime_xp: diff.lifetimeXp,
                },
            });
        }
    }
    // Bank offline-run bonus for any levels this run crossed. The grant is the
    // single source of truth for the count (idempotent on lastBonusLevel), so any
    // run — solo or challenge — that levels up earns banked solo runs.
    const bonusRunsGranted = diff.leveledUp ? grantLevelBonus(diff.previousLevel, diff.level) : 0;
    return { ...diff, bonusRunsGranted };
}

/**
 * Award any prizes owed for this edition's current win count. Idempotent: a
 * draw already in `eventRewardGrants` is skipped, never re-rolled.
 */
export function grantEventPrizes(edition: EventEdition, deviceId: string): string[] {
    const prev = loadStats();
    const wins = prev.eventWinIds?.[edition.id]?.length ?? 0;
    const drawn = drawPrizes({
        deviceId,
        editionId: edition.id,
        pool: edition.prizePool,
        winsPerPrize: edition.winsPerPrize,
        wins,
        grantedDraws: prev.eventRewardGrants ?? [],
        alreadyEarned: prev.earnedRewardIds ?? [],
    });
    if (drawn.length === 0) return [];
    saveStats({
        ...prev,
        eventRewardGrants: [...(prev.eventRewardGrants ?? []), ...drawn.map((d) => d.grantId)],
        earnedRewardIds: [...(prev.earnedRewardIds ?? []), ...drawn.map((d) => d.rewardId)],
    });
    return drawn.map((d) => d.rewardId);
}

/** Record a won round and award anything it unlocks. Safe to call repeatedly. */
export function recordEventWin(edition: EventEdition, challengeId: string, deviceId: string): string[] {
    const prev = loadStats();
    const won = prev.eventWinIds?.[edition.id] ?? [];
    if (won.includes(challengeId)) return [];
    saveStats({
        ...prev,
        eventWinIds: { ...prev.eventWinIds, [edition.id]: [...won, challengeId] },
    });
    return grantEventPrizes(edition, deviceId);
}
