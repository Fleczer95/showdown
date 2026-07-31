// Pure id mapping between local progression ids and the two stores' ids.
// Apple ids are deterministic (derived from the local id); Google generates
// opaque ids at provisioning time, captured in playIds.generated.ts.

import { Platform } from 'react-native';
import { PLAY_GAMES_ACHIEVEMENT_IDS, PLAY_GAMES_LEADERBOARD_IDS } from './playIds.generated';

const APP_PREFIX = 'com.showdown.app';

/** Vendor ids allow only [A-Za-z0-9._] — local ids use hyphens. */
const underscored = (id: string) => id.replace(/-/g, '_');

export function appleAchievementId(localId: string): string {
    return `${APP_PREFIX}.ach.${underscored(localId)}`;
}

export function appleLeaderboardId(gameId: string): string {
    return `${APP_PREFIX}.lb.${underscored(gameId)}`;
}

/** Platform-appropriate achievement id, or undefined when not provisioned. */
export function platformAchievementId(localId: string): string | undefined {
    return Platform.OS === 'android' ? PLAY_GAMES_ACHIEVEMENT_IDS[localId] : appleAchievementId(localId);
}

/** Platform-appropriate leaderboard id, or undefined when not provisioned. */
export function platformLeaderboardId(gameId: string): string | undefined {
    return Platform.OS === 'android' ? PLAY_GAMES_LEADERBOARD_IDS[gameId] : appleLeaderboardId(gameId);
}
