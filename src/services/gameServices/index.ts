// Game Center (iOS) / Google Play Games (Android) integration surface.

import { isAuthenticated, showAchievements, signIn } from '../../../modules/game-services';

export { syncGameServices } from './sync';
export { gameServicesAvailable } from '../../../modules/game-services';

/** Ensure sign-in (prompting once on user intent), or report we can't proceed. */
async function ensureSignedIn(): Promise<boolean> {
    return (await isAuthenticated()) || (await signIn());
}

/**
 * Open the platform's native dashboard, prompting sign-in on demand. It lands on
 * achievements; leaderboards are one tap away in the dashboard's own tabs, which
 * is why the app exposes a single entry rather than mirroring that navigation.
 */
export async function openAchievementsUi(): Promise<void> {
    if (!(await ensureSignedIn())) return;
    await showAchievements();
}
