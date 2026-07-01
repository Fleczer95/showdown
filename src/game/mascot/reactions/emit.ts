import type { Surface } from './events';

const EXACT: Record<string, Surface> = {
    Home: 'home',
    Store: 'store',
    Progress: 'progress',
    Challenge: 'challenge',
    ChallengeHistory: 'challenge',
    Mascot: 'mascot',
};

/**
 * Map a navigation route name to the mascot Surface the director scopes by.
 * Solo play is rendered INSIDE each game's setup route (e.g. `ladderSetup` swaps
 * to its PlayScreen), so setup/play/game routes all map to the game surface;
 * everything unmatched is 'other' (the fox stays quiet there).
 */
export function surfaceForRoute(routeName: string): Surface {
    if (EXACT[routeName]) return EXACT[routeName];
    if (/play|game|setup/i.test(routeName)) return 'game';
    return 'other';
}
