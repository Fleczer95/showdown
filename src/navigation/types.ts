import type { SetupRoute } from '../data/games';

/**
 * Root stack param list. `Home` is the landing screen; each game's setup screen
 * is registered under the `setupRoute` name declared on its entry in
 * `src/data/games.ts` and receives that game's `id`.
 */
export type RootStackParamList = {
    Home: undefined;
    Settings: undefined;
    Theme: undefined;
    Store: { gameId?: string; itemId?: string } | undefined;
    Progress: { focusRewardId?: string } | undefined;
    privacyPolicy: undefined;
    termsOfUse: undefined;
    /** Async challenge opened from a shared link (`/c/:challengeId`) or after creating one. */
    Challenge: { challengeId: string; created?: boolean };
    /** List of challenges this device created or opened — resume unplayed, revisit results. */
    ChallengeHistory: undefined;
    /** Global ranking boards (ADR-0004). Optional `gameId` preselects a board. */
    Ranking: { gameId?: string } | undefined;
    /** Mascot customizer (plan §5). Reached from Settings → Appearance. Currently shows the
     * PoC harness; repointed to the real customizer in Phase 2. */
    Mascot: undefined;
} & Record<SetupRoute, { gameId: string }>;

// Make `useNavigation()` / `Link` etc. globally aware of the param list.
declare global {
    namespace ReactNavigation {
        interface RootParamList extends RootStackParamList {}
    }
}
