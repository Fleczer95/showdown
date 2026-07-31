// Game Center (iOS) / Google Play Games (Android) integration surface.

import { isAuthenticated, showAchievements, signIn } from '../../../modules/game-services';
import { loadStats } from '../../game/progression/recordRun';
import { syncGameServices } from './sync';

export { syncGameServices } from './sync';
export { gameServicesAvailable } from '../../../modules/game-services';

/** Ensure sign-in (prompting once on user intent), or report we can't proceed. */
async function ensureSignedIn(): Promise<boolean> {
    if (await isAuthenticated()) return true;
    if (!(await signIn())) return false;
    // Everything earned so far predates this sign-in, and sync otherwise only
    // runs at startup and after a finished run — so the dashboard we're about to
    // open would be empty until the player's next game.
    await syncGameServices(loadStats());
    return true;
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
