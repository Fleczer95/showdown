// "Replay derived truth" sync: achievements and best scores are pure functions
// of local stats, so every sync just re-asserts the full earned state — both
// platforms treat unlock/submit as idempotent (they keep the max). An MMKV
// digest of the last *fully delivered* state keeps quiet foregrounds from
// re-sending no-op calls.
//
// The digest is banked only when every call confirmed delivery. Anything less
// leaves it unwritten, because the stats won't change on their own: a half-sent
// state recorded as complete would strand a player's progress until they
// happened to earn something new.

import { createMMKV } from 'react-native-mmkv';
// Deliberately not the progression barrel — recordRun imports this module, and
// the barrel re-exports recordRun (import cycle).
import { achievementsUnlocked } from '../../game/progression/achievements';
import type { ProgressionStats } from '../../game/progression/types';
import { RANKED_GAMES } from '../../game/ranking/config';
import {
    beginAuthentication,
    gameServicesAvailable,
    submitScore,
    unlockAchievement,
} from '../../../modules/game-services';
import { platformAchievementId, platformLeaderboardId } from './ids';
import { SafeAnalytics } from '../../utils/firebase/init';
import { SafeSentry } from '../../utils/sentry/init';

const store = createMMKV({ id: 'showdown-game-services' });
const DIGEST_KEY = 'digest';

/** Canonical string of everything sync would send for these stats. */
export function computeDigest(stats: ProgressionStats): string {
    const earned = [...achievementsUnlocked(stats)].sort();
    const scores = RANKED_GAMES.map((gameId) => `${gameId}:${stats.bestScoreByGame[gameId] ?? 0}`);
    return JSON.stringify([earned, scores]);
}

/** Whether this player has anything worth a platform round-trip yet. */
function hasAnythingToSend(stats: ProgressionStats): boolean {
    if (achievementsUnlocked(stats).size > 0) return true;
    return RANKED_GAMES.some((gameId) => (stats.bestScoreByGame[gameId] ?? 0) > 0);
}

/**
 * Idempotently push all earned achievements + best scores to the platform.
 * Fire-and-forget-safe: skips silently when nothing changed, when there is
 * nothing earned yet, or when authentication doesn't settle.
 */
export async function syncGameServices(stats: ProgressionStats): Promise<void> {
    if (!gameServicesAvailable) return;

    const digest = computeDigest(stats);
    if (store.getString(DIGEST_KEY) === digest) return;
    // A player with no progress gets no platform session opened on their behalf.
    if (!hasAnythingToSend(stats)) return;
    if (!(await beginAuthentication())) {
        // Ordinary for a player with no Game Center account — tracked because a
        // sudden all-sessions version of it means the store config broke.
        SafeAnalytics.logEvent({ name: 'game_services_sync', params: { outcome: 'unauthenticated', failed: 0 } });
        return;
    }

    let failed = 0;

    for (const localId of achievementsUnlocked(stats)) {
        const id = platformAchievementId(localId);
        // An unprovisioned id can never be delivered, so it must not hold the
        // digest hostage — `ids.test.ts` guards against one appearing by accident.
        if (!id) continue;
        if (!(await unlockAchievement(id))) failed += 1;
    }

    for (const gameId of RANKED_GAMES) {
        const score = stats.bestScoreByGame[gameId] ?? 0;
        const id = platformLeaderboardId(gameId);
        if (!id || score <= 0) continue;
        if (!(await submitScore(id, score))) failed += 1;
    }

    if (failed === 0) {
        store.set(DIGEST_KEY, digest);
        SafeAnalytics.logEvent({ name: 'game_services_sync', params: { outcome: 'delivered', failed: 0 } });
        return;
    }

    // Signed in, yet the platform refused writes. This is the one outcome that is
    // neither expected nor self-announcing: the digest stays unwritten, so it will
    // replay quietly on every launch and every run until something changes.
    SafeAnalytics.logEvent({ name: 'game_services_sync', params: { outcome: 'incomplete', failed } });
    SafeSentry.captureMessage('Game services sync incomplete', {
        level: 'warning',
        tags: { area: 'game-services' },
        extra: { failed },
    });
}
