// JS surface of the GameServices native module. Soft-fail by design: when the
// native module is absent (Jest, web) or a call fails (unauthenticated, no
// network), every function resolves harmlessly instead of throwing.

import { requireOptionalNativeModule } from 'expo-modules-core';

interface GameServicesNativeModule {
    isAuthenticated(): Promise<boolean>;
    signIn(): Promise<boolean>;
    unlockAchievement(id: string): Promise<void>;
    submitScore(leaderboardId: string, score: number): Promise<void>;
    showAchievements(): Promise<void>;
    showLeaderboard(leaderboardId: string): Promise<void>;
}

const native = requireOptionalNativeModule<GameServicesNativeModule>('GameServices');

/** Whether the native Play Games / Game Center bridge is linked into this build. */
export const gameServicesAvailable = native != null;

export async function isAuthenticated(): Promise<boolean> {
    try {
        return (await native?.isAuthenticated()) ?? false;
    } catch {
        return false;
    }
}

/** Prompt platform sign-in (Play Games dialog / held Game Center sheet). */
export async function signIn(): Promise<boolean> {
    try {
        return (await native?.signIn()) ?? false;
    } catch {
        return false;
    }
}

export async function unlockAchievement(id: string): Promise<void> {
    try {
        await native?.unlockAchievement(id);
    } catch {
        // Soft no-op: replayed by the next idempotent sync.
    }
}

export async function submitScore(leaderboardId: string, score: number): Promise<void> {
    try {
        await native?.submitScore(leaderboardId, score);
    } catch {
        // Soft no-op: replayed by the next idempotent sync.
    }
}

export async function showAchievements(): Promise<void> {
    try {
        await native?.showAchievements();
    } catch {
        // Games UI unavailable (e.g. not signed in) — nothing to show.
    }
}

export async function showLeaderboard(leaderboardId: string): Promise<void> {
    try {
        await native?.showLeaderboard(leaderboardId);
    } catch {
        // Games UI unavailable (e.g. not signed in) — nothing to show.
    }
}
