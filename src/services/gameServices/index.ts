// Game Center (iOS) / Google Play Games (Android) integration surface.

import { isAuthenticated, showAchievements, showLeaderboards, signIn } from '../../../modules/game-services';

export { syncGameServices } from './sync';
export { gameServicesAvailable } from '../../../modules/game-services';

/** Ensure sign-in (prompting once on user intent), or report we can't proceed. */
async function ensureSignedIn(): Promise<boolean> {
    return (await isAuthenticated()) || (await signIn());
}

/** Open the platform's native achievements UI, prompting sign-in on demand. */
export async function openAchievementsUi(): Promise<void> {
    if (!(await ensureSignedIn())) return;
    await showAchievements();
}

/** Open the platform's native leaderboards UI, prompting sign-in on demand. */
export async function openLeaderboardsUi(): Promise<void> {
    if (!(await ensureSignedIn())) return;
    await showLeaderboards();
}
