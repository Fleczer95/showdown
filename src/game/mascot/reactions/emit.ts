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
 * Per-game play routes contain "play"/"game"; everything unmatched is 'other'
 * (the fox stays quiet there).
 */
export function surfaceForRoute(routeName: string): Surface {
    if (EXACT[routeName]) return EXACT[routeName];
    if (/play|game/i.test(routeName)) return 'game';
    return 'other';
}
