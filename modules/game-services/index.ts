// JS surface of the GameServices native module. Soft-fail by design: when the
// native module is absent (Jest, web) or a call fails (unauthenticated, no
// network), every function resolves harmlessly instead of throwing.
//
// The reporting calls answer with whether the write actually landed. That matters:
// the sync layer only banks its "already sent" digest when everything succeeded,
// so a swallowed failure here would silently strand a player's progress.

import { requireOptionalNativeModule } from 'expo-modules-core';

interface GameServicesNativeModule {
    isAuthenticated(): Promise<boolean>;
    beginAuthentication(): Promise<boolean>;
    signIn(): Promise<boolean>;
    unlockAchievement(id: string): Promise<boolean>;
    submitScore(leaderboardId: string, score: number): Promise<boolean>;
    showAchievements(): Promise<boolean>;
    readCloudSave(): Promise<string | null>;
    writeCloudSave(payload: string): Promise<boolean>;
    recordStatsEvent(name: string, properties: Record<string, string | number | boolean>): Promise<boolean>;
}

const native = requireOptionalNativeModule<GameServicesNativeModule>('GameServices');

/** Whether the native Play Games / Game Center bridge is linked into this build. */
export const gameServicesAvailable = native != null;

/** Runs a native call, treating an absent module or a throw as "did not happen". */
async function soft(call: (module: GameServicesNativeModule) => Promise<boolean>): Promise<boolean> {
    if (!native) return false;
    try {
        return await call(native);
    } catch {
        return false;
    }
}

export function isAuthenticated(): Promise<boolean> {
    return soft((m) => m.isAuthenticated());
}

/**
 * Initialize the platform's games session without ever showing UI. On iOS this is
 * what starts Game Center at all, so it's deliberately only called when there is
 * something to sync — see the module's Swift docs.
 */
export function beginAuthentication(): Promise<boolean> {
    return soft((m) => m.beginAuthentication());
}

/** Prompt platform sign-in (Play Games dialog / Game Center sheet). */
export function signIn(): Promise<boolean> {
    return soft((m) => m.signIn());
}

/** Reports the unlock. Resolves false when it didn't land, so the caller retries. */
export function unlockAchievement(id: string): Promise<boolean> {
    return soft((m) => m.unlockAchievement(id));
}

/** Submits the score. Resolves false when it didn't land, so the caller retries. */
export function submitScore(leaderboardId: string, score: number): Promise<boolean> {
    return soft((m) => m.submitScore(leaderboardId, score));
}

/** Opens the platform dashboard. Resolves false when it can't be shown. */
export function showAchievements(): Promise<boolean> {
    return soft((m) => m.showAchievements());
}

/**
 * Reads the cloud save slot (Play Saved Games; always null on iOS). Null also
 * covers "no slot yet", "not signed in" and "call failed" — all cases where the
 * caller must keep local state rather than treat the cloud as authoritative.
 */
export async function readCloudSave(): Promise<string | null> {
    if (!native) return null;
    try {
        return await native.readCloudSave();
    } catch {
        return null;
    }
}

/** Writes the cloud save slot. Resolves false when it didn't land, so the caller retries. */
export function writeCloudSave(payload: string): Promise<boolean> {
    return soft((m) => m.writeCloudSave(payload));
}

/**
 * Records a Game Stats event (Play Games only; always false on iOS). Fire-and-
 * forget: stats are a reporting surface, so a dropped event costs a data point,
 * never player progress.
 */
export function recordStatsEvent(
    name: string,
    properties: Record<string, string | number | boolean>,
): Promise<boolean> {
    return soft((m) => m.recordStatsEvent(name, properties));
}
