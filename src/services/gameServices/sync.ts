// "Replay derived truth" sync: achievements and best scores are pure functions
// of local stats, so every sync just re-asserts the full earned state — both
// platforms treat unlock/submit as idempotent (they keep the max). An MMKV
// digest of the last successfully-attempted state keeps quiet foregrounds from
// re-sending 31 no-op calls.

import { createMMKV } from 'react-native-mmkv';
// Deliberately not the progression barrel — recordRun imports this module, and
// the barrel re-exports recordRun (import cycle).
import { achievementsUnlocked } from '../../game/progression/achievements';
import type { ProgressionStats } from '../../game/progression/types';
import { gameServicesAvailable, isAuthenticated, submitScore, unlockAchievement } from '../../../modules/game-services';
import { platformAchievementId, platformLeaderboardId } from './ids';

/** The games whose best scores have store leaderboards. */
export const LEADERBOARD_GAME_IDS = ['the-ladder', 'the-drop', 'the-wheel'] as const;

const store = createMMKV({ id: 'showdown-game-services' });
const DIGEST_KEY = 'digest';

/** Canonical string of everything sync would send for these stats. */
export function computeDigest(stats: ProgressionStats): string {
    const earned = [...achievementsUnlocked(stats)].sort();
    const scores = LEADERBOARD_GAME_IDS.map((gameId) => `${gameId}:${stats.bestScoreByGame[gameId] ?? 0}`);
    return JSON.stringify([earned, scores]);
}

/**
 * Idempotently push all earned achievements + best scores to the platform.
 * Fire-and-forget-safe: skips silently when nothing changed or the player
 * isn't signed in (leaving the digest unwritten so the next call retries).
 */
export async function syncGameServices(stats: ProgressionStats): Promise<void> {
    if (!gameServicesAvailable) return;

    const digest = computeDigest(stats);
    if (store.getString(DIGEST_KEY) === digest) return;
    if (!(await isAuthenticated())) return;

    for (const localId of achievementsUnlocked(stats)) {
        const id = platformAchievementId(localId);
        if (id) await unlockAchievement(id);
    }
    for (const gameId of LEADERBOARD_GAME_IDS) {
        const score = stats.bestScoreByGame[gameId] ?? 0;
        const id = platformLeaderboardId(gameId);
        if (id && score > 0) await submitScore(id, score);
    }

    store.set(DIGEST_KEY, digest);
}
